"""
Router: SIG — Generación de PDF de procedimientos
Llama al sig-backend (interno) para obtener datos del commit aprobado,
luego genera PDF con Jinja2 + WeasyPrint (igual que OC).
"""
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from jinja2 import Environment, FileSystemLoader
from pydantic import BaseModel
from typing import Any
import io

from app.core.deps import get_current_user
from app.models.user import User

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sig", tags=["SIG — PDF"])

_TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
_PLATFORMS_DIR  = Path(__file__).parent.parent / "platforms"

# URL interna del sig-backend (docker-compose service name)
_SIG_BACKEND_URL = os.getenv("SIG_BACKEND_URL", "http://sig-backend:3003")

# Plataforma predeterminada para el SIG (logo y datos empresa)
_DEFAULT_PLATFORM_SLUG = os.getenv("SIG_PLATFORM_SLUG", "logimat")

_BOGOTA_TZ = ZoneInfo("America/Bogota")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_platform(slug: str) -> dict:
    cfg_path = _PLATFORMS_DIR / slug / "config.json"
    if cfg_path.exists():
        import json
        return json.loads(cfg_path.read_text(encoding="utf-8"))
    return {}


def _logo_url(slug: str, empresa: dict) -> str:
    logo_file = empresa.get("logo", "")
    if not logo_file:
        return ""
    logo_path = _PLATFORMS_DIR / slug / logo_file
    if logo_path.exists():
        return f"file://{logo_path.resolve().as_posix()}"
    return ""


def _md_to_html(md: str) -> str:
    """Convierte markdown básico a HTML para WeasyPrint."""
    if not md:
        return ""
    # Eliminar imágenes base64 embebidas — hacen el HTML enorme y rompen WeasyPrint
    md = re.sub(r"!\[[^\]]*\]\(data:[^)]{8,}\)", "[imagen]", md)
    # Escapar HTML primero
    md = md.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    lines = md.split("\n")
    html_lines = []
    in_ul = False

    for line in lines:
        stripped = line.strip()

        # Headings
        h_match = re.match(r"^(#{1,4})\s+(.*)", stripped)
        if h_match:
            if in_ul:
                html_lines.append("</ul>"); in_ul = False
            level = len(h_match.group(1))
            text = _inline_md(h_match.group(2))
            html_lines.append(f"<h{level}>{text}</h{level}>")
            continue

        # Listas
        li_match = re.match(r"^[-*]\s+(.*)", stripped)
        if li_match:
            if not in_ul:
                html_lines.append("<ul>"); in_ul = True
            html_lines.append(f"<li>{_inline_md(li_match.group(1))}</li>")
            continue

        if in_ul and not stripped:
            html_lines.append("</ul>"); in_ul = False

        if stripped:
            html_lines.append(f"<p>{_inline_md(stripped)}</p>")
        elif not in_ul:
            html_lines.append("<br>")

    if in_ul:
        html_lines.append("</ul>")

    return "\n".join(html_lines)


def _inline_md(text: str) -> str:
    """Bold, italic, inline code."""
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"__(.+?)__",     r"<strong>\1</strong>", text)
    # Italic
    text = re.sub(r"\*(.+?)\*",     r"<em>\1</em>",        text)
    # Inline code
    text = re.sub(r"`(.+?)`",       r"<code>\1</code>",    text)
    return text


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.astimezone(_BOGOTA_TZ).strftime("%d/%m/%Y")
    except Exception:
        return iso[:10] if iso else "—"


def _estado_label(estado: str) -> str:
    return {"BORRADOR": "Borrador", "VIGENTE": "Vigente", "OBSOLETO": "Obsoleto"}.get(estado, estado)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/pdf/commit/{commit_id}")
