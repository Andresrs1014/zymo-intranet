"""
sig_ia.py — Chat, edición con IA y LightRAG del SIG.

La rúbrica y el análisis por LLM del servidor (coherencia, mejoras,
proc-vs-inst, cargos, análisis completo) se retiraron de la intranet —
esa responsabilidad pasa completa al MCP-001 (el agente externo trae su
propia rúbrica y su propia suscripción de LLM). La intranet SIG queda
solo como repositorio de archivos + lugar donde el agente deposita
hallazgos/cierres/mejoras (ver sig-backend/src/routers/auditorias.ts).

La API key de Anthropic/Gemini vive ÚNICAMENTE en el backend de la intranet,
y solo la usan las features que quedan acá: chat, edición con IA y LightRAG.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.core.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sig-ia", tags=["sig-ia"])


def _strip_base64_blobs(text: str) -> str:
    """Remove embedded base64 blobs (images/files) — keeps document text readable."""
    return re.sub(r'[A-Za-z0-9+/]{200,}={0,2}', '[imagen]', text)


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(..., max_length=20)
    system: str | None = Field(default=None, max_length=500)
    modelo: str = Field(default="claude", pattern=r"^(claude|gemini)$")


# ── Parsing de respuestas JSON del LLM (compartido por editar-con-ia) ──────────

def _sanitize_json_string(json_str: str) -> str:
    """Escapa saltos de línea y tabs literales dentro de strings JSON."""
    result: list[str] = []
    in_string = False
    escape_next = False
    for ch in json_str:
        if escape_next:
            result.append(ch)
            escape_next = False
        elif ch == "\\":
            result.append(ch)
            escape_next = True
        elif ch == '"':
            in_string = not in_string
            result.append(ch)
        elif in_string and ch == "\n":
            result.append("\\n")
        elif in_string and ch == "\r":
            result.append("\\r")
        elif in_string and ch == "\t":
            result.append("\\t")
        else:
            result.append(ch)
    return "".join(result)


def _parse_response(raw: str, req: Any = None) -> dict[str, Any]:
    clean = re.sub(r"^```json\s*", "", raw, flags=re.IGNORECASE)
    clean = re.sub(r"^```\s*", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean).strip()
    start = clean.find("{")
    end = clean.rfind("}")
    if start < 0 or end < 0:
        raise ValueError(f"Claude no devolvió JSON válido: {raw[:300]}")
    json_str = clean[start : end + 1]

    # Intento 1: JSON estándar
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as exc:
        logger.warning("[sig-ia] JSON inválido en char %d, intentando reparar…", exc.pos)

    # Intento 2: escapar control chars literales (\n, \r, \t dentro de strings)
    sanitized = _sanitize_json_string(json_str)
    try:
        return json.loads(sanitized)
    except json.JSONDecodeError:
        pass

    # Intento 3: json-repair (maneja comillas, backslashes y truncamientos)
    try:
        from json_repair import repair_json  # type: ignore[import]
        repaired = repair_json(sanitized, return_objects=True)
        if isinstance(repaired, dict) and repaired:
            logger.info("[sig-ia] JSON reparado con json-repair")
            return repaired  # type: ignore[return-value]
    except Exception as repair_exc:
        logger.warning("[sig-ia] json-repair falló: %s", repair_exc)

    raise ValueError(
        f"Claude no devolvió JSON válido (char {json_str.find(json_str[8000:8100] if len(json_str) > 8000 else '')}) — "
        f"primeros 300 chars: {json_str[:300]}"
    )


# ── Job store en memoria (se limpia al reiniciar el contenedor) ───────────────
# { job_id: { status: "pending"|"done"|"error", data?: pkg, error?: str } }
_jobs: dict[str, dict[str, Any]] = {}


@router.get("/job/{job_id}")
async def get_job(
    job_id: str,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Consulta el estado de un job de análisis."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return {"ok": True, **job}


@router.post("/chat")
async def chat_sig_ia(
    body: ChatRequest,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Proxy de chat a Claude o Gemini según el campo `modelo`."""
    if body.modelo == "gemini":
        if not settings.gemini_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GEMINI_API_KEY no configurada en el servidor.",
            )
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.gemini_api_key)
            system_txt = body.system or "Eres un asistente útil y conciso. Responde en español."
            model = genai.GenerativeModel(
                settings.gemini_model,
                system_instruction=system_txt,
            )
            # Convertir historial al formato Gemini
            history = []
            messages_to_send = body.messages
            if messages_to_send and messages_to_send[-1]["role"] == "user":
                messages_to_send = messages_to_send[:-1]
                last_user_msg = body.messages[-1]["content"]
            else:
                last_user_msg = ""

            for m in messages_to_send:
                role = "user" if m["role"] == "user" else "model"
                history.append({"role": role, "parts": [m["content"]]})

            chat = model.start_chat(history=history)
            response = chat.send_message(last_user_msg)
            text = response.text
            return {"ok": True, "content": text, "tokens": 0, "modelo": "gemini"}

        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Librería 'google-generativeai' no instalada en el backend.",
            )
        except Exception as exc:
            logger.exception("[sig-ia/chat/gemini] Error")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    # Default: Claude
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANTHROPIC_API_KEY no configurada en el servidor.",
        )
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        kwargs: dict[str, Any] = {
            "model": settings.anthropic_model,
            "max_tokens": 4096,
            "messages": body.messages,
        }
        if body.system:
            kwargs["system"] = body.system
        response = client.messages.create(**kwargs)
        return {"ok": True, "content": response.content[0].text, "tokens": response.usage.output_tokens, "modelo": "claude"}

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Librería 'anthropic' no instalada en el backend.",
        )
    except Exception as exc:
        logger.exception("[sig-ia/chat/claude] Error")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/estado")
