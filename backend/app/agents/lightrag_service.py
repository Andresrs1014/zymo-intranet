"""
Servicio LightRAG — Motor RAG basado en grafos para los agentes ZYMO.

Singleton lazy: se inicializa la primera vez que se necesita.
Usa google-genai (nuevo SDK, v1) para LLM y embeddings.
"""
import asyncio
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_rag: Optional[object] = None
_rag_lock: Optional[asyncio.Lock] = None


def _get_lock() -> asyncio.Lock:
    global _rag_lock
    if _rag_lock is None:
        _rag_lock = asyncio.Lock()
    return _rag_lock


# ── Funciones Gemini para LightRAG ────────────────────────────────────────────

async def _llm_func(prompt: str, system_prompt: str | None = None, history_messages: list = [], **kwargs) -> str:
    """LLM callable que LightRAG usa para razonamiento y extracción de entidades."""
    from google import genai
    from app.config import settings

    client = genai.Client(api_key=settings.gemini_api_key_gerencial or settings.gemini_api_key_administrativo)
    contenido = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=contenido,
    )
    return response.text


async def _embed_func(texts: list[str]) -> list[list[float]]:
    """Embedding callable que LightRAG usa para búsqueda semántica."""
    from google import genai
    from app.config import settings

    client = genai.Client(api_key=settings.gemini_api_key_gerencial or settings.gemini_api_key_administrativo)
    embeddings = []
    for text in texts:
        response = await client.aio.models.embed_content(
            model="models/text-embedding-004",
            contents=text[:8000],
        )
        embeddings.append(response.embeddings[0].values)
    return embeddings


# ── Singleton ──────────────────────────────────────────────────────────────────

async def get_rag():
    """Retorna el singleton de LightRAG, inicializándolo si es necesario."""
    global _rag

    async with _get_lock():
        if _rag is not None:
            return _rag

        try:
            from lightrag import LightRAG
            from lightrag.utils import EmbeddingFunc
        except ImportError:
            logger.error(
                "lightrag-hku no está instalado. "
                "Ejecutar: pip install lightrag-hku>=1.3.0"
            )
            return None

        from app.config import settings

        working_dir = settings.lightrag_working_dir
        Path(working_dir).mkdir(parents=True, exist_ok=True)

        try:
            instancia = LightRAG(
                working_dir=working_dir,
                llm_model_func=_llm_func,
                embedding_func=EmbeddingFunc(
                    embedding_dim=768,
                    max_token_size=8192,
                    func=_embed_func,
                ),
            )
            await instancia.initialize_storages()
            _rag = instancia
            logger.info("LightRAG inicializado en %s", working_dir)
        except Exception as e:
            logger.error("Error inicializando LightRAG: %s", e)
            return None

    return _rag


# ── API pública ────────────────────────────────────────────────────────────────

async def indexar_texto(texto: str) -> bool:
    """Inserta un texto en el grafo de conocimiento."""
    rag = await get_rag()
    if not rag:
        return False
    try:
        await rag.ainsert(texto)
        return True
    except Exception as e:
        logger.error("Error indexando en LightRAG: %s", e)
        return False


async def buscar_conocimiento(query: str, modo: str = "mix") -> str:
    """
    Consulta el grafo de conocimiento.

    Modos:
    - "local"  → nodos directamente relacionados (preciso, rápido)
    - "global" → patrones en todo el grafo (vista amplia)
    - "mix"    → combina ambos (recomendado)
    """
    rag = await get_rag()
    if not rag:
        return "Sistema RAG no disponible — verificar instalación de lightrag-hku."
    try:
        from lightrag import QueryParam
        resultado = await rag.aquery(query, param=QueryParam(mode=modo))
        return resultado if isinstance(resultado, str) else str(resultado)
    except Exception as e:
        logger.error("Error consultando LightRAG: %s", e)
        return f"Error en búsqueda: {e}"
