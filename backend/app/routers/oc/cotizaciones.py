import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.oc_database import get_oc_db
from app.models.oc import CotizacionProveedor, EstadoOC, SolicitudOC
from app.models.user import User
from app.services.email_service import send_aprobacion_directora, send_cotizacion_lista

router = APIRouter(tags=["OC - Cotizaciones"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CotizacionCreate(BaseModel):
    proveedor_nombre: str
    proveedor_email: Optional[str] = None
    numero_cotizacion_proveedor: Optional[str] = None
    valor_unitario: float
    valor_total: float
    fecha_vigencia: Optional[date] = None
    observaciones: Optional[str] = None


class CotizacionRead(BaseModel):
    id: uuid.UUID
    solicitud_id: uuid.UUID
    proveedor_nombre: str
    proveedor_email: Optional[str]
    numero_cotizacion_proveedor: Optional[str]
    valor_unitario: float
    valor_total: float
    fecha_vigencia: Optional[date]
    observaciones: Optional[str]
    pdf_path: Optional[str]
    extraccion_automatica: bool
    aprobada: Optional[bool]
    valor_aprobado: Optional[float]
    aprobado_por_id: Optional[int]
    observaciones_aprobacion: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AprobarPayload(BaseModel):
    valor_aprobado: float
    observaciones_aprobacion: Optional[str] = None


class RechazarPayload(BaseModel):
    observaciones_aprobacion: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/solicitudes/{solicitud_id}/cotizacion",
    response_model=CotizacionRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_cotizacion(
    solicitud_id: uuid.UUID,
    payload: CotizacionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    estados_validos = {EstadoOC.en_cotizacion, EstadoOC.rechazada}
    if solicitud.estado not in estados_validos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede cargar cotización en estado '{solicitud.estado}'.",
        )

    cotizacion = CotizacionProveedor(
        solicitud_id=solicitud_id,
        proveedor_nombre=payload.proveedor_nombre,
        proveedor_email=payload.proveedor_email,
        numero_cotizacion_proveedor=payload.numero_cotizacion_proveedor,
        valor_unitario=payload.valor_unitario,
        valor_total=payload.valor_total,
        fecha_vigencia=payload.fecha_vigencia,
        observaciones=payload.observaciones,
        extraccion_automatica=False,
        created_at=datetime.now(timezone.utc),
    )
    oc_db.add(cotizacion)

    # Avanzar estado de la solicitud a pendiente_aprobacion
    solicitud.estado = EstadoOC.pendiente_aprobacion
    solicitud.fecha_cotizacion = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    oc_db.commit()
    oc_db.refresh(cotizacion)

    # Disparar emails Flujo 2 y 3 (cotización lista → pendiente_aprobacion)
    background_tasks.add_task(send_cotizacion_lista, solicitud)
    background_tasks.add_task(send_aprobacion_directora, solicitud)

    return cotizacion


@router.get(
    "/solicitudes/{solicitud_id}/cotizaciones",
    response_model=list[CotizacionRead],
)
def listar_cotizaciones(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    cotizaciones = oc_db.exec(
        select(CotizacionProveedor)
        .where(CotizacionProveedor.solicitud_id == solicitud_id)
        .order_by(CotizacionProveedor.created_at.desc())
    ).all()
    return cotizaciones


@router.patch(
    "/cotizaciones/{cotizacion_id}/aprobar",
    response_model=CotizacionRead,
)
def aprobar_cotizacion(
    cotizacion_id: uuid.UUID,
    payload: AprobarPayload,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    if current_user.role not in ("admin", "directivo"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo directivo o admin pueden aprobar cotizaciones.",
        )

    cotizacion = oc_db.get(CotizacionProveedor, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada.")

    cotizacion.aprobada = True
    cotizacion.valor_aprobado = payload.valor_aprobado
    cotizacion.aprobado_por_id = current_user.id
    cotizacion.observaciones_aprobacion = payload.observaciones_aprobacion
    oc_db.add(cotizacion)

    # Avanzar estado de la solicitud
    solicitud = oc_db.get(SolicitudOC, cotizacion.solicitud_id)
    if solicitud:
        solicitud.estado = EstadoOC.aprobada
        solicitud.fecha_aprobacion = datetime.now(timezone.utc)
        solicitud.updated_at = datetime.now(timezone.utc)
        oc_db.add(solicitud)

    oc_db.commit()
    oc_db.refresh(cotizacion)
    return cotizacion


@router.patch(
    "/cotizaciones/{cotizacion_id}/rechazar",
    response_model=CotizacionRead,
)
def rechazar_cotizacion(
    cotizacion_id: uuid.UUID,
    payload: RechazarPayload,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    if current_user.role not in ("admin", "directivo"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo directivo o admin pueden rechazar cotizaciones.",
        )

    cotizacion = oc_db.get(CotizacionProveedor, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada.")

    cotizacion.aprobada = False
    cotizacion.aprobado_por_id = current_user.id
    cotizacion.observaciones_aprobacion = payload.observaciones_aprobacion
    oc_db.add(cotizacion)

    # Regresar solicitud a en_cotizacion para que el auxiliar busque otra cotización
    solicitud = oc_db.get(SolicitudOC, cotizacion.solicitud_id)
    if solicitud:
        solicitud.estado = EstadoOC.en_cotizacion
        solicitud.updated_at = datetime.now(timezone.utc)
        oc_db.add(solicitud)

    oc_db.commit()
    oc_db.refresh(cotizacion)
    return cotizacion
