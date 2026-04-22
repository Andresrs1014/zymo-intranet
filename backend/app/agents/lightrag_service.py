"""
Servicio LightRAG — Motor RAG basado en grafos para los agentes ZYMO.

Singleton lazy: se inicializa la primera vez que se necesita.
Usa google-genai (nuevo SDK, v1) para LLM y embeddings.

Control de rate limits Gemini:
  - Semáforo global (_gemini_sem): serializa las llamadas a la API (1 a la vez)
  - Pausa fija entre llamadas para no agotar el quota de requests/minuto
  - tenacity: reintenta automáticamente con backoff exponencial en errores 429
"""
import asyncio
import logging
from pathlib import Path
from typing import Optional

from tenacity import AsyncRetrying, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

_rag: Optional[object] = None
_rag_lock: Optional[asyncio.Lock] = None

# Pausa entre llamadas (LightRAG ya serializa con max_async=1, esto añade cortesía extra)
_PAUSA_LLM_SEG = 1.5
_PAUSA_EMBED_SEG = 0.5


def _get_lock() -> asyncio.Lock:
    global _rag_lock
    if _rag_lock is None:
        _rag_lock = asyncio.Lock()
    return _rag_lock


def _es_429(exc: BaseException) -> bool:
    """Detecta errores de rate limit / quota agotada de Gemini."""
    msg = str(exc).lower()
    return any(k in msg for k in ("429", "quota", "resource_exhausted", "rate_limit", "rateerror"))


# ── Clientes Gemini ────────────────────────────────────────────────────────────

def _llm_client(api_key: str):
    from google import genai
    return genai.Client(api_key=api_key, http_options={"api_version": "v1"})


def _embed_client(api_key: str):
    from google import genai
    return genai.Client(api_key=api_key)  # v1beta por defecto — gemini-embedding-001 vive aquí


# ── Funciones Gemini con rate-limit control ────────────────────────────────────

async def _llm_func(prompt: str, system_prompt: str | None = None, history_messages: list = [], **kwargs) -> str:
    """
    LLM callable que LightRAG usa para razonamiento y extracción de entidades.
    La concurrencia se controla desde LightRAG (llm_model_max_async=1).
    Tenacity reintenta en 429 respetando el worker timeout de LightRAG (360s).
    """
    from app.config import settings

    client = _llm_client(settings.gemini_api_key_gerencial or settings.gemini_api_key_administrativo)
    contenido = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

    await asyncio.sleep(_PAUSA_LLM_SEG)
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=2, min=10, max=90),
        retry=retry_if_exception(_es_429),
        reraise=True,
    ):
        with attempt:
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=contenido,
            )
            return response.text


async def _embed_func(texts: list[str]) -> "np.ndarray":
    """
    Embedding callable que LightRAG usa para búsqueda semántica.
    La concurrencia se controla desde LightRAG (embedding_func_max_async=1).
    Tenacity reintenta en 429 respetando el worker timeout de LightRAG (60s).
    """
    import numpy as np
    from app.config import settings

    client = _embed_client(settings.gemini_api_key_gerencial or settings.gemini_api_key_administrativo)
    embeddings = []

    for text in texts:
        await asyncio.sleep(_PAUSA_EMBED_SEG)
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=5, max=20),
            retry=retry_if_exception(_es_429),
            reraise=True,
        ):
            with attempt:
                response = await client.aio.models.embed_content(
                    model="gemini-embedding-001",
                    contents=text,
                )
                embeddings.append(response.embeddings[0].values)

    return np.array(embeddings)


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
                llm_model_max_async=1,
                embedding_func=EmbeddingFunc(
                    embedding_dim=3072,
                    max_token_size=2048,
                    func=_embed_func,
                ),
                embedding_func_max_async=1,
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
