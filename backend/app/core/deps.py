from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose.exceptions import JWTError
from sqlmodel import Session, select

from app.core.security import decode_token
from app.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
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


def require_compras(current_user: User = Depends(get_current_user)) -> User:
    """
    Guard del módulo OC. Pasan:
      - role='admin'
      - role='administrativo'
      - role='directivo'
      - role='compras'
      - area='Compras'  (retrocompatibilidad con usuarios existentes)
    """
    OC_ROLES = {"admin", "administrativo", "directivo", "compras"}
    if current_user.role in OC_ROLES:
        return current_user
    if current_user.area == "Compras":
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Sin acceso al módulo OC Automatizaciones.",
    )


def require_financiero(current_user: User = Depends(get_current_user)) -> User:
    """
    Guard del módulo Financiero. Pasan:
      - role='admin'
      - role='financiero'
      - area='contabilidad'
    """
    if current_user.role == "admin":
        return current_user
    if current_user.role == "financiero" or current_user.area == "contabilidad":
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Sin acceso al módulo Financiero.",
    )


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


def require_gerencial(current_user: User = Depends(get_current_user)) -> User:
    """Guard: solo admin y gerente acceden al módulo gerencial."""
    _ROLES_GERENCIAL = {"admin", "gerente"}
    if current_user.role not in _ROLES_GERENCIAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido al módulo gerencial.",
        )
    return current_user
