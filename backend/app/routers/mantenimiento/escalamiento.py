"""Escalamiento interno → externo desde campo."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.oc_database import get_oc_db
from app.routers.mantenimiento.pares_externos import ParExternoOut, _par_out
from app.routers.mantenimiento.solicitudes import SolicitudMantenimientoOut, _enriquecer
from app.services.mnt_escalamiento import escalar_interno_a_externo

log = logging.getLogger(__name__)
router = APIRouter(tags=["Mantenimiento - Escalamiento"])


class EscalarExternoBody(BaseModel):
    motivo:          str
    evidencia_url:   Optional[str] = None
    evidencia_urls:  Optional[list[str]] = None


class EscalarExternoOut(BaseModel):
    mantenimiento: SolicitudMantenimientoOut
    par:           ParExternoOut


@router.post("/solicitudes/{solicitud_id}/escalar-externo", response_model=EscalarExternoOut)
def escalar_a_externo(
    solicitud_id: int,
    body: EscalarExternoBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.mantenimiento import SolicitudMantenimiento
    from fastapi import HTTPException

    mnt = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not mnt:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    mnt, oc = escalar_interno_a_externo(
        oc_db,
        mnt,
        current_user,
        body.motivo,
        body.evidencia_url,
        body.evidencia_urls,
    )
    user_ids = {mnt.solicitante_id, current_user.id}
    if mnt.asignado_id:
        user_ids.add(mnt.asignado_id)
    users = app_db.exec(select(User).where(User.id.in_(list(user_ids)))).all()
    users_by_id = {u.id: u for u in users}
    return EscalarExternoOut(
        mantenimiento=_enriquecer(mnt, users_by_id, oc_db=oc_db),
        par=_par_out(mnt, oc),
    )
