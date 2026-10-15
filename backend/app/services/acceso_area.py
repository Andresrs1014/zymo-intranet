"""Permisos que una persona tiene asignados directamente (pantalla Organización → Editar permisos)."""
from __future__ import annotations

import logging

from sqlmodel import Session, func, select

from app.models.area import Area
from app.models.area_acceso import HerramientaAcceso, UsuarioPermiso
from app.models.user import User

log = logging.getLogger(__name__)


def exclusivos(db: Session) -> dict[str, set[int]]:
    return {h.permiso: set(h.areas or []) for h in db.exec(select(HerramientaAcceso)).all()}


def area_id_de(db: Session, user: User) -> int | None:
    if not user.area:
        return None
    area = db.exec(select(Area).where(func.lower(Area.name) == user.area.strip().lower())).first()  # «Planeación y consultoria» ≙ «…Consultoria»
    return area.id if area else None


def permisos_no_permitidos(db: Session, user: User, permisos: list[str]) -> list[str]:
    """Permisos exclusivos de otras áreas: esta persona (por su área) no puede recibirlos."""
    ex = exclusivos(db)
    area = area_id_de(db, user)
    return [p for p in permisos if p in ex and area not in ex[p]]


def permisos_asignados(db: Session, user: User) -> set[str]:
    """Permisos dados a la persona. Nunca rompe el login: ante un error devuelve vacío."""
    try:
        dados = {f.permiso for f in db.exec(select(UsuarioPermiso).where(UsuarioPermiso.user_id == user.id)).all()}
        # si luego un permiso se volvió exclusivo de otras áreas, deja de aplicar sin borrar nada
        return dados - set(permisos_no_permitidos(db, user, list(dados)))
    except Exception:  # noqa: BLE001
        log.exception("No se pudieron calcular los permisos asignados del usuario %s", user.id)
        return set()

