"""Pool de mantenimientos internos disponibles para auto-asignación."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.database import get_db
from app.models.mantenimiento import SolicitudMantenimiento
from app.models.user import User
from app.oc_database import get_oc_db
from app.routers.mantenimiento.solicitudes import SolicitudMantenimientoOut, _enriquecer
from app.services.mnt_pool import auto_asignar_desde_pool, query_pool_disponibles

log = logging.getLogger(__name__)
router = APIRouter(prefix="/pool", tags=["Mantenimiento - Pool"])


def _users_for_items(app_db: Session, items: list[SolicitudMantenimiento]) -> dict:
    user_ids = {s.solicitante_id for s in items}
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return {u.id: u for u in users}


@router.get("/disponibles", response_model=list[SolicitudMantenimientoOut])
def listar_pool_disponibles(
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicitudes internas sin auxiliar — pool para auto-asignación."""
    if current_user.role not in ("auxiliar_mantenimiento", "admin", "directivo"):
        from app.core.permissions import user_has_permission
        if not user_has_permission(app_db, current_user, "mod_mantenimiento"):
            raise HTTPException(status_code=403, detail="Acceso denegado.")

    items = oc_db.exec(query_pool_disponibles()).all()
    users_by_id = _users_for_items(app_db, items)
    return [_enriquecer(s, users_by_id, oc_db=oc_db) for s in items]


@router.post("/solicitudes/{solicitud_id}/auto-asignar", response_model=SolicitudMantenimientoOut)
def auto_asignar_solicitud(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sol = auto_asignar_desde_pool(oc_db, solicitud_id, current_user)
    user_ids = {sol.solicitante_id, current_user.id}
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    return _enriquecer(sol, {u.id: u for u in users}, oc_db=oc_db)
