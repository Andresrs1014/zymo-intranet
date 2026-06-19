import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.models.mantenimiento import MntAprobacion, SolicitudMantenimiento
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)
router = APIRouter(tags=["Mantenimiento - Aprobaciones"])

_ROLES_APROBACION = {"dir_administrativa", "gerencia_operaciones", "gerencia_general"}


class AprobacionBody(BaseModel):
    rol_aprobador: str
    nota:          Optional[str] = None


class AprobacionOut(BaseModel):
    id:               int
    solicitud_id:     int
    aprobador_nombre: str
    rol_aprobador:    str
    aprobado:         bool
    nota:             Optional[str]
    fecha:            str


@router.post(
    "/solicitudes/{solicitud_id}/aprobacion",
    status_code=status.HTTP_201_CREATED,
    response_model=AprobacionOut,
)
def registrar_aprobacion(
    solicitud_id: int,
    body: AprobacionBody,
    oc_db: Session = Depends(get_oc_db),
    current_user: User = Depends(get_current_user),
):
    if body.rol_aprobador not in _ROLES_APROBACION:
        raise HTTPException(
            status_code=400,
            detail=f"rol_aprobador inválido. Permitidos: {sorted(_ROLES_APROBACION)}",
        )

    sol = oc_db.get(SolicitudMantenimiento, solicitud_id)
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    ya_existe = oc_db.exec(
        select(MntAprobacion).where(
            MntAprobacion.solicitud_id == solicitud_id,
            MntAprobacion.rol_aprobador == body.rol_aprobador,
        )
    ).first()
    if ya_existe:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe una aprobación con rol '{body.rol_aprobador}' para esta solicitud.",
        )

    aprobacion = MntAprobacion(
        solicitud_id=solicitud_id,
        aprobador_id=current_user.id,
        aprobador_nombre=current_user.full_name or current_user.email,
        rol_aprobador=body.rol_aprobador,
        aprobado=True,
        nota=body.nota,
    )
    oc_db.add(aprobacion)
    oc_db.commit()
    oc_db.refresh(aprobacion)

    log.info("Aprobación: solicitud %s, rol %s, por %s", solicitud_id, body.rol_aprobador, current_user.email)
    return AprobacionOut(
        id=aprobacion.id,
        solicitud_id=aprobacion.solicitud_id,
        aprobador_nombre=aprobacion.aprobador_nombre,
        rol_aprobador=aprobacion.rol_aprobador,
        aprobado=aprobacion.aprobado,
        nota=aprobacion.nota,
        fecha=aprobacion.fecha.isoformat(),
    )


@router.get("/solicitudes/{solicitud_id}/aprobaciones", response_model=list[AprobacionOut])
def listar_aprobaciones(
    solicitud_id: int,
    oc_db: Session = Depends(get_oc_db),
    _: User = Depends(get_current_user),
):
    items = oc_db.exec(
        select(MntAprobacion)
        .where(MntAprobacion.solicitud_id == solicitud_id)
        .order_by(MntAprobacion.fecha.asc())
    ).all()
    return [
        AprobacionOut(
            id=a.id,
            solicitud_id=a.solicitud_id,
            aprobador_nombre=a.aprobador_nombre,
            rol_aprobador=a.rol_aprobador,
            aprobado=a.aprobado,
            nota=a.nota,
            fecha=a.fecha.isoformat(),
        )
        for a in items
    ]
