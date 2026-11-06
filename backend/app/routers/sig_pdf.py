"""
Router: SIG — Generación de PDF de procedimientos
Llama al sig-backend (interno) para obtener datos del commit aprobado,
luego genera PDF con Jinja2 + WeasyPrint (igual que OC).
"""
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, unquote, urlparse
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from jinja2 import Environment, FileSystemLoader
import io

from app.core.deps import get_current_user, get_token
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
        return logo_path.resolve().as_uri()
    return ""


def _url_permitida(url: str) -> None:
    """Política de recursos del PDF: solo data: y archivos dentro de _PLATFORMS_DIR. Lanza ValueError si no."""
    parsed = urlparse(url)
    if parsed.scheme == "data":
        return
    if parsed.scheme == "file" and parsed.netloc in ("", "localhost"):
        try:
            ruta = Path(unquote(parsed.path))
            if os.name == "nt" and re.match(r"^/[A-Za-z]:", str(parsed.path)):
                ruta = Path(unquote(parsed.path)[1:])
            ruta.resolve().relative_to(_PLATFORMS_DIR.resolve())
            return
        except (ValueError, OSError):
            pass
    raise ValueError("Recurso no permitido en el PDF")


def _crear_url_fetcher():
    """url_fetcher de WeasyPrint que aplica _url_permitida. La API cambió entre versiones (requirements no fija la versión):
    >=68 usa la clase URLFetcher; las anteriores, una función con default_url_fetcher."""
    try:
        from weasyprint.urls import URLFetcher  # import perezoso (GTK/Pango)
    except ImportError:
        from weasyprint import default_url_fetcher

        def _legacy(url, *args, **kwargs):
            _url_permitida(url)
            return default_url_fetcher(url, *args, **kwargs)

        return _legacy

    class _Restringido(URLFetcher):
        def fetch(self, url, headers=None):
            _url_permitida(url)
            return super().fetch(url, headers)

    return _Restringido()


def _content_disposition(filename: str) -> str:
    """attachment con fallback ASCII y filename* UTF-8 (RFC 5987): un código con tildes no rompe la cabecera."""
    ascii_name = re.sub(r'[^\x20-\x7E]|["\\]', "_", filename)
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename, safe='')}"


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
    token: str = Depends(get_token),
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
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.RequestError as e:
        _log.error("No se pudo contactar sig-backend: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="sig-backend no disponible",
        )

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Commit no encontrado")
    if resp.status_code in (401, 403):
        # sig-backend aplica permisos y área (gateLider) con el JWT del propio usuario
        raise HTTPException(status_code=403, detail="Sin acceso a este procedimiento")
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
    env  = Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)), autoescape=True)
    html = env.get_template("template_sig.html").render(**context)

    # ── 5. Generar PDF en memoria ─────────────────────────────────────────
    # Import perezoso — ver documentos.py para el motivo (GTK/Pango no siempre disponible).
    from weasyprint import HTML

    pdf_bytes = HTML(
        string=html,
        base_url=str(_PLATFORMS_DIR / slug),
        url_fetcher=_crear_url_fetcher(),
    ).write_pdf()

    filename = f"{proc.get('codigo', 'SIG')}_v{context['version']}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": _content_disposition(filename),
            "Content-Length": str(len(pdf_bytes)),
        },
    )

