"""
netvault.py — Proxy de análisis Claude para la app de escritorio NetVault.

La API key de Anthropic vive ÚNICAMENTE en el backend de la intranet.
NetVault envía el documento y recibe el paquete de análisis completo.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import get_current_user, require_permission
from app.database import get_db
from app.models.analysis_kind import AnalysisKind
from app.models.rubrica import RubricaCategoria
from app.models.user import User
from app.services.tc_manual_extraction import cargo_manual_flags

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/netvault", tags=["netvault"])

# ── Rúbrica ────────────────────────────────────────────────────────────────────
# Las 7 categorías ya NO están hardcodeadas acá — viven en la tabla
# `rubrica_categorias` (backend/app/models/rubrica.py), editable desde la página
# "Análisis" del SIG. La semilla inicial (mismos valores que había acá antes)
# está en `_DEFAULT_RUBRICA_CATEGORIAS` (backend/app/main.py, _seed_rubrica()).

RUBRIC_VERSION = "1.0.0"

MARKDOWN_RULES = [
    "Título H1 con código y nombre del procedimiento",
    "Sección ## Objetivo (1 párrafo)",
    "Sección ## Alcance (área, roles, exclusiones)",
    "Sección ## Definiciones (si hay siglas)",
    "Sección ## Responsables (tabla rol | responsabilidad)",
    "Sección ## Desarrollo (pasos numerados 1. 2. 3.)",
    "Sección ## Excepciones",
    "Sección ## Registros y evidencias",
    "Sección ## Referencias",
    "Mantener hechos del original; no inventar pasos no presentes",
]

FLOWCHART_RULES = [
    "Usar flowchart LR o TD según complejidad",
    "Nodos con verbo + objeto (máx. 6 palabras)",
    "Decisiones con {¿pregunta?}",
    "Incluir nodo Inicio y Cierre",
    "Máximo 25 nodos; si hay más, agrupar en subprocesos",
]

CORPUS_RULES = [
    "Extraer 3-15 chunks de 80-400 caracteres",
    "Cada chunk: entidades (personas, sistemas, departamentos) y relaciones from-to-type",
    "No incluir datos personales identificables innecesarios (NIT, cédulas)",
]


@router.get("/rubrica")
async def get_rubrica(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Expone la rúbrica de análisis "completo" (7 categorías) sin invocar ningún LLM —
    la usa el MCP para que el agente que llama (Claude Code/Codex, con su propia
    suscripción) haga el análisis él mismo en vez de consumir el ANTHROPIC_API_KEY
    del servidor. Las categorías se leen de la tabla `rubrica_categorias`
    (editable desde la página "Análisis" del SIG).
    """
    categorias = db.exec(select(RubricaCategoria).order_by(RubricaCategoria.orden)).all()
    return {
        "version": RUBRIC_VERSION,
        "categorias": [c.model_dump(exclude={"orden"}) for c in categorias],
        "reglasMarkdown": MARKDOWN_RULES,
        "reglasFlujograma": FLOWCHART_RULES,
        "reglasCorpus": CORPUS_RULES,
    }


class RubricaCategoriaUpdate(BaseModel):
    weight: float | None = None
    description: str | None = None
    checks: list[str] | None = None


