from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.config import settings
from app.oc_database import get_oc_db
from app.models.oc import EstadoOC, SolicitudOC

router = APIRouter(prefix="/webhook", tags=["OC - Webhook"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NuevaSolicitudPayload(BaseModel):
    """Campos que llegan desde Microsoft Forms vía Power Automate."""
    categoria: Optional[str] = None
    grupo_articulos: Optional[str] = None
    descripcion: str
    evidencia_url: Optional[str] = None
    cantidad: int = 1
    cliente: Optional[str] = None
    condicion: Optional[str] = None
    solicitante_email: Optional[str] = None
    solicitante_nombre: str
    area_solicitante: Optional[str] = None
    plataforma: Optional[str] = None
    observaciones_solicitante: Optional[str] = None


class WebhookResponse(BaseModel):
    ok: bool
    solicitud_id: str
    consecutivo_os: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _verify_secret(x_pa_secret: Optional[str]) -> None:
    """Valida el secret de PA si está configurado en el entorno.

    - Producción sin secret configurado → rechaza toda llamada (fail-safe).
    - Desarrollo sin secret → acepta (permite pruebas locales sin PA).
    - Con secret configurado → valida siempre, independiente del entorno.
    """
    secret = settings.oc_webhook_secret
    if not secret:
        if settings.environment == "production":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Webhook no disponible: OC_WEBHOOK_SECRET no está configurado en producción.",
            )
        return  # dev sin secret: acepta
    if x_pa_secret != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Secret de webhook inválido.",
        )


def _generar_consecutivo(oc_db: Session) -> str:
    """Genera el próximo consecutivo OS-YYYY-XXXX basado en el año actual."""
    anio = datetime.now(timezone.utc).year
    prefijo = f"OS-{anio}-"

    # Cuenta cuántas solicitudes existen en el año actual
    total = oc_db.exec(
        select(func.count(SolicitudOC.id)).where(
            SolicitudOC.consecutivo_os.startswith(prefijo)
        )
    ).one()

    return f"{prefijo}{(total + 1):04d}"


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
    Power Automate llama este endpoint cuando el usuario envía el Forms.
    El consecutivo_os lo genera el backend automáticamente.
    """
    _verify_secret(x_pa_secret)

    # Retry loop para manejar race condition en consecutivos duplicados
    solicitud = None
    for _ in range(5):
        consecutivo = _generar_consecutivo(oc_db)
        candidato = SolicitudOC(
            consecutivo_os=consecutivo,
            descripcion=payload.descripcion,
            cantidad=payload.cantidad,
            nivel_prioridad="Media",
            solicitante_nombre=payload.solicitante_nombre,
            solicitante_email=payload.solicitante_email,
            categoria=payload.categoria,
            grupo_articulos=payload.grupo_articulos,
            area_solicitante=payload.area_solicitante,
            cliente=payload.cliente,
            condicion=payload.condicion,
            plataforma=payload.plataforma,
            observaciones_solicitante=payload.observaciones_solicitante,
            estado=EstadoOC.nueva,
            fecha_solicitud=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        try:
            oc_db.add(candidato)
            oc_db.commit()
            oc_db.refresh(candidato)
            solicitud = candidato
            break
        except IntegrityError:
            oc_db.rollback()

    if solicitud is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo generar un consecutivo único. Intenta de nuevo.",
        )

    print(f"[webhook] Nueva solicitud: {consecutivo} — {solicitud.id}")

    return WebhookResponse(
        ok=True,
        solicitud_id=str(solicitud.id),
        consecutivo_os=solicitud.consecutivo_os,
    )
