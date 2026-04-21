"""
Router ZYMO Core — endpoints del agente gerencial.

Prefijo: /api/zymo
Acceso: admin, gerente (require_gerencial)
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, desc, select

from app.agent_database import ZymoReporte, get_agents_db
from app.agents.zymo_core import ZymoCore
from app.config import settings
from app.core.deps import get_current_user, require_gerencial
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zymo", tags=["ZYMO Core"])


def _get_zymo() -> ZymoCore:
    api_key = settings.gemini_api_key_gerencial
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY_GERENCIAL no configurada.",
        )
    return ZymoCore(api_key=api_key)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatPayload(BaseModel):
    mensaje: str
    session_id: Optional[str] = None
    historial: Optional[list[dict]] = None


class ReporteRead(BaseModel):
    id: str
    tipo: str
    contenido: str
    destinatario: str
    leido: bool
    created_at: str

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat_zymo(
    payload: ChatPayload,
    current_user: User = Depends(require_gerencial),
):
    """
    Chat con ZYMO Core — streaming SSE.
    Solo accesible para roles: admin, gerente.
    """
    zymo = _get_zymo()

    if not payload.session_id:
        zymo.iniciar_sesion(user_id=current_user.id, user_email=current_user.email)

    async def generar_stream():
        try:
            zymo.guardar_turno_md(current_user.email, "user", payload.mensaje)
            respuesta_completa = []
            async for chunk in zymo.chat_stream(
                payload.mensaje,
                historial=payload.historial,
            ):
                respuesta_completa.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            zymo.guardar_turno_md(current_user.email, "agent", "".join(respuesta_completa))
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error("Error en stream ZYMO: %s", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generar_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/reportes", response_model=list[ReporteRead])
def listar_reportes(
    tipo: Optional[str] = Query(default=None),
    destinatario: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_agents_db),
):
    """Lista reportes generados por ZYMO Core, ordenados del más reciente."""
    query = select(ZymoReporte)
    if tipo:
        query = query.where(ZymoReporte.tipo == tipo)
    if destinatario:
        query = query.where(ZymoReporte.destinatario == destinatario)
    query = query.order_by(desc(ZymoReporte.created_at)).offset(skip).limit(limit)
    reportes = db.exec(query).all()
    return [
        ReporteRead(
            id=r.id,
            tipo=r.tipo,
            contenido=r.contenido,
            destinatario=r.destinatario,
            leido=r.leido,
            created_at=r.created_at.isoformat(),
        )
        for r in reportes
    ]


@router.get("/reportes/ultimo")
def ultimo_reporte(
    destinatario: str = Query(default="gerente"),
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_agents_db),
):
    """Retorna el reporte más reciente para mostrar al login del gerente."""
    reporte = db.exec(
        select(ZymoReporte)
        .where(ZymoReporte.destinatario == destinatario)
        .order_by(desc(ZymoReporte.created_at))
    ).first()

    if not reporte:
        return {"reporte": None, "mensaje": "No hay reportes generados aún."}

    # Marcar como leído
    reporte.leido = True
    db.add(reporte)
    db.commit()

    return {
        "id": reporte.id,
        "tipo": reporte.tipo,
        "contenido": reporte.contenido,
        "leido": True,
        "created_at": reporte.created_at.isoformat(),
    }


@router.patch("/reportes/{reporte_id}/marcar-leido")
def marcar_leido(
    reporte_id: str,
    current_user: User = Depends(require_gerencial),
    db: Session = Depends(get_agents_db),
):
    """Marca un reporte como leído."""
    reporte = db.get(ZymoReporte, reporte_id)
    if not reporte:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    reporte.leido = True
    db.add(reporte)
    db.commit()
    return {"ok": True}


@router.get("/estado-intranet")
def estado_intranet(
    current_user: User = Depends(require_gerencial),
):
    """
    Snapshot completo del estado actual de la plataforma.
    Incluye KPIs OC, alertas activas y tiempos de proceso.
    """
    zymo = _get_zymo()
    return zymo.obtener_estado_intranet()


@router.get("/actividad-administrativa")
def actividad_administrativa(
    limite: int = Query(default=20, le=100),
    current_user: User = Depends(require_gerencial),
):
    """
    Actividad reciente del Agente Administrativo (acciones de Sonia y su agente).
    ZYMO usa esto para dar feedback al gerente sobre qué está pasando en el área administrativa.
    """
    zymo = _get_zymo()
    acciones = zymo.leer_acciones_administrativo(limite=limite)
    resumen = zymo.resumen_actividad_administrativa()
    return {
        "resumen": resumen,
        "acciones": acciones,
        "total": len(acciones),
    }


@router.post("/ronda-manual")
async def ronda_manual(
    current_user: User = Depends(require_gerencial),
):
    """
    Dispara manualmente una ronda supervisora.
    Útil para obtener un reporte en cualquier momento sin esperar las 2 horas.
    """
    zymo = _get_zymo()
    reporte = await zymo.ronda_supervisora()
    return {"reporte": reporte}