async def generar_pdf_procedimiento(
    commit_id: int,
    current_user: User = Depends(get_current_user),
):
    """
    Genera y devuelve en streaming el PDF de un commit aprobado del SIG.
    Llama internamente al sig-backend para obtener datos; no requiere db sig.
    """

    # ── 1. Obtener datos del commit desde sig-backend ─────────────────────
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{_SIG_BACKEND_URL}/api/commits/{commit_id}",
                headers={"Authorization": f"Bearer {_build_internal_token()}"},
            )
    except httpx.RequestError as e:
        _log.error("No se pudo contactar sig-backend: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="sig-backend no disponible",
        )

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Commit no encontrado")
    if resp.status_code == 401:
        _log.error("sig-backend rechazó el token interno (401) — verificar JWT_SECRET / SECRET_KEY")
        raise HTTPException(status_code=502, detail="Error de autenticación interna con sig-backend")
    if resp.status_code != 200:
        _log.error("sig-backend respondió %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(
            status_code=502,
            detail=f"sig-backend respondió {resp.status_code}",
        )

    commit = resp.json()
    proc   = commit.get("procedimiento", {})
    area   = proc.get("area", {})

    # Solo se puede generar PDF de commits aprobados
    if commit.get("estado") != "APROBADO":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede generar PDF de commits con estado APROBADO",
        )

    # ── 2. Cargar datos de la empresa / plataforma ────────────────────────
    slug    = _DEFAULT_PLATFORM_SLUG
    empresa = _load_platform(slug)
    logo_url = _logo_url(slug, empresa)

    # ── 3. Construir contexto de la plantilla ─────────────────────────────
    ahora = datetime.now(_BOGOTA_TZ)
    estado_proc = proc.get("estado", "BORRADOR")

    context = {
        # Empresa
        "empresa_nombre": empresa.get("nombre", "LOGIMAT S.A.S."),
        "empresa_nit":    empresa.get("nit", ""),
        "empresa_ciudad": empresa.get("ciudad", ""),
        "logo_url":       logo_url,

        # Procedimiento
        "codigo":       proc.get("codigo", "—"),
        "titulo":       proc.get("titulo", commit.get("mensaje", "Procedimiento")),
        "descripcion":  proc.get("descripcion") or "",
        "area":         area.get("nombre", "—"),
        "version":      commit.get("versionDoc") or "1",
        "estado":       _estado_label(estado_proc),
        "estado_lower": estado_proc.lower(),
        "fecha_emision": _fmt_date(commit.get("aprobadoEn") or commit.get("createdAt")),

        # Contenido
        "contenido_agente_html": _md_to_html(commit.get("contenidoAgente", "")),
        "contenido_original":    commit.get("contenidoOriginal", ""),
        "mostrar_original":      False,   # no incluir el raw por defecto

        # Control de registros
        "elaboro_nombre": commit.get("autorNombre", "—"),
        "elaboro_cargo":  "Analista SIG",
        "elaboro_fecha":  _fmt_date(commit.get("createdAt")),

        "reviso_nombre": "",
        "reviso_cargo":  "Coordinador SIG",
        "reviso_fecha":  "",

        "aprobo_nombre": commit.get("aprobadoNombre") or current_user.full_name or current_user.username,
        "aprobo_cargo":  "Gerente",
        "aprobo_fecha":  _fmt_date(commit.get("aprobadoEn")),

        # Trazabilidad
        "commit_id":       commit_id,
        "version_doc":     commit.get("versionDoc") or "",
        "fecha_generacion": ahora.strftime("%d/%m/%Y %H:%M"),
    }

    # ── 4. Renderizar HTML ────────────────────────────────────────────────
    env  = Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)))
    html = env.get_template("template_sig.html").render(**context)

    # ── 5. Generar PDF en memoria ─────────────────────────────────────────
    # Import perezoso — ver documentos.py para el motivo (GTK/Pango no siempre disponible).
    from weasyprint import HTML

    pdf_bytes = HTML(
        string=html,
        base_url=str(_PLATFORMS_DIR / slug),
    ).write_pdf()

    filename = f"{proc.get('codigo', 'SIG')}_v{context['version']}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── PDF de análisis (historial) ─────────────────────────────────────────────