@router.patch("/rubrica/{categoria_id}")
async def update_rubrica_categoria(
    categoria_id: str,
    payload: RubricaCategoriaUpdate,
    _user: User = Depends(require_permission("mod_sig")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Edita el peso, la descripción o los puntos a revisar de una categoría de
    la rúbrica. Requiere permiso mod_sig (mismo permiso que edita el resto del SIG)."""
    categoria = db.get(RubricaCategoria, categoria_id)
    if not categoria:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada.")

    if payload.weight is not None:
        categoria.weight = payload.weight
    if payload.description is not None:
        categoria.description = payload.description.strip() or categoria.description
    if payload.checks is not None:
        categoria.checks = [c.strip() for c in payload.checks if c.strip()]

    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria.model_dump(exclude={"orden"})


# ── Catálogo de tipos de análisis ─────────────────────────────────────────────
# Antes hardcodeado como ANALYSIS_KINDS en SigRubricaPanel.tsx — vive en la tabla
# `analysis_kinds`, editable desde la página "Análisis" del SIG. Semilla inicial
# en `_DEFAULT_ANALYSIS_KINDS` (backend/app/main.py, _seed_analysis_kinds()).

@router.get("/analysis-kinds")
async def get_analysis_kinds(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    kinds = db.exec(select(AnalysisKind).order_by(AnalysisKind.orden)).all()
    return [k.model_dump(exclude={"orden"}) for k in kinds]


class AnalysisKindUpdate(BaseModel):
    name: str | None = None
    cost: str | None = None
    description: str | None = None
    where_text: str | None = None


@router.patch("/analysis-kinds/{kind_id}")
async def update_analysis_kind(
    kind_id: str,
    payload: AnalysisKindUpdate,
    _user: User = Depends(require_permission("mod_sig")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Edita nombre, costo, descripción o el texto de "dónde corre" de un tipo
    de análisis. Requiere permiso mod_sig (mismo permiso que edita el resto del SIG)."""
    kind = db.get(AnalysisKind, kind_id)
    if not kind:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de análisis no encontrado.")

    if payload.name is not None:
        kind.name = payload.name.strip() or kind.name
    if payload.cost is not None and payload.cost in ("bajo", "medio", "alto"):
        kind.cost = payload.cost
    if payload.description is not None:
        kind.description = payload.description.strip() or kind.description
    if payload.where_text is not None:
        kind.where_text = payload.where_text.strip() or kind.where_text

    db.add(kind)
    db.commit()
    db.refresh(kind)
    return kind.model_dump(exclude={"orden"})


# ── Schemas de request / response ─────────────────────────────────────────────

def _strip_base64_blobs(text: str) -> str:
    """Remove embedded base64 blobs (images/files) — keeps document text readable."""
    return re.sub(r'[A-Za-z0-9+/]{200,}={0,2}', '[imagen]', text)


class AnalyzeRequest(BaseModel):
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    textContent: str = Field(..., min_length=10, max_length=200_000)
    existingFlowchartMmd: str | None = None

    @field_validator('textContent', mode='before')
    @classmethod
    def remove_base64(cls, v: str) -> str:
        return _strip_base64_blobs(v) if isinstance(v, str) else v


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(..., max_length=20)
    system: str | None = Field(default=None, max_length=500)
    modelo: str = Field(default="claude", pattern=r"^(claude|gemini)$")


# ── Construcción del prompt ────────────────────────────────────────────────────

def _build_system_prompt() -> str:
    category_names = " | ".join(c["name"] for c in RUBRIC_CATEGORIES)
    lines: list[str] = [
        "Eres el agente de análisis de procedimientos de NetVault (ZYMO).",
        "Tu misión es evaluar documentos empresariales según la rúbrica oficial y devolver un paquete JSON estructurado.",
        "",
        f"Rúbrica NetVault v{RUBRIC_VERSION}",
        "",
        "Evalúa el documento en estas categorías (genera al menos un hallazgo por categoría "
        "donde haya observación; si está bien, un hallazgo 'baja' de refuerzo):",
    ]
    for cat in RUBRIC_CATEGORIES:
        lines.append(f"\n### {cat['name']} (id: {cat['id']}, peso {cat['weight']})")
        lines.append(cat["description"])
        lines.append("Criterios:")
        for check in cat["checks"]:
            lines.append(f"- {check}")

    lines.append("\n## Reglas markdown normalizado")
    for r in MARKDOWN_RULES:
        lines.append(f"- {r}")

    lines.append("\n## Reglas flujograma Mermaid")
    for r in FLOWCHART_RULES:
        lines.append(f"- {r}")

    lines.append("\n## Reglas corpus ZYMO")
    for r in CORPUS_RULES:
        lines.append(f"- {r}")

    lines.append("\n## Visibilidad de hallazgos")
    lines.append("- interna: Hallazgos operativos, riesgos internos, deuda de proceso")
    lines.append("- publica: Solo mejoras o clarificaciones aptas para publicar en intranet sin datos sensibles")

    lines.append(
        f"\nResponde ÚNICAMENTE con JSON válido (sin markdown fence). "
        f"IDs de hallazgos: F001, F002, … Categorías válidas: {category_names}"
    )
    return "\n".join(lines)


def _build_user_message(req: AnalyzeRequest) -> str:
    category_list = " | ".join(c["name"] for c in RUBRIC_CATEGORIES)
    first_cat = RUBRIC_CATEGORIES[0]["name"]
    chart_section = ""
    if req.existingFlowchartMmd:
        chart_section = (
            f"\nFLUJOGRAMA EXISTENTE (comparar y reflejar diferencias en flowchartDiff si aplica):\n"
            f"```\n{req.existingFlowchartMmd}\n```\n"
        )
    return f"""Analiza el procedimiento con código **{req.procedureCode}** del área **{req.area}**.

DOCUMENTO FUENTE:
---
{req.textContent[:12000]}
---
{chart_section}
INSTRUCCIONES (responde conciso):
1. Evalúa todas las categorías: {category_list}.
2. Máximo 6 hallazgos (los más relevantes).
3. Markdown normalizado: Objetivo, Pasos principales y Excepciones breves.
4. Flujograma Mermaid (máximo 12 nodos).
5. Tiempos: solo si el texto los menciona, máximo 5.
6. Propuestas: máximo 3.
7. Corpus ZYMO: máximo 3 chunks.

JSON exacto (sin texto fuera del JSON):
{{
  "flowchartMmd": "flowchart LR
  ...",
  "markdownNormalized": "# {req.procedureCode}

## Objetivo
...

## Pasos
...

## Excepciones
...",
  "findings": [{{"id":"F001","category":"{first_cat}","severity":"critica|alta|media|baja","description":"...","suggestion":"...","visibility":"interna|publica"}}],
  "times": [{{"activity":"...","minMinutes":0,"maxMinutes":0,"unit":"minutos|horas|días","rawText":"..."}}],
  "proposals": [{{"type":"desarrollo_intranet|mcp|mejora_proceso|eliminar_paso","title":"...","description":"...","priority":"alta|media|baja"}}],
  "zymoCorpus": [{{"source":"{req.procedureCode}","chunk":"...","entities":["..."],"relations":[{{"from":"...","to":"...","type":"..."}}]}}]
}}"""


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


def _parse_response(raw: str, req: AnalyzeRequest) -> dict[str, Any]:
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
        logger.warning("[netvault] JSON inválido en char %d, intentando reparar…", exc.pos)

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
            logger.info("[netvault] JSON reparado con json-repair")
            return repaired  # type: ignore[return-value]
    except Exception as repair_exc:
        logger.warning("[netvault] json-repair falló: %s", repair_exc)

    raise ValueError(
        f"Claude no devolvió JSON válido (char {json_str.find(json_str[8000:8100] if len(json_str) > 8000 else '')}) — "
        f"primeros 300 chars: {json_str[:300]}"
    )


def _diff_flowcharts(old: str, new: str) -> str:
    old_lines = {ln.strip() for ln in old.splitlines() if ln.strip()}
    new_lines = {ln.strip() for ln in new.splitlines() if ln.strip()}
    added   = [f"+ {ln}" for ln in new_lines if ln not in old_lines]
    removed = [f"- {ln}" for ln in old_lines if ln not in new_lines]
    if not added and not removed:
        return "(sin cambios)"
    return "\n".join(removed + added)


def _assemble_package(req: AnalyzeRequest, parsed: dict[str, Any]) -> dict[str, Any]:
    sha = hashlib.sha256(req.textContent.encode()).hexdigest()
    now = datetime.now(tz=timezone.utc).isoformat()
    meta = {
        "code": req.procedureCode,
        "version": "1.0.0",
        "status": "borrador",
        "area": req.area,
        "hash": sha,
        "syncStatus": "local",
        "lastModified": now,
        "analysisRunAt": now,
        "rubricVersion": RUBRIC_VERSION,
    }
    pkg: dict[str, Any] = {
        "procedureCode": req.procedureCode,
        "originalPath": "",
        "analyzedAt": now,
        "flowchartMmd": parsed.get("flowchartMmd", ""),
        "markdownNormalized": parsed.get("markdownNormalized", ""),
        "findings": parsed.get("findings", []),
        "times": parsed.get("times", []),
        "proposals": parsed.get("proposals", []),
        "zymoCorpus": parsed.get("zymoCorpus", []),
        "meta": meta,
    }
    if req.existingFlowchartMmd and pkg["flowchartMmd"]:
        pkg["flowchartDiff"] = _diff_flowcharts(req.existingFlowchartMmd, pkg["flowchartMmd"])
    return pkg


# ── Job store en memoria (se limpia al reiniciar el contenedor) ───────────────
# { job_id: { status: "pending"|"done"|"error", data?: pkg, error?: str } }
_jobs: dict[str, dict[str, Any]] = {}


def _run_analysis_job(job_id: str, body: AnalyzeRequest) -> None:
    """Ejecuta el análisis en un hilo de background y actualiza _jobs."""
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.beta.messages.create(
            model=settings.anthropic_model,
            max_tokens=12000,
            betas=["output-128k-2025-02-19"],
            system=_build_system_prompt(),
            messages=[{"role": "user", "content": _build_user_message(body)}],
        )
        tokens_in  = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        cost_usd   = (tokens_in * 3 + tokens_out * 15) / 1_000_000
        logger.info(
            "[netvault/job:%s] %s — in=%d out=%d costo≈$%.4f",
            job_id[:8], body.procedureCode, tokens_in, tokens_out, cost_usd,
        )
        raw    = response.content[0].text
        parsed = _parse_response(raw, body)
        pkg    = _assemble_package(body, parsed)
        _jobs[job_id] = {"status": "done", "data": pkg}
    except Exception as exc:
        logger.exception("[netvault/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/analizar")
async def analizar_procedimiento(
    body: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Inicia el análisis en background y retorna un job_id inmediatamente."""
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANTHROPIC_API_KEY no configurada en el servidor.",
        )
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending"}
    background_tasks.add_task(_run_analysis_job, job_id, body)
    return {"ok": True, "job_id": job_id}


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
async def chat_netvault(
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
            logger.exception("[netvault/chat/gemini] Error")
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
        logger.exception("[netvault/chat/claude] Error")
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
# Nuevos endpoints SIG — análisis segmentados por fase
# ══════════════════════════════════════════════════════════════════════════════

# ── Schemas ───────────────────────────────────────────────────────────────────

class CoherenciaRequest(BaseModel):
    procedimientoId: int
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    textContent: str = Field(..., min_length=10, max_length=200_000)
    existingFlowchartMmd: str | None = None
    contexto_previo: list[ContextoAnalisis] = Field(default_factory=list)

    @field_validator('textContent', mode='before')
    @classmethod
    def remove_base64(cls, v: str) -> str:
        return _strip_base64_blobs(v) if isinstance(v, str) else v


class MejorasRequest(BaseModel):
    procedimientoId: int
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    textContent: str = Field(..., min_length=10, max_length=200_000)
    contexto_previo: list[ContextoAnalisis] = Field(default_factory=list)

    @field_validator('textContent', mode='before')
    @classmethod
    def remove_base64(cls, v: str) -> str:
        return _strip_base64_blobs(v) if isinstance(v, str) else v


class InstructivoItem(BaseModel):
    id: int
    codigo: str
    titulo: str
    contenido: str  # truncado a 3000 chars en el prompt builder, no aquí


class ContextoAnalisis(BaseModel):
    tipo: str   # coherencia | mejoras | proc-vs-inst | cargos
    resumen: str
    fecha: str = ""


def _formato_contexto(contexto: list[ContextoAnalisis]) -> str:
    if not contexto:
        return ""
    lineas = []
    for c in contexto:
        encabezado = f"[{c.tipo.upper()}{' — ' + c.fecha if c.fecha else ''}]"
        lineas.append(f"{encabezado}\n{c.resumen.strip()[:500]}")
    return (
        "\n\nANÁLISIS PREVIOS DE ESTE PROCEDIMIENTO (tener en cuenta al elaborar tu respuesta):\n"
        "---\n"
        + "\n\n".join(lineas)
        + "\n---"
    )


class ProcVsInstRequest(BaseModel):
    procedimientoId: int
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    textContent: str = Field(..., min_length=10, max_length=200_000)
    instructivos: list[InstructivoItem] = Field(..., min_length=1, max_length=10)
    contexto_previo: list[ContextoAnalisis] = Field(default_factory=list)

    @field_validator('textContent', mode='before')
    @classmethod
    def remove_base64(cls, v: str) -> str:
        return _strip_base64_blobs(v) if isinstance(v, str) else v


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


# ── Prompts coherencia ────────────────────────────────────────────────────────

def _build_coherencia_system() -> str:
    return """Eres el agente de coherencia de procedimientos de NetVault (ZYMO).
Detecta si el procedimiento es internamente coherente y, si se provee un flujograma, si el texto y el flujograma son consistentes.

Responde ÚNICAMENTE con JSON válido (sin markdown fence):
{
  "coherente": true|false,
  "puntaje": 0.0-1.0,
  "resumen": "Párrafo de 2-4 oraciones.",
  "issues": [
    {"tipo": "ambigüedad|paso_faltante|contradicción|rol_sin_definir|condición_incompleta|otro",
     "descripcion": "...",
     "severidad": "critica|alta|media|baja"}
  ],
  "flujogramaConsistente": true|false|null,
  "flujogramaDiff": "líneas con + para nuevo, - para eliminado, o null"
}

Reglas:
- coherente = true si no hay issues critica o alta.
- puntaje 1.0 = sin problemas, 0.0 = incoherente.
- issues: máximo 8; incluir al menos 1 positivo (baja) si está bien.
- Si no hay flujograma: flujogramaConsistente = null, flujogramaDiff = null.
- NO inventar pasos que no estén en el documento."""


def _build_coherencia_user(req: CoherenciaRequest) -> str:
    chart = ""
    if req.existingFlowchartMmd:
        chart = f"\nFLUJOGRAMA EXISTENTE:\n```\n{req.existingFlowchartMmd}\n```\n"
    ctx = _formato_contexto(req.contexto_previo)
    return f"""Analiza la coherencia interna del procedimiento **{req.procedureCode}** (área: {req.area}).
{ctx}
DOCUMENTO:
---
{req.textContent[:15000]}
---
{chart}
Evalúa:
1. ¿Los pasos son coherentes (sin contradicciones, sin referencias rotas)?
2. ¿Los roles están definidos de forma consistente?
3. ¿Las condiciones si/entonces tienen ambas ramas documentadas?
4. Si hay flujograma: ¿coincide con los pasos del texto?

Responde ÚNICAMENTE con el JSON especificado."""


def _run_coherencia_job(job_id: str, body: CoherenciaRequest) -> None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=3000,
            system=_build_coherencia_system(),
            messages=[{"role": "user", "content": _build_coherencia_user(body)}],
        )
        tokens_in  = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        logger.info(
            "[netvault/coherencia/job:%s] %s — in=%d out=%d",
            job_id[:8], body.procedureCode, tokens_in, tokens_out,
        )

        class _R:
            procedureCode = body.procedureCode
            area          = body.area
            textContent   = body.textContent

        parsed = _parse_response(response.content[0].text, _R())  # type: ignore[arg-type]
        _jobs[job_id] = {
            "status": "done",
            "tipo": "coherencia",
            "data": {
                **parsed,
                "procedimientoId": body.procedimientoId,
                "procedureCode":   body.procedureCode,
                "tokensUsados":    tokens_in + tokens_out,
                "modeloUsado":     settings.anthropic_model,
            },
        }
    except Exception as exc:
        logger.exception("[netvault/coherencia/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


# ── Prompts mejoras ───────────────────────────────────────────────────────────

def _build_mejoras_system() -> str:
    return """Eres el agente de mejora de procedimientos de NetVault (ZYMO).
Identifica brechas, oportunidades de mejora, automatización posible y huecos. No evalúes coherencia interna.

Responde ÚNICAMENTE con JSON válido (sin markdown fence):
{
  "resumen": "Párrafo ejecutivo de 3-5 oraciones.",
  "findings": [
    {"id": "F001",
     "category": "completitud|responsabilidades|riesgos|tiempos|cumplimiento|mejora_continua|automatizacion",
     "severity": "critica|alta|media|baja",
     "description": "...",
     "suggestion": "...",
     "visibility": "interna|publica"}
  ],
  "proposals": [
    {"type": "desarrollo_intranet|mcp|mejora_proceso|eliminar_paso|automatizacion",
     "title": "...",
     "description": "...",
     "priority": "alta|media|baja"}
  ],
  "markdownMejorado": "# CÓDIGO\\n\\n## Objetivo\\n..."
}

Reglas:
- findings: máximo 10. proposals: máximo 5 accionables.
- markdownMejorado: versión mejorada con secciones: Objetivo, Alcance, Responsables (tabla), Desarrollo (numerado), Excepciones, Registros.
- NO inventar hechos que no estén en el documento."""


def _build_mejoras_user(req: MejorasRequest) -> str:
    ctx = _formato_contexto(req.contexto_previo)
    return f"""Analiza las oportunidades de mejora de **{req.procedureCode}** (área: {req.area}).
{ctx}
DOCUMENTO:
---
{req.textContent[:15000]}
---

Identifica:
1. Brechas: pasos incompletos, responsabilidades vagas, riesgos no mitigados.
2. Automatización: qué pasos podría automatizar la intranet ZYMO.
3. Eliminación: pasos redundantes o de bajo valor.
4. Cumplimiento: normativa faltante, registros no definidos.
5. KPIs o indicadores que deberían existir.

Responde ÚNICAMENTE con el JSON especificado."""


def _run_mejoras_job(job_id: str, body: MejorasRequest) -> None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=8000,
            system=_build_mejoras_system(),
            messages=[{"role": "user", "content": _build_mejoras_user(body)}],
        )
        tokens_in  = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        logger.info(
            "[netvault/mejoras/job:%s] %s — in=%d out=%d",
            job_id[:8], body.procedureCode, tokens_in, tokens_out,
        )

        class _R:
            procedureCode = body.procedureCode
            area          = body.area
            textContent   = body.textContent

        parsed = _parse_response(response.content[0].text, _R())  # type: ignore[arg-type]
        _jobs[job_id] = {
            "status": "done",
            "tipo": "mejoras",
            "data": {
                **parsed,
                "procedimientoId": body.procedimientoId,
                "procedureCode":   body.procedureCode,
                "tokensUsados":    tokens_in + tokens_out,
                "modeloUsado":     settings.anthropic_model,
            },
        }
    except Exception as exc:
        logger.exception("[netvault/mejoras/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


# ── Prompts proc-vs-instructivos ──────────────────────────────────────────────

def _build_pvsi_system() -> str:
    return """Eres el agente de coherencia documental de ZYMO.
Verifica que el procedimiento principal y sus documentos de soporte no se contradigan.

Responde ÚNICAMENTE con JSON válido (sin markdown fence):
{
  "coherente": true|false,
  "resumen": "Párrafo de 2-4 oraciones.",
  "conflictos": [
    {"instructivoCodigo": "INS-OP-001",
     "descripcion": "...",
     "severidad": "critica|alta|media|baja"}
  ]
}

Reglas:
- coherente = true si no hay conflictos critica o alta.
- conflictos: máximo 8. Si hay 0, array vacío.
- Incluir el código del documento afectado en cada conflicto."""


def _inst_block(i: "InstructivoItem") -> str:
    if i.contenido.strip():
        return f"### {i.codigo} — {i.titulo}\n{i.contenido[:3000]}"
    return (
        f"### {i.codigo} — {i.titulo}\n"
        "[SIN CONTENIDO EXTRAÍBLE: El archivo fue adjuntado pero no tiene texto procesable "
        "(posible .doc clásico o PDF escaneado). Reportar como conflicto de severidad 'alta': "
        "no se puede verificar coherencia con el procedimiento principal.]"
    )


def _build_pvsi_user(req: "ProcVsInstRequest") -> str:
    inst_blocks = "\n\n".join(_inst_block(i) for i in req.instructivos)
    ctx = _formato_contexto(req.contexto_previo)
    return f"""Verifica coherencia entre el procedimiento y sus documentos de soporte.
{ctx}
PROCEDIMIENTO ({req.procedureCode} — {req.area}):
---
{req.textContent[:8000]}
---

DOCUMENTOS DE SOPORTE ({len(req.instructivos)} documento{"s" if len(req.instructivos) != 1 else ""}):
{inst_blocks}

Detecta: contradicciones de pasos, roles definidos diferente, secuencias que difieren, referencias cruzadas rotas.
Si el procedimiento referencia un código de instructivo que NO aparece en la lista de documentos de soporte, repórtalo como conflicto 'alta': referencia cruzada sin documento correspondiente.

Responde ÚNICAMENTE con el JSON especificado."""


def _run_pvsi_job(job_id: str, body: ProcVsInstRequest) -> None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4000,
            system=_build_pvsi_system(),
            messages=[{"role": "user", "content": _build_pvsi_user(body)}],
        )
        tokens_in  = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        logger.info(
            "[netvault/pvsi/job:%s] %s — in=%d out=%d",
            job_id[:8], body.procedureCode, tokens_in, tokens_out,
        )

        class _R:
            procedureCode = body.procedureCode
            area          = body.area
            textContent   = body.textContent

        parsed = _parse_response(response.content[0].text, _R())  # type: ignore[arg-type]
        _jobs[job_id] = {
            "status": "done",
            "tipo": "proc_vs_inst",
            "data": {
                **parsed,
                "procedimientoId": body.procedimientoId,
                "instructivoIds":  [i.id for i in body.instructivos],
                "procedureCode":   body.procedureCode,
                "tokensUsados":    tokens_in + tokens_out,
                "modeloUsado":     settings.anthropic_model,
            },
        }
    except Exception as exc:
        logger.exception("[netvault/pvsi/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


# ── Indexar LightRAG ──────────────────────────────────────────────────────────

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
        logger.exception("[netvault/indexar/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analizar-coherencia")
async def analizar_coherencia(
    body: CoherenciaRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Análisis lean: coherencia interna + comparación vs flujograma existente."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada en el servidor.")
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "tipo": "coherencia"}
    background_tasks.add_task(_run_coherencia_job, job_id, body)
    return {"ok": True, "job_id": job_id}


@router.post("/analizar-mejoras")
async def analizar_mejoras(
    body: MejorasRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Análisis heavy: brechas, oportunidades de mejora y markdown mejorado."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada en el servidor.")
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "tipo": "mejoras"}
    background_tasks.add_task(_run_mejoras_job, job_id, body)
    return {"ok": True, "job_id": job_id}


@router.post("/analizar-proc-vs-inst")
async def analizar_proc_vs_inst(
    body: ProcVsInstRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Verifica coherencia entre el procedimiento y sus documentos de soporte."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada en el servidor.")
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "tipo": "proc_vs_inst"}
    background_tasks.add_task(_run_pvsi_job, job_id, body)
    return {"ok": True, "job_id": job_id}


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


# ── Cargos y Funciones ────────────────────────────────────────────────────────

class CargosRequest(BaseModel):
    procedimientoId: int
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(default="", max_length=100)
    textContent: str = Field(..., min_length=10, max_length=200_000)
    instructivos: list[InstructivoItem] = Field(default_factory=list, max_length=10)
    contexto_previo: list[ContextoAnalisis] = Field(default_factory=list)
    cargo_ids: list[int] = Field(default_factory=list, max_length=50)

    @field_validator('textContent', mode='before')
    @classmethod
    def remove_base64(cls, v: str) -> str:
        return _strip_base64_blobs(v) if isinstance(v, str) else v

    @field_validator('cargo_ids', mode='before')
    @classmethod
    def dedupe_cargo_ids(cls, v: list[int] | None) -> list[int]:
        return list(dict.fromkeys(int(x) for x in (v or [])))


def _build_cargos_system() -> str:
    return """Eres el agente de análisis de cargos y funciones de ZYMO.

Tu tarea es comparar cómo el procedimiento utiliza cada cargo/rol contra su Manual de Funciones oficial registrado en T&C (si existe), y evaluar si las responsabilidades están claramente explicitadas.

ESTADOS de comparación:
- ACORDE: Las funciones asignadas en el procedimiento son consistentes con el manual oficial.
- INCOMPLETO: El procedimiento menciona el cargo pero no cubre funciones importantes definidas en el manual.
- DISCREPANCIA: El procedimiento asigna al cargo funciones que contradicen o se alejan del manual.
- NO_DEFINIDO: El cargo aparece en el procedimiento pero no tiene manual registrado en T&C.

Responde ÚNICAMENTE con JSON válido (sin markdown fence):
{
  "resumen": "Párrafo de 2-4 oraciones sobre la alineación general entre el procedimiento y los manuales.",
  "comparaciones": [
    {
      "cargo": "Nombre exacto del cargo como aparece en el procedimiento",
      "tiene_manual": true,
      "estado": "ACORDE",
      "funciones_en_procedimiento": ["Función que el procedimiento le asigna"],
      "funciones_en_manual": ["Función definida en el manual oficial"],
      "brechas": ["El manual define X pero el procedimiento no la menciona"],
      "observaciones": "Observación concisa sobre este cargo en el procedimiento."
    }
  ],
  "cargos_sin_manual": ["Nombre del cargo sin manual registrado en T&C"]
}

Reglas:
- funciones_en_procedimiento: solo lo explícitamente mencionado en el documento analizado.
- funciones_en_manual: solo lo que aparece en el texto del manual proporcionado.
- Si tiene_manual es false: omitir funciones_en_manual y brechas; estado = "NO_DEFINIDO".
- brechas: diferencias concretas y accionables.
- Máximo 10 items en comparaciones, priorizar cargos con mayor responsabilidad.
- No inventar funciones que no estén en los documentos.
- Analiza ÚNICAMENTE los cargos listados en «CARGOS ASIGNADOS AL PROCEDIMIENTO»; no infieras otros roles."""


def _build_cargos_user(
    req: CargosRequest,
    manuales_tc: list[dict[str, str]],
    cargos_asignados: list[dict[str, str | bool]],
) -> str:
    if cargos_asignados:
        lines = []
        for c in cargos_asignados:
            flag = "con manual" if c.get("tiene_manual") else "sin manual en T&C"
            lines.append(f"- {c['nombre']} ({flag})")
        asignados_block = "\n\nCARGOS ASIGNADOS AL PROCEDIMIENTO (analizar solo estos):\n" + "\n".join(lines)
    else:
        asignados_block = ""

    if manuales_tc:
        manuales_block = "\n\nMANUALES DE FUNCIONES (T&C — solo cargos asignados):\n" + "\n\n".join(
            f"### {m['nombre']}\n{m['manual_text'][:8000]}"
            for m in manuales_tc
        )
    else:
        manuales_block = (
            "\n\n[Los cargos asignados no tienen texto de manual en T&C. "
            "Marca estado NO_DEFINIDO para cada uno.]"
            if cargos_asignados
            else "\n\n[No hay cargos asignados al procedimiento.]"
        )

    inst_blocks = ""
    if req.instructivos:
        inst_blocks = "\n\nDOCUMENTOS DE SOPORTE (INSTRUCTIVOS):\n" + "\n\n".join(
            f"### {i.codigo} — {i.titulo}\n{i.contenido[:3000]}"
            for i in req.instructivos
        )

    ctx = _formato_contexto(req.contexto_previo)
    return f"""Analiza los cargos del procedimiento **{req.procedureCode}** (área: {req.area}) comparando con los manuales oficiales de T&C.
{ctx}{asignados_block}{manuales_block}

PROCEDIMIENTO A ANALIZAR:
---
{req.textContent[:12000]}
---
{inst_blocks}

Compara cómo el procedimiento usa cada cargo asignado contra su manual oficial (si existe). Identifica brechas y alineaciones.

Responde ÚNICAMENTE con el JSON especificado."""


def _run_cargos_job(job_id: str, body: CargosRequest) -> None:
    try:
        from sqlmodel import Session, select, col
        from app.personal_database import PtcCargo, get_personal_engine

        if not body.cargo_ids:
            _jobs[job_id] = {
                "status": "error",
                "error": "Asigna al menos un cargo T&C al procedimiento antes de analizar.",
            }
            return

        with Session(get_personal_engine()) as session:
            rows = session.exec(
                select(PtcCargo).where(col(PtcCargo.id).in_(body.cargo_ids))
            ).all()

        if not rows:
            _jobs[job_id] = {
                "status": "error",
                "error": "Ninguno de los cargos asignados existe en el directorio T&C.",
            }
            return

        by_id = {r.id: r for r in rows}
        ordered = [by_id[cid] for cid in body.cargo_ids if cid in by_id]

        cargos_asignados: list[dict[str, str | bool]] = []
        manuales_tc: list[dict[str, str]] = []
        for r in ordered:
            flags = cargo_manual_flags(r.manual_url or "", r.manual_text or "")
            tiene = flags["tiene_manual"]
            cargos_asignados.append({"nombre": r.nombre, "tiene_manual": tiene})
            if tiene:
                manuales_tc.append({"nombre": r.nombre, "manual_text": r.manual_text})

        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=6000,
            system=_build_cargos_system(),
            messages=[{"role": "user", "content": _build_cargos_user(body, manuales_tc, cargos_asignados)}],
        )
        tokens_in  = response.usage.input_tokens
        tokens_out = response.usage.output_tokens
        logger.info(
            "[netvault/cargos/job:%s] %s — in=%d out=%d cargos_asignados=%d manuales=%d",
            job_id[:8], body.procedureCode, tokens_in, tokens_out, len(cargos_asignados), len(manuales_tc),
        )

        raw = response.content[0].text.strip()
        try:
            import json as _json
            parsed = _json.loads(raw)
        except Exception:
            parsed = {"resumen": raw, "comparaciones": [], "cargos_sin_manual": []}

        _jobs[job_id] = {
            "status": "done",
            "tipo": "cargos",
            "data": {
                **parsed,
                "cargos": parsed.get("comparaciones", []),  # backward compat
                "procedimientoId": body.procedimientoId,
                "procedureCode":   body.procedureCode,
                "tokensUsados":    tokens_in + tokens_out,
                "modeloUsado":     settings.anthropic_model,
            },
        }
    except Exception as exc:
        logger.exception("[netvault/cargos/job:%s] Error", job_id[:8])
        _jobs[job_id] = {"status": "error", "error": str(exc)}


@router.post("/analizar-cargos")
async def analizar_cargos(
    body: CargosRequest,
    background_tasks: BackgroundTasks,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Compara cargos asignados al procedimiento contra manuales T&C."""
    if not body.cargo_ids:
        raise HTTPException(
            status_code=422,
            detail="Asigna al menos un cargo T&C al procedimiento antes de analizar.",
        )
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada en el servidor.")
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "tipo": "cargos"}
    background_tasks.add_task(_run_cargos_job, job_id, body)
    return {"ok": True, "job_id": job_id}


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
    return """Eres el agente de edición de procedimientos de NetVault (ZYMO).
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
            "[netvault/editar/job:%s] %s — in=%d out=%d",
            job_id[:8], body.procedureCode, tokens_in, tokens_out,
        )

        class _R:
            procedureCode = body.procedureCode
            area          = body.area
            textContent   = body.contenidoActual

        parsed = _parse_response(response.content[0].text, _R())  # type: ignore[arg-type]
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
        logger.exception("[netvault/editar/job:%s] Error", job_id[:8])
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