async def estado(
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Verifica si el análisis Claude está disponible."""
    return {
        "ok": True,
        "claude_disponible": bool(settings.anthropic_api_key),
        "modelo": settings.anthropic_model if settings.anthropic_api_key else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Edición con IA — edición quirúrgica desde la intranet
# ══════════════════════════════════════════════════════════════════════════════

class EditarConIARequest(BaseModel):
    procedimientoId: int
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    contenidoActual: str = Field(..., min_length=10, max_length=40_000)
    instruccion: str = Field(..., min_length=5, max_length=2000)


def _build_editar_system() -> str:
    return """Eres el agente de edición de procedimientos del SIG (ZYMO).
Recibes un procedimiento en markdown y una instrucción de edición específica del usuario.
Tu tarea es aplicar ÚNICAMENTE los cambios solicitados, dejando el resto del documento intacto.

Responde ÚNICAMENTE con JSON válido (sin markdown fence):
{
  "contenidoEditado": "# CÓDIGO\\n\\n## Objetivo\\n...",
  "resumen": "Descripción en 2-3 oraciones de exactamente qué se cambió.",
  "cambios": [
    {"seccion": "Responsables", "tipo": "modificacion|adicion|eliminacion", "descripcion": "..."}
  ]
}

Reglas estrictas:
- Mantener el mismo formato markdown del documento original.
- NO modificar secciones que no estén contempladas en la instrucción.
- NO inventar hechos nuevos que no estén en la instrucción ni en el documento.
- Los cambios deben ser mínimos, quirúrgicos y trazables.
- Si la instrucción es ambigua, hacer la interpretación más conservadora.
- El campo contenidoEditado debe contener el documento COMPLETO, no solo el fragmento editado."""


def _build_editar_user(req: EditarConIARequest) -> str:
    return f"""Aplica la siguiente instrucción de edición al procedimiento **{req.procedureCode}** (área: {req.area}).

INSTRUCCIÓN DEL USUARIO:
{req.instruccion}

DOCUMENTO ACTUAL:
---
{req.contenidoActual[:20000]}
---

Aplica ÚNICAMENTE los cambios indicados en la instrucción.
Devuelve el documento completo con los cambios aplicados en el campo contenidoEditado.
Responde ÚNICAMENTE con el JSON especificado."""


def _run_editar_job(job_id: str, body: EditarConIARequest) -> None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=12000,
            system=_build_editar_system(),
            messages=[{"role": "user", "content": _build_editar_user(body)}],
        )
        tokens_in  = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        logger.info(
            "[sig-ia/editar/job:%s] %s — in=%d out=%d",
            job_id[:8], body.procedureCode, tokens_in, tokens_out,
        )

        parsed = _parse_response(response.content[0].text)
        _jobs[job_id] = {
            "status": "done",
            "tipo": "editar_con_ia",
            "data": {
                **parsed,
                "procedimientoId":  body.procedimientoId,
                "procedureCode":    body.procedureCode,
                "contenidoOriginal": body.contenidoActual,
                "instruccion":      body.instruccion,
                "tokensUsados":     tokens_in + tokens_out,
                "modeloUsado":      settings.anthropic_model,
            },
        }
    except Exception as exc:
        logger.exception("[sig-ia/editar/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


@router.post("/editar-con-ia")
async def editar_con_ia(
    body: EditarConIARequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Edición quirúrgica de procedimiento con IA. Retorna job_id para polling."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada en el servidor.")
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "tipo": "editar_con_ia"}
    background_tasks.add_task(_run_editar_job, job_id, body)
    return {"ok": True, "job_id": job_id}


# ══════════════════════════════════════════════════════════════════════════════
# LightRAG — indexación y consulta del grafo de conocimiento
# ══════════════════════════════════════════════════════════════════════════════

class InstructivoItem(BaseModel):
    id: int
    codigo: str
    titulo: str
    contenido: str  # truncado a 3000 chars en el prompt builder, no aquí


class IndexarLightRAGRequest(BaseModel):
    procedimientoId: int
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    textContent: str = Field(..., min_length=10, max_length=200_000)
    instructivos: list[InstructivoItem] = Field(default_factory=list, max_length=10)
    rag_id: str = Field(default="rag1", pattern=r"^rag[12]$")

    @field_validator('textContent', mode='before')
    @classmethod
    def remove_base64(cls, v: str) -> str:
        return _strip_base64_blobs(v) if isinstance(v, str) else v


class ConsultarRAGRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000)
    modo: str = Field(default="mix", pattern=r"^(local|global|mix)$")
    rag_id: str = Field(default="rag1", pattern=r"^rag[12]$")


async def _run_indexar_job(job_id: str, body: IndexarLightRAGRequest) -> None:
    try:
        from app.agents.lightrag_service import indexar_texto  # type: ignore[import]

        chunks = [f"# {body.procedureCode} — {body.area}\n\n{body.textContent[:20000]}"]
        for inst in body.instructivos:
            chunks.append(f"# {inst.codigo} — {inst.titulo}\n\n{inst.contenido[:5000]}")

        indexados = 0
        for chunk in chunks:
            ok = await indexar_texto(chunk, rag_id=body.rag_id)
            if ok:
                indexados += 1

        _jobs[job_id] = {
            "status": "done",
            "tipo": "indexar_lightrag",
            "data": {
                "procedimientoId": body.procedimientoId,
                "procedureCode":   body.procedureCode,
                "chunksIndexados": indexados,
                "rag_id":          body.rag_id,
                "mensaje":         f"Indexados {indexados} de {len(chunks)} documentos en LightRAG [{body.rag_id}].",
            },
        }
    except Exception as exc:
        logger.exception("[sig-ia/indexar/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


@router.post("/indexar-lightrag")
async def indexar_lightrag(
    body: IndexarLightRAGRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Indexa el procedimiento y sus documentos de soporte en LightRAG."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "tipo": "indexar_lightrag"}
    background_tasks.add_task(_run_indexar_job, job_id, body)
    return {"ok": True, "job_id": job_id}


@router.post("/consultar-rag")
async def consultar_rag(
    body: ConsultarRAGRequest,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Consulta el grafo de conocimiento LightRAG.

    rag_id: 'rag1' (empresa actual — Jarvis) | 'rag2' (empresa mejorada — Ultron)
    modo:   'local' (preciso) | 'global' (amplio) | 'mix' (recomendado)
    """
    from app.agents.lightrag_service import buscar_conocimiento  # type: ignore[import]

    resultado = await buscar_conocimiento(body.query, modo=body.modo, rag_id=body.rag_id)
    return {"ok": True, "rag_id": body.rag_id, "modo": body.modo, "resultado": resultado}


@router.get("/rag-status")
async def rag_status(
    rag_id: str = "rag1",
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Inspect the LightRAG knowledge graph: counts documents, chunks, entities, relations.
    Also lists the first ~30 document sources so you know what's indexed.

    rag_id: 'rag1' (Jarvis) | 'rag2' (Ultron)
    """
    import json as _json
    import xml.etree.ElementTree as ET
    from pathlib import Path as _Path
    from app.config import settings

    if rag_id not in ("rag1", "rag2"):
        raise HTTPException(status_code=422, detail="rag_id must be 'rag1' or 'rag2'")

    base = settings.lightrag_working_dir
    working_dir = _Path(base) if rag_id == "rag1" else _Path(f"{base}_{rag_id}")

    if not working_dir.exists():
        return {"ok": True, "rag_id": rag_id, "exists": False, "message": "RAG directory not found — nothing indexed yet."}

    def _count_json_keys(fname: str) -> int:
        p = working_dir / fname
        if not p.exists():
            return 0
        try:
            data = _json.loads(p.read_text(encoding="utf-8"))
            return len(data)
        except Exception:
            return -1

    def _list_doc_sources(fname: str, limit: int = 30) -> list[str]:
        p = working_dir / fname
        if not p.exists():
            return []
        try:
            data = _json.loads(p.read_text(encoding="utf-8"))
            sources: list[str] = []
            for v in data.values():
                if isinstance(v, dict):
                    src = v.get("file_path") or v.get("source") or v.get("content", "")[:80]
                else:
                    src = str(v)[:80]
                if src:
                    sources.append(src)
            return sources[:limit]
        except Exception:
            return []

    def _count_graph(fname: str) -> tuple[int, int]:
        """Returns (node_count, edge_count) from a graphml file."""
        p = working_dir / fname
        if not p.exists():
            return 0, 0
        try:
            tree = ET.parse(str(p))
            root = tree.getroot()
            ns = {"g": "http://graphml.graphdrawing.org/graphml"}
            graph = root.find("g:graph", ns) or root.find("graph")
            if graph is None:
                return 0, 0
            nodes = len(graph.findall("{http://graphml.graphdrawing.org/graphml}node"))
            edges = len(graph.findall("{http://graphml.graphdrawing.org/graphml}edge"))
            return nodes, edges
        except Exception:
            return -1, -1

    docs      = _count_json_keys("kv_store_full_docs.json")
    chunks    = _count_json_keys("kv_store_text_chunks.json")
    nodes, edges = _count_graph("graph_chunk_entity_relation.graphml")
    sources   = _list_doc_sources("kv_store_full_docs.json")

    files = [f.name for f in working_dir.iterdir() if f.is_file()]

    return {
        "ok": True,
        "rag_id": rag_id,
        "exists": True,
        "working_dir": str(working_dir),
        "stats": {
            "documentos_indexados": docs,
            "chunks": chunks,
            "entidades_grafo": nodes,
            "relaciones_grafo": edges,
        },
        "fuentes": sources,
        "archivos_en_directorio": sorted(files),
    }
