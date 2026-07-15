from datetime import datetime, timedelta, timezone
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from pydantic import BaseModel, EmailStr, field_validator
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import get_current_user, get_db, require_admin
from app.core.security import create_access_token, hash_password, verify_password
from app.models.role import Role
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    sede: str | None
    area: str | None
    is_active: bool
    app_permissions: list[str] = []
    user_tools: list[str] = []


class UserListResponse(MeResponse):
    created_at: str
    last_login_at: str | None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "empleado"
    sede: str | None = None
    area: str | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        return v


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    sede: str | None = None
    area: str | None = None


class AdminSetPasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

def _permissions_for_role(db: Session, role_name: str) -> list[str]:
    role = db.exec(select(Role).where(Role.name == role_name)).first()
    if not role or not role.app_permissions:
        return []
    return list(role.app_permissions)


def _to_me(
    u: User,
    app_permissions: list[str] | None = None,
    user_tools: list[str] | None = None,
) -> MeResponse:
    return MeResponse(
        id=cast(int, u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        sede=u.sede,
        area=u.area,
        is_active=u.is_active,
        app_permissions=app_permissions or [],
        user_tools=user_tools or [],
    )


def _to_list(u: User) -> UserListResponse:
    return UserListResponse(
        id=cast(int, u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        sede=u.sede,
        area=u.area,
        is_active=u.is_active,
        created_at=u.created_at.isoformat(),
        last_login_at=u.last_login_at.isoformat() if u.last_login_at else None,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/token", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not user.is_active or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()

    perms = _permissions_for_role(db, user.role)
    token = create_access_token(
        subject=user.email,
        extra={
            "role": user.role,
            "sede": user.sede,
            "area": user.area,
            "id": user.id,
            "app_permissions": perms,
        },
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.user_tool import UserTool

    perms = _permissions_for_role(db, current_user.role)
    tools = db.exec(
        select(UserTool).where(
            UserTool.user_id == current_user.id,
            UserTool.is_active == True,  # noqa: E712
        )
    ).all()
    tool_keys = [t.tool_key for t in tools]

    return _to_me(current_user, perms, tool_keys)


class SSOTokenResponse(BaseModel):
    sso_token: str


@router.get("/sso-token-crm", response_model=SSOTokenResponse)
def sso_token_crm(current_user: User = Depends(get_current_user)):
    """Genera un JWT de corta duración (5 min) firmado con JWT_SSO_SECRET
    para autenticar al usuario en el CRM sin contraseña."""
    if not settings.jwt_sso_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO no configurado en este servidor.",
        )
    payload = {
        "sub": current_user.email,
        "username": current_user.email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    token = jwt.encode(payload, settings.jwt_sso_secret, algorithm="HS256")
    return SSOTokenResponse(sso_token=token)


@router.post("/register", response_model=MeResponse)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Registra un nuevo usuario. Solo admin."""
    existing = db.exec(select(User).where(User.email == str(payload.email))).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo.",
        )
    user = User(
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        sede=payload.sede,
        area=payload.area,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_me(user)


# ── Gestión de usuarios (solo admin) ─────────────────────────────────────────

@router.get("/users", response_model=list[UserListResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Lista todos los usuarios activos."""
    users = db.exec(select(User).where(User.is_active == True)).all()  # noqa: E712
    return [_to_list(u) for u in users]


@router.get("/users/archived", response_model=list[UserListResponse])
def list_archived(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Lista usuarios desactivados."""
    users = db.exec(select(User).where(User.is_active == False)).all()  # noqa: E712
    return [_to_list(u) for u in users]


@router.put("/users/{user_id}", response_model=MeResponse)
def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    perms = _permissions_for_role(db, user.role)
    return _to_me(user, perms)


@router.patch("/users/{user_id}/password", response_model=UserListResponse)
def admin_set_user_password(
    user_id: int,
    payload: AdminSetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Establece una nueva contraseña para un usuario. Solo administradores."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user.hashed_password = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_list(user)


@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Desactiva (archiva) un usuario."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo.")
    user.is_active = False
    user.deactivated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}/eliminar")
def delete_user_permanently(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Elimina permanentemente un usuario archivado."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.is_active:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar usuarios archivados.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo.")

    db.delete(user)
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/reactivar", response_model=MeResponse)
def reactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.is_active:
        raise HTTPException(status_code=400, detail="El usuario ya está activo.")
    user.is_active = True
    user.deactivated_at = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_me(user)
