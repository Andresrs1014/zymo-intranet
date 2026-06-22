"""Pares externos MNT ↔ OC — bandeja y asignación acoplada para compras."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.models.mantenimiento import SolicitudMantenimiento
from app.models.oc import SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db
from app.services.mnt_pares_externos import (
    asignar_par_externo,
    crear_oc_servicio_externo,
    oc_par_de_mnt,
)

log = logging.getLogger(__name__)
router = APIRouter(tags=["Mantenimiento - Pares externos"])


class OCParResumen(BaseModel):
    id:             str
    consecutivo_os: str
    estado:         str
    auxiliar_id:    Optional[int]


class ParExternoOut(BaseModel):
    mantenimiento_id:          int
    consecutivo_mnt:           str
    titulo:                    str
    estado_mnt:                str
    modalidad:                 str
    coordinador_compras_id:    Optional[int]
    asignado_mantenimiento_id: Optional[int]
    oc:                        Optional[OCParResumen]


class AsignarParBody(BaseModel):
    coordinador_compras_id:    Optional[int] = None
    asignado_mantenimiento_id: Optional[int] = None


class MantenimientoVinculadoOut(BaseModel):
    id:          int
    consecutivo: str
    titulo:      str
    estado:      str
    modalidad:   str
    url_path:    str


def _par_out(mnt: SolicitudMantenimiento, oc: Optional[SolicitudOC]) -> ParExternoOut:
    oc_res = None
    if oc:
        oc_res = OCParResumen(
            id=str(oc.id),
            consecutivo_os=oc.consecutivo_os,
            estado=oc.estado,
            auxiliar_id=oc.auxiliar_id,
        )
    return ParExternoOut(
        mantenimiento_id=mnt.id,
        consecutivo_mnt=mnt.consecutivo,
        titulo=mnt.titulo,
        estado_mnt=mnt.estado,
        modalidad=mnt.modalidad,
        coordinador_compras_id=getattr(mnt, "coordinador_compras_id", None),
        asignado_mantenimiento_id=mnt.asignado_id,
        oc=oc_res,
    )


@router.get("/pares-externos", response_model=list[ParExternoOut])
def listar_pares_externos(
    solo_pendientes: bool = True,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(require_compras),
):
    """Bandeja de pares externos para auxiliar de compras."""
    stmt = select(SolicitudMantenimiento).where(
        SolicitudMantenimiento.modalidad == "externo",
    )
    if solo_pendientes:
        stmt = stmt.where(SolicitudMantenimiento.coordinador_compras_id == None)  # noqa: E711
    items = oc_db.exec(stmt.order_by(SolicitudMantenimiento.created_at.desc())).all()
    return [_par_out(m, oc_par_de_mnt(oc_db, m)) for m in items]


@router.get("/pares-externos/mios", response_model=list[ParExternoOut])
def listar_mis_pares_externos(
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(require_compras),
):
    items = oc_db.exec(
        select(SolicitudMantenimiento)
        .where(
            SolicitudMantenimiento.modalidad == "externo",
            SolicitudMantenimiento.coordinador_compras_id == current_user.id,
        )
        .order_by(SolicitudMantenimiento.updated_at.desc())
    ).all()
    return [_par_out(m, oc_par_de_mnt(oc_db, m)) for m in items]


@router.get("/solicitudes/{solicitud_id}/par-externo", response_model=ParExternoOut)
def obtener_par_externo(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(get_current_user),
):
    mnt = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not mnt:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    if mnt.modalidad != "externo":
        raise HTTPException(status_code=400, detail="No es una solicitud externa.")
    return _par_out(mnt, oc_par_de_mnt(oc_db, mnt))


@router.post("/solicitudes/{solicitud_id}/asignar-par", response_model=ParExternoOut)
def asignar_par_desde_mnt(
    solicitud_id: int,
    body: AsignarParBody,
    oc_db: Session = Depends(get_oc_db),
    app_db: Session = Depends(get_db),
    current_user: User = Depends(require_compras),
):
    mnt = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not mnt:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    coord_id = body.coordinador_compras_id or current_user.id
    coord = app_db.get(User, coord_id)
    if not coord or not coord.is_active:
        raise HTTPException(status_code=404, detail="Coordinador no encontrado.")

    if body.asignado_mantenimiento_id is not None:
        aux = app_db.get(User, body.asignado_mantenimiento_id)
        if not aux or not aux.is_active:
            raise HTTPException(status_code=404, detail="Auxiliar mantenimiento no encontrado.")

    if not oc_par_de_mnt(oc_db, mnt):
        crear_oc_servicio_externo(
            oc_db,
            mnt,
            current_user.full_name or current_user.email,
            current_user.email,
        )
        oc_db.refresh(mnt)

    mnt, oc = asignar_par_externo(
        oc_db,
        mnt,
        current_user,
        coord_id,
        body.asignado_mantenimiento_id,
    )
    log.info("Par externo asignado MNT %s ↔ OC %s por %s", mnt.consecutivo, oc.consecutivo_os, current_user.email)
    return _par_out(mnt, oc)
