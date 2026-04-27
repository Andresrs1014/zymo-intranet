from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlmodel import Session, select

from app.core.deps import require_admin
from app.database import get_db
from app.models.role import Role
from app.models.user import User

router = APIRouter(prefix="/roles", tags=["Roles"])

FALLBACK_ROLE_NAME = "empleado"


class RoleDeleteResult(BaseModel):
    reassigned_users: int


class RoleCreate(BaseModel):
    name: str
    label: str
    description: str | None = None
    app_permissions: list[str] = []


class RoleUpdate(BaseModel):
    label: str | None = None
    description: str | None = None
    app_permissions: list[str] | None = None


class RoleRead(BaseModel):
    id: int
    name: str
    label: str
    description: str | None
    app_permissions: list[str]

    @field_validator("app_permissions", mode="before")
    @classmethod
    def coerce_permissions(cls, v: object) -> list[str]:
        return v if v is not None else []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[RoleRead])
def list_roles(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.exec(select(Role).order_by(Role.label)).all()


@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.exec(select(Role).where(Role.name == payload.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un rol con el nombre '{payload.name}'.",
        )
    role = Role(name=payload.name, label=payload.label, description=payload.description, app_permissions=payload.app_permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.patch("/{role_id}", response_model=RoleRead)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado.")
    if payload.label is not None:
        role.label = payload.label
    if payload.description is not None:
        role.description = payload.description
    if payload.app_permissions is not None:
        role.app_permissions = payload.app_permissions
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}", response_model=RoleDeleteResult)
def delete_role(
    role_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado.")
    if role.name == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol administrador no puede eliminarse.",
        )

    affected = db.exec(select(User).where(User.role == role.name)).all()
    for u in affected:
        u.role = FALLBACK_ROLE_NAME
        db.add(u)

    db.delete(role)
    db.commit()
    return RoleDeleteResult(reassigned_users=len(affected))
