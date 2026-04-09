import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.oc_database import get_oc_db
from app.models.oc import EstadoOC, SolicitudOC
from app.models.user import User

router = APIRouter(prefix="/solicitudes", tags=["OC - Solicitudes"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SolicitudRead(BaseModel):
    id: uuid.UUID
    consecutivo_os: str
    descripcion: str
    categoria: Optional[str]
    grupo_articulos: Optional[str]
    cantidad: int
    nivel_prioridad: str
    solicitante_nombre: str
    solicitante_email: Optional[str]
    area_solicitante: Optional[str]
    sede: Optional[str]
    cliente: Optional[str]
    condicion: Optional[str]
    observaciones_solicitante: Optional[str]
    placa_ficha: Optional[str]
    estado: str
    auxiliar_id: Optional[int]
    fecha_solicitud: datetime
    fecha_cotizacion: Optional[datetime]
    fecha_aprobacion: Optional[datetime]
    fecha_envio_oc: Optional[datetime]
    fecha_recibido: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AsignarPayload(BaseModel):
    auxiliar_id: int


class EstadoPayload(BaseModel):
    estado: EstadoOC


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SolicitudRead])
def list_solicitudes(
    estado: Optional[str] = Query(default=None),
    sede: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    query = select(SolicitudOC)
    if estado:
        query = query.where(SolicitudOC.estado == estado)
    if sede:
        query = query.where(SolicitudOC.sede == sede)
    query = query.order_by(SolicitudOC.fecha_solicitud.desc()).offset(skip).limit(limit)
    return oc_db.exec(query).all()


@router.get("/{solicitud_id}", response_model=SolicitudRead)
def get_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    return solicitud


@router.patch("/{solicitud_id}/asignar", response_model=SolicitudRead)
def asignar_auxiliar(
    solicitud_id: uuid.UUID,
    payload: AsignarPayload,
    current_user: User = Depends(require_compras),
    db: Session = Depends(get_db),       # intranet.db — para validar que el user existe
    oc_db: Session = Depends(get_oc_db), # oc.db — para actualizar la solicitud
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    auxiliar = db.get(User, payload.auxiliar_id)
    if not auxiliar or not auxiliar.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado o inactivo.")

    solicitud.auxiliar_id = payload.auxiliar_id
    if solicitud.estado == EstadoOC.nueva:
        solicitud.estado = EstadoOC.en_cotizacion
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()
    oc_db.refresh(solicitud)
    return solicitud


@router.patch("/{solicitud_id}/estado", response_model=SolicitudRead)
def cambiar_estado(
    solicitud_id: uuid.UUID,
    payload: EstadoPayload,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    solicitud.estado = payload.estado
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()
    oc_db.refresh(solicitud)
    return solicitud
