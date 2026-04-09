from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.oc_database import get_oc_db
from app.models.oc import EstadoOC, SolicitudOC

router = APIRouter(prefix="/webhook", tags=["OC - Webhook"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NuevaSolicitudPayload(BaseModel):
    """Estructura que envía Power Automate al crear una solicitud nueva."""
    consecutivo_os: str
    descripcion: str
    cantidad: int
    nivel_prioridad: Optional[str] = "Media"
    solicitante_nombre: str
    solicitante_email: Optional[str] = None
    categoria: Optional[str] = None
    grupo_articulos: Optional[str] = None
    area: Optional[str] = None          # PA envía "area", lo mapeamos a area_solicitante
    sede: Optional[str] = None
    cliente: Optional[str] = None
    condicion: Optional[str] = None
    observaciones_solicitante: Optional[str] = None
    placa_ficha: Optional[str] = None
    fecha_proximo_mantenimiento: Optional[date] = None


class WebhookResponse(BaseModel):
    ok: bool
    solicitud_id: str
    consecutivo_os: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _verify_secret(x_pa_secret: Optional[str]) -> None:
    """Valida el secret de PA si está configurado en el entorno."""
    secret = settings.oc_webhook_secret
    if not secret:
        return  # Sin secret configurado, acepta cualquier llamada (útil en dev)
    if x_pa_secret != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Secret de webhook inválido.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/nueva-solicitud",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
)
def nueva_solicitud(
    payload: NuevaSolicitudPayload,
    x_pa_secret: Optional[str] = Header(default=None),
    oc_db: Session = Depends(get_oc_db),
):
    """
    Power Automate llama este endpoint cuando hay un ítem nuevo
    en el List de Compras de SharePoint.
    """
    _verify_secret(x_pa_secret)

    # Evitar duplicados por consecutivo_os
    existing = oc_db.exec(
        select(SolicitudOC).where(SolicitudOC.consecutivo_os == payload.consecutivo_os)
    ).first()
    if existing:
        return WebhookResponse(
            ok=True,
            solicitud_id=str(existing.id),
            consecutivo_os=existing.consecutivo_os,
        )

    solicitud = SolicitudOC(
        consecutivo_os=payload.consecutivo_os,
        descripcion=payload.descripcion,
        cantidad=payload.cantidad,
        nivel_prioridad=payload.nivel_prioridad or "Media",
        solicitante_nombre=payload.solicitante_nombre,
        solicitante_email=payload.solicitante_email,
        categoria=payload.categoria,
        grupo_articulos=payload.grupo_articulos,
        area_solicitante=payload.area,       # mapeo: "area" → area_solicitante
        sede=payload.sede,
        cliente=payload.cliente,
        condicion=payload.condicion,
        observaciones_solicitante=payload.observaciones_solicitante,
        placa_ficha=payload.placa_ficha,
        fecha_proximo_mantenimiento=payload.fecha_proximo_mantenimiento,
        estado=EstadoOC.nueva,
        fecha_solicitud=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    oc_db.add(solicitud)
    oc_db.commit()
    oc_db.refresh(solicitud)

    print(f"[webhook] Nueva solicitud recibida: {solicitud.consecutivo_os} — {solicitud.id}")

    return WebhookResponse(
        ok=True,
        solicitud_id=str(solicitud.id),
        consecutivo_os=solicitud.consecutivo_os,
    )
