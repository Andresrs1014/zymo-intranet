"""
Router de Agentes IA — endpoints del sistema RAG y agentes ZYMO.

Prefijo: /api/agentes
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.tools.doc_tools import (
    buscar_en_conocimiento,
    eliminar_documento,
    listar_documentos,
    obtener_documento,
    subir_e_indexar,
)
from app.agents.tools import oc_tools
from app.config import settings
from app.core.deps import get_current_user, require_admin
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agentes", tags=["agentes"])

_EXTENSIONES_PERMITIDAS = {"md", "txt", "pdf", "docx"}
_TIPOS_VALIDOS = {"procedimiento", "instructivo", "politica"}
_AREAS_VALIDAS = {"administrativo", "sgc", "general"}


# ── Documentos RAG ─────────────────────────────────────────────────────────────

@router.post("/documentos/subir", status_code=status.HTTP_201_CREATED)
async def subir_documento(
    archivo: UploadFile = File(...),
    nombre: str = Form(...),
    tipo: str = Form(...),
    area: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """
    Sube un documento, extrae su texto e indexa en LightRAG.

    - **archivo**: PDF, Word (.docx), Markdown (.md) o texto plano (.txt)
    - **nombre**: Nombre descriptivo del documento (sin extensión)
    - **tipo**: procedimiento | instructivo | politica
    - **area**: administrativo | sgc | general
    """
    if tipo not in _TIPOS_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"tipo debe ser uno de: {', '.join(_TIPOS_VALIDOS)}",
        )
    if area not in _AREAS_VALIDAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"area debe ser una de: {', '.join(_AREAS_VALIDAS)}",
        )

    extension = (archivo.filename or "").rsplit(".", 1)[-1].lower()
    if extension not in _EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Formato no soportado. Permitidos: {', '.join(_EXTENSIONES_PERMITIDAS)}",
        )

    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    doc = await subir_e_indexar(
        nombre=nombre,
        extension=extension,
        contenido=contenido,
        tipo=tipo,
        area=area,
        subido_por_id=current_user.id,
    )

    return {
        "id": doc.id,
        "nombre": doc.nombre,
        "tipo": doc.tipo,
        "area": doc.area,
        "chunks_generados": doc.chunks_count,
        "indexado_at": doc.indexado_at,
        "status": "indexado" if doc.chunks_count > 0 else "guardado_sin_indexar",
    }


@router.get("/documentos/buscar")
async def buscar_documentos(
    q: str,
    area: Optional[str] = None,
    modo: str = "mix",
    current_user: User = Depends(get_current_user),
):
    """
    Busca en el grafo de conocimiento RAG.

    - **q**: Pregunta o término de búsqueda
    - **area**: Filtro por área (informativo — LightRAG busca en todo el grafo)
    - **modo**: local | global | mix (recomendado: mix)
    """
    if not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El parámetro 'q' no puede estar vacío.",
        )
    if modo not in ("local", "global", "mix"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="modo debe ser: local | global | mix",
        )

    resultado = await buscar_en_conocimiento(query=q, area=area, modo=modo)
    return resultado


@router.get("/documentos/listar")
def listar(
    area: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Lista todos los documentos indexados, opcionalmente filtrados por área."""
    docs = listar_documentos(area=area)
    return [
        {
            "id": d.id,
            "nombre": d.nombre,
            "tipo": d.tipo,
            "area": d.area,
            "chunks_count": d.chunks_count,
            "indexado_at": d.indexado_at,
            "subido_por_id": d.subido_por_id,
        }
        for d in docs
    ]


@router.delete("/documentos/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    doc_id: str,
    current_user: User = Depends(require_admin),
):
    """
    Elimina un documento de la BD y del sistema de archivos.
    Solo admin. Nota: el grafo LightRAG no soporta eliminación de nodos individuales.
    """
    doc = obtener_documento(doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Documento '{doc_id}' no encontrado.",
        )
    eliminar_documento(doc_id)


# ── Agente Administrativo ──────────────────────────────────────────────────────

