"""
Router de Agentes IA — endpoints del sistema RAG y agentes ZYMO.

Prefijo: /api/agentes
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.agents.tools.doc_tools import (
    buscar_en_conocimiento,
    eliminar_documento,
    listar_documentos,
    obtener_documento,
    subir_e_indexar,
)
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