_TIPO_LABEL = {
    "coherencia": "Coherencia", "mejoras": "Mejoras", "proc-vs-inst": "Procedimiento vs. Instructivos",
    "cargos": "Cargos y Funciones", "completo": "Análisis Completo (Rúbrica)",
}


class AnalisisPdfRequest(BaseModel):
    tipo: str
    autorNombre: str
    createdAt: str
    resumen: str | None = None
    coherente: bool | None = None
    puntaje: float | None = None
    issues: list[dict[str, Any]] = []
    proposals: list[dict[str, Any]] = []
    conflictos: list[dict[str, Any]] = []
    cargos: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    markdownNormalizado: str | None = None
    flujogramaPng: str | None = None
    procedimiento: dict[str, Any]


@router.post("/pdf/analisis")
async def generar_pdf_analisis(
    payload: AnalisisPdfRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Genera el PDF de un análisis del historial (coherencia/mejoras/proc-vs-inst/cargos/completo).
    Recibe el item ya cargado por el frontend (viene completo desde /api/analisis/historial) —
    no hace falta re-consultar sig-backend. El flujograma, si existe, llega como PNG (data URL)
    ya rasterizado por el navegador -- no hay renderer de Mermaid en el servidor, y WeasyPrint
    no soporta el <style> con clases CSS que Mermaid embebe en el SVG (el texto salía en blanco).
    """
    slug    = _DEFAULT_PLATFORM_SLUG
    empresa = _load_platform(slug)
    logo_url = _logo_url(slug, empresa)
    proc    = payload.procedimiento
    area    = proc.get("area", {}) or {}
    ahora   = datetime.now(_BOGOTA_TZ)

    context = {
        "empresa_nombre": empresa.get("nombre", "LOGIMAT S.A.S."),
        "empresa_nit":    empresa.get("nit", ""),
        "empresa_ciudad": empresa.get("ciudad", ""),
        "logo_url":       logo_url,

        "codigo":   proc.get("codigo", "—"),
        "titulo":   proc.get("titulo", "—"),
        "area":     area.get("nombre", "—"),

        "tipo":       payload.tipo,
        "tipo_label": _TIPO_LABEL.get(payload.tipo, payload.tipo),
        "resumen":    payload.resumen or "",

        "score":      round(payload.puntaje * 100) if payload.puntaje is not None else None,
        "coherente":  payload.coherente,
        "issues":     payload.issues,
        "proposals":  payload.proposals,
        "conflictos": payload.conflictos,
        "cargos":     payload.cargos,
        "findings":   payload.findings,
        "markdown_normalizado_html": _md_to_html(payload.markdownNormalizado or ""),
        "flujograma_png": payload.flujogramaPng or "",

        "autor_nombre": payload.autorNombre,
        "fecha_analisis": _fmt_date(payload.createdAt),
        "fecha_generacion": ahora.strftime("%d/%m/%Y %H:%M"),
        "generado_por": current_user.full_name or current_user.username,
    }

    env  = Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)))
    html = env.get_template("template_sig_analisis.html").render(**context)

    from weasyprint import HTML

    pdf_bytes = HTML(
        string=html,
        base_url=str(_PLATFORMS_DIR / slug),
    ).write_pdf()

    filename = f"{proc.get('codigo', 'SIG')}_analisis_{payload.tipo}_{ahora.strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


def _build_internal_token() -> str:
    """
    Genera un JWT mínimo con rol admin para la llamada interna backend→sig-backend.
    Usa el mismo JWT_SECRET del sig-backend (variable de entorno compartida).
    """
    from jose import jwt as jose_jwt
    # sig-backend reads JWT_SECRET ?? SECRET_KEY — match the same priority chain
    secret = (
        os.getenv("SIG_JWT_SECRET")
        or os.getenv("JWT_SECRET")
        or os.getenv("SECRET_KEY")
        or "sig-dev-secret"
    )
    payload = {
        "sub":             "internal-backend",
        "role":            "admin",
        "app_permissions": [],
        "exp":             int(datetime.now(timezone.utc).timestamp()) + 60,
    }
    return jose_jwt.encode(payload, secret, algorithm="HS256")