class ChatPayload(BaseModel):
    mensaje: str
    session_id: Optional[str] = None
    historial: Optional[list[dict]] = None


def _get_agente_administrativo():
    """Instancia el agente administrativo con la API Key 2."""
    from app.agents.administrativo import AgenteAdministrativo
    api_key = settings.gemini_api_key_administrativo or settings.gemini_api_key_gerencial
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY_ADMINISTRATIVO no configurada.",
        )
    return AgenteAdministrativo(api_key=api_key)


@router.get("/administrativo/estado")
def estado_administrativo(
    current_user: User = Depends(get_current_user),
):
    """
    Resumen del área para la ventana flotante al login.
    Retorna KPIs y alertas del módulo OC.
    """
    try:
        kpis = oc_tools.ver_kpis_oc()
        cotizaciones_pendientes = oc_tools.consultar_cotizaciones_pendientes()
        return {
            "solicitudes_activas": kpis.get("total_activas", 0),
            "por_estado": kpis.get("solicitudes_por_estado", {}),
            "cotizaciones_pendientes_aprobacion": len(cotizaciones_pendientes),
            "cotizaciones_mas_48h": sum(1 for c in cotizaciones_pendientes if c.get("supera_limite_48h")),
            "alertas": kpis.get("alertas", []),
        }
    except Exception as e:
        logger.error("Error en estado_administrativo: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/administrativo/chat")
async def chat_administrativo(
    payload: ChatPayload,
    current_user: User = Depends(get_current_user),
):
    """
    Chat con el Agente Administrativo ZYMO (streaming SSE).
    Responde como stream de Server-Sent Events.
    """
    agente = _get_agente_administrativo()

    # Iniciar sesión si no viene session_id
    if not payload.session_id:
        agente.iniciar_sesion(user_id=current_user.id, user_email=current_user.email)

    async def generar_stream():
        try:
            async for chunk in agente.chat_stream(
                payload.mensaje,
                historial=payload.historial,
            ):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error("Error en stream administrativo: %s", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generar_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Desactiva buffering en nginx
        },
    )


@router.post("/administrativo/bienvenida")
async def bienvenida_administrativo(
    current_user: User = Depends(get_current_user),
):
    """
    Genera el mensaje de bienvenida personalizado al login.
    Se llama una vez cuando el usuario inicia sesión.
    """
    agente = _get_agente_administrativo()
    mensaje = await agente.generar_bienvenida(current_user.full_name)
    estado = oc_tools.ver_kpis_oc()
    return {
        "mensaje": mensaje,
        "alertas": estado.get("alertas", []),
        "cotizaciones_pendientes": estado.get("cotizaciones_pendientes_aprobacion", 0),
    }


@router.get("/administrativo/sugerencias")
def sugerencias_administrativo(
    current_user: User = Depends(get_current_user),
):
    """
    Retorna sugerencias activas generadas automáticamente.
    El worker (APScheduler) las genera cada 30 min — se implementa en Día 5.
    Por ahora retorna sugerencias calculadas en tiempo real.
    """
    cotizaciones = oc_tools.consultar_cotizaciones_pendientes()
    tiempos = oc_tools.ver_tiempos_proceso_oc()

    sugerencias = []
    for cot in cotizaciones:
        if cot.get("supera_limite_48h"):
            sugerencias.append({
                "tipo": "alerta_tiempo",
                "prioridad": "alta",
                "texto": f"La cotización de {cot['proveedor_nombre']} para '{cot['descripcion']}' lleva {cot['horas_esperando']}h esperando aprobación.",
                "accion_sugerida": "Revisar y aprobar o rechazar la cotización.",
            })

    for alerta in tiempos.get("alertas_tiempo", []):
        sugerencias.append({
            "tipo": "tiempo_proceso",
            "prioridad": "media",
            "texto": alerta,
            "accion_sugerida": "Revisar las solicitudes en esa etapa.",
        })

    return {"sugerencias": sugerencias, "total": len(sugerencias)}
