"""
Autorización basada en permisos del rol (tabla `role.app_permissions`).

- `admin` tiene todos los permisos.
- El resto: permisos efectivos = fila `Role` donde `Role.name == user.role`.
- Compatibilidad: si el área del usuario coincidía con reglas históricas, se concede el permiso
  equivalente aunque no esté en JSON (migración suave).
"""
from __future__ import annotations

from sqlmodel import Session, select

from app.models.role import Role
from app.models.user import User


def _role_permission_set(db: Session, role_name: str) -> set[str]:
    row = db.exec(select(Role).where(Role.name == role_name)).first()
    if not row or not row.app_permissions:
        return set()
    return set(row.app_permissions)


def _legacy_area_grants(user: User, permission: str) -> bool:
    if permission == "mod_oc_ver" and user.area == "Compras":
        return True
    if permission == "mod_operativo" and user.area == "Operaciones":
        return True
    if permission == "mod_sgc" and user.area == "Gestión de Calidad":
        return True
    if permission == "mod_financiero" and user.area == "contabilidad":
        return True
    return False


def user_has_permission(db: Session, user: User, permission: str) -> bool:
    if user.role == "admin":
        return True
    if permission in _role_permission_set(db, user.role):
        return True
    return _legacy_area_grants(user, permission)


def user_has_any_permission(db: Session, user: User, permissions: list[str]) -> bool:
    if user.role == "admin":
        return True
    return any(user_has_permission(db, user, p) for p in permissions)


def role_names_with_permission(db: Session, permission: str) -> list[str]:
    """Nombres de rol (`Role.name`) que incluyen un permiso en BD (más admin)."""
    names: list[str] = ["admin"]
    for row in db.exec(select(Role)).all():
        if row.app_permissions and permission in row.app_permissions:
            names.append(row.name)
    return list(dict.fromkeys(names))
