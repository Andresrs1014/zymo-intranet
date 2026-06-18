from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose.exceptions import JWTError
from sqlmodel import Session, select

from app.core.security import decode_token
from app.core.permissions import user_has_any_permission, user_has_permission
from app.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

def get_token(request: Request, token: str | None = Depends(oauth2_scheme)) -> str:
    if not token and request.query_params.get("token"):
        return request.query_params.get("token") or ""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

def get_current_user(
    token: str = Depends(get_token),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload.get("sub")
    user = db.exec(select(User).where(User.email == email)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo o no encontrado.",
        )
    return user


# ── Guards ────────────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Solo admin puede acceder."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol 'admin'.",
        )
    return current_user


def require_permission(*permission_ids: str):
    """Admin siempre. Otros: al menos un permiso (BD del rol o compat. por área)."""

    def guard(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role == "admin":
            return current_user
        if user_has_any_permission(db, current_user, list(permission_ids)):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes para esta operación.",
        )

    return guard


# Atajos semánticos (módulos)
require_compras = require_permission("mod_oc_ver")
require_financiero = require_permission("mod_financiero")
require_gerencial = require_permission("mod_gerencial")
require_sgc = require_permission("mod_sgc")
require_extraccion_ia = require_permission("mod_extraccion_ia")
require_mantenimiento = require_permission("mod_mantenimiento")
require_tc = require_permission("mod_tc")


def require_any_role(allowed_roles: list[str]):
    """Guard configurable: acepta admin siempre + cualquier rol de la lista."""
    def guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == "admin":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso restringido. Roles permitidos: {', '.join(allowed_roles)}.",
            )
        return current_user
    return guard


def require_oc_config_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Configuración OC (SMTP, listas): admin o permiso mod_oc_config."""
    if current_user.role == "admin":
        return current_user
    if user_has_permission(db, current_user, "mod_oc_config"):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Se requiere permiso de configuración OC.",
    )
