"""Pool de solicitudes internas sin asignar — auto-asignación del auxiliar."""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.mantenimiento import HistorialMantenimiento, SolicitudMantenimiento
from app.models.user import User

log = logging.getLogger(__name__)

_ESTADOS_POOL = {"solicitud", "programado"}


def query_pool_disponibles():
    return (
        select(SolicitudMantenimiento)
        .where(
            SolicitudMantenimiento.modalidad == "interno",
            SolicitudMantenimiento.asignado_id == None,  # noqa: E711
            SolicitudMantenimiento.estado.in_(list(_ESTADOS_POOL)),
        )
        .order_by(SolicitudMantenimiento.created_at.desc())
    )


def auto_asignar_desde_pool(
    oc_db: Session,
    solicitud_id: int,
    actor: User,
) -> SolicitudMantenimiento:
    if actor.role != "auxiliar_mantenimiento":
        raise HTTPException(
            status_code=403,
            detail="Solo el auxiliar de mantenimiento puede auto-asignarse desde el pool.",
        )

    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    if sol.modalidad != "interno":
        raise HTTPException(status_code=400, detail="Solo solicitudes internas están en el pool.")
    if sol.asignado_id is not None:
        raise HTTPException(status_code=409, detail="Esta solicitud ya tiene auxiliar asignado.")
    if sol.estado not in _ESTADOS_POOL:
        raise HTTPException(
            status_code=400,
            detail=f"Estado '{sol.estado}' no permite auto-asignación.",
        )

    sol.asignado_id = actor.id
    sol.tipo_asignacion = "auto_pool"
    sol.updated_at = datetime.now(timezone.utc)
    oc_db.add(sol)

    hist = HistorialMantenimiento(
        solicitud_id=sol.id,
        estado_anterior=sol.estado,
        estado_nuevo=sol.estado,
        nota=f"[POOL] Auto-asignado a {actor.full_name or actor.email}",
        usuario_id=actor.id,
        usuario_nombre=actor.full_name or actor.email,
    )
    oc_db.add(hist)
    oc_db.commit()
    oc_db.refresh(sol)
    log.info("Pool: %s auto-asignado a auxiliar %s", sol.consecutivo, actor.email)
    return sol
