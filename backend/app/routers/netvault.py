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
from pydantic import BaseModel, Field

from app.config import settings
from app.core.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/netvault", tags=["netvault"])

# ── Rúbrica embebida (sincronizada con resources/rubrica/rubrica-agent.json) ──

RUBRIC_VERSION = "1.0.0"

RUBRIC_CATEGORIES = [
    {
        "id": "claridad", "name": "Claridad", "weight": 1.2,
        "description": "El texto es comprensible, sin ambigüedades ni jerga innecesaria.",
        "checks": [
            "Cada paso tiene un verbo de acción explícito",
            "No hay términos sin definir en el primer uso",
            "Las condiciones (si/entonces) están explícitas",
            "Un lector nuevo puede ejecutar el proceso sin preguntar",
        ],
    },
    {
        "id": "completitud", "name": "Completitud", "weight": 1.2,
        "description": "Cubre inicio, desarrollo, cierre, excepciones y entregables.",
        "checks": [
            "Existe disparador claro de inicio",
            "Todos los pasos intermedios están documentados",
            "Hay cierre formal con entregables",
            "Se documentan excepciones y qué hacer ante ellas",
            "Referencias a formularios/sistemas están nombrados",
        ],
    },
    {
        "id": "responsabilidades", "name": "Responsabilidades", "weight": 1.0,
        "description": "Define quién hace qué, con roles y escalamiento.",
        "checks": [
            "Cada actividad tiene responsable (rol o cargo)",
            "Existe escalamiento ante bloqueos",
            "Aprobaciones tienen autoridad nombrada",
            "No hay pasos huérfanos sin dueño",
        ],
    },
    {
        "id": "riesgos", "name": "Riesgos", "weight": 1.0,
        "description": "Identifica riesgos operacionales, legales y de cumplimiento.",
        "checks": [
            "Riesgos por paso o por fase están nombrados",
            "Existen controles o mitigaciones",
            "Datos sensibles tienen manejo indicado",
            "Impacto de error está considerado",
        ],
    },
    {
        "id": "tiempos", "name": "Tiempos", "weight": 0.8,
        "description": "Plazos, SLAs y duración por actividad cuando aplique.",
        "checks": [
            "Actividades con SLA o plazo tienen valor numérico",
            "Unidades de tiempo son consistentes",
            "Tiempos de espera entre áreas están indicados",
            "Plazos legales o contractuales están citados si aplican",
        ],
    },
    {
        "id": "cumplimiento", "name": "Cumplimiento", "weight": 1.0,
        "description": "Alineación con normativa interna, políticas y trazabilidad.",
        "checks": [
            "Referencia a políticas o normas internas cuando aplica",
            "Registros/evidencias de cumplimiento están definidos",
            "Versionado y vigencia del documento son coherentes",
            "Separación de funciones en aprobaciones sensibles",
        ],
    },
    {
        "id": "mejora_continua", "name": "Mejora continua", "weight": 0.8,
        "description": "Oportunidades de automatización, eliminación de pasos y mejoras.",
        "checks": [
            "Pasos manuales redundantes identificados",
            "Oportunidades de integración con intranet/sistemas",
            "Métricas o KPIs del proceso mencionados o sugeridos",
            "Propuestas son accionables y priorizadas",
        ],
    },
]

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

# ── Schemas de request / response ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    procedureCode: str = Field(..., min_length=1, max_length=200)
    area: str = Field(..., min_length=1, max_length=100)
    textContent: str = Field(..., min_length=10, max_length=40_000)
    existingFlowchartMmd: str | None = None


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(..., max_length=20)
    system: str | None = Field(default=None, max_length=500)


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
INSTRUCCIONES:
1. Evalúa todas las categorías: {category_list}.
2. Genera hallazgos concretos (mínimo 3 si el documento lo permite).
3. Normaliza a markdown con las secciones de la rúbrica.
4. Flujograma Mermaid del proceso principal.
5. Extrae tiempos solo si el texto los menciona.
6. Propuestas accionables (intranet, mcp, mejora_proceso, eliminar_paso).
7. Corpus ZYMO: chunks con entidades y relaciones.

JSON exacto (sin texto fuera del JSON):
{{
  "flowchartMmd": "flowchart LR\\n  ...",
  "markdownNormalized": "# {req.procedureCode} — ...\\n\\n## Objetivo\\n...",
  "findings": [
    {{
      "id": "F001",
      "category": "{first_cat}",
      "severity": "critica|alta|media|baja",
      "description": "...",
      "suggestion": "...",
      "visibility": "interna|publica"
    }}
  ],
  "times": [
    {{ "activity": "...", "minMinutes": 0, "maxMinutes": 0, "unit": "minutos|horas|días", "rawText": "..." }}
  ],
  "proposals": [
    {{ "type": "desarrollo_intranet|mcp|mejora_proceso|eliminar_paso", "title": "...", "description": "...", "priority": "alta|media|baja" }}
  ],
  "zymoCorpus": [
    {{ "source": "{req.procedureCode}", "chunk": "...", "entities": ["..."], "relations": [{{"from": "...", "to": "...", "type": "..."}}] }}
  ]
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
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as exc:
        logger.error(
            "[netvault] JSON inválido en char %d — contexto: ...%s...",
            exc.pos,
            json_str[max(0, exc.pos - 120) : exc.pos + 120],
        )
    # Segundo intento: escapar caracteres de control literales dentro de strings
    sanitized = _sanitize_json_string(json_str)
    try:
        return json.loads(sanitized)
    except json.JSONDecodeError as exc2:
        raise ValueError(
            f"Claude no devolvió JSON válido (char {exc2.pos}): "
            f"{sanitized[max(0, exc2.pos - 200) : exc2.pos + 200]}"
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
async def chat_claude(
    body: ChatRequest,
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Proxy de chat directo a Claude."""
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
        return {"ok": True, "content": response.content[0].text, "tokens": response.usage.output_tokens}

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Librería 'anthropic' no instalada en el backend.",
        )
    except Exception as exc:
        logger.exception("[netvault/chat] Error")
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
