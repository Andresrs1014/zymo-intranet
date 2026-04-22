"""
Servicio de correo electrónico para el módulo OC.
Usa fastapi-mail con SMTP de Office 365.

Flujos implementados:
  Flujo 1 — En gestión         → solicitante (estado: en_cotizacion)
  Flujo 2 — Cotización Lista   → solicitante (estado: pendiente_aprobacion)
  Flujo 3 — Aprobación Dir.    → directora   (estado: pendiente_aprobacion)  ← incluye valor cotización
  Flujo 4 — OC Enviada         → solicitante (estado: oc_enviada)
  Flujo OC Proveedor           → proveedor   (adjunto DOCX/PDF) + CC al solicitante
"""
from __future__ import annotations

import logging
from datetime import timezone
from pathlib import Path
from typing import TYPE_CHECKING, Optional
from zoneinfo import ZoneInfo

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

import base64 as _base64
import json as _json
import mimetypes as _mimetypes
from pathlib import Path as _Path

from app.config import settings

if TYPE_CHECKING:
    from app.models.oc import CotizacionProveedor, SolicitudOC

log = logging.getLogger(__name__)

_PLATFORMS_DIR_EMAIL = _Path(__file__).parent.parent / "platforms"

_SLUG_MAP_EMAIL: dict[str, str] = {
    "logimat": "logimat",
    "logimat s.a.s.": "logimat",
    "imccargo": "imccargo",
    "imc cargo": "imccargo",
    "imc cargo international": "imccargo",
    "imc cargo international s.a.s.": "imccargo",
    "imcdep": "imcdep",
    "imc deposito": "imcdep",
    "imc depósito": "imcdep",
    "imc deposito s.a.s.": "imcdep",
    "imc depósito s.a.s.": "imcdep",
}

# Branding por defecto — datos genéricos del grupo. NITs y datos específicos van en config.json
_BRANDING_DEFAULTS: dict[str, str] = {
    "empresa_nombre": "Conexiones Logísticas",
    "empresa_color":  "#2563EB",
    "empresa_nit":    "",
    "empresa_tel":    "",
    "empresa_dir":    "Bogotá, Colombia",
    "empresa_dept":   "Departamento de Compras",
    "email_prefijo":  "[Compras Conexiones Logísticas]",
}

_INTRO_DEFAULTS: dict[str, str] = {
    "email_intro_flujo1": (
        "Tu solicitud de compra ha sido recibida y un auxiliar de compras ya está trabajando en ella. "
        "Te notificaremos en cuanto tengamos una cotización lista."
    ),
    "email_intro_flujo2": (
        "Ya tenemos una cotización lista para tu solicitud. Está en proceso de aprobación por la dirección. "
        "Te notificaremos cuando la orden de compra sea enviada al proveedor."
    ),
    "email_intro_flujo3": "Hay una solicitud de compra que requiere tu aprobación:",
    "email_intro_flujo4": (
        "La Orden de Compra para tu solicitud ha sido generada y enviada al proveedor."
    ),
}


def _load_platform_branding(plataforma: str | None) -> dict[str, str]:
    """Lee campos de branding desde platforms/{slug}/config.json.

    Retorna dict vacío si no se reconoce la plataforma o el archivo no existe.
    """
    if not plataforma:
        return {}
    slug = _SLUG_MAP_EMAIL.get(plataforma.lower().strip())
    if not slug:
        return {}
    cfg_path = _PLATFORMS_DIR_EMAIL / slug / "config.json"
    if not cfg_path.exists():
        return {}
    try:
        cfg = _json.loads(cfg_path.read_text(encoding="utf-8"))
        return {
            "empresa_nombre": cfg.get("nombre", ""),
            "empresa_color":  cfg.get("empresa_color", ""),
            "empresa_nit":    cfg.get("nit", ""),
            "empresa_tel":    cfg.get("pbx", ""),
            "empresa_dir":    cfg.get("ciudad", cfg.get("direccion_entrega", "")),
            "empresa_dept":   cfg.get("empresa_dept", ""),
            "email_prefijo":  cfg.get("email_prefijo", ""),
        }
    except Exception as exc:
        log.warning("[email] No se pudo leer config de plataforma '%s': %s", slug, exc)
        return {}


def _logo_base64(plataforma: str | None) -> str:
    """Retorna el logo de la plataforma como data URI base64 para incrustar en HTML.

    Retorna string vacío si no se encuentra o no se reconoce la plataforma.
    """
    if not plataforma:
        return ""
    slug = _SLUG_MAP_EMAIL.get(plataforma.lower().strip())
    if not slug:
        return ""
    cfg_path = _PLATFORMS_DIR_EMAIL / slug / "config.json"
    if not cfg_path.exists():
        return ""
    try:
        cfg = _json.loads(cfg_path.read_text(encoding="utf-8"))
        logo_filename = cfg.get("logo")
        if not logo_filename:
            return ""
        logo_path = _PLATFORMS_DIR_EMAIL / slug / logo_filename
        if not logo_path.exists():
            return ""
        mime, _ = _mimetypes.guess_type(str(logo_path))
        mime = mime or "image/jpeg"
        data = _base64.b64encode(logo_path.read_bytes()).decode()
        return f"data:{mime};base64,{data}"
    except Exception as exc:
        log.warning("[email] No se pudo cargar logo para '%s': %s", slug, exc)
        return ""


def _b(cfg: Optional[dict], key: str) -> str:
    """Lee un valor de branding del cfg con fallback a _BRANDING_DEFAULTS."""
    if cfg:
        v = cfg.get(key)
        if v:
            return v
    return _BRANDING_DEFAULTS.get(key, "")


def _intro(cfg: Optional[dict], key: str, solicitante: str = "") -> str:
    """Lee el texto de intro del cfg; reemplaza {solicitante} si aparece."""
    if cfg:
        v = cfg.get(key, "").strip()
        if v:
            return v.replace("{solicitante}", solicitante)
    return _INTRO_DEFAULTS.get(key, "").replace("{solicitante}", solicitante)


# ── Configuración SMTP ────────────────────────────────────────────────────────

def _get_runtime_config(plataforma: str | None = None) -> dict:
    """Lee la config SMTP y branding de oc_config (DB), con fallback a settings/.env.

    Si se proporciona `plataforma`, aplica branding específico de esa plataforma
    encima de los defaults. La DB sobreescribe todo.
    """
    from sqlmodel import Session, select
    from app.models.oc import OcConfig
    from app.oc_database import get_oc_engine

    cfg: dict = {
        "smtp_user":       settings.smtp_user,
        "smtp_password":   settings.smtp_password,
        "smtp_from":       settings.smtp_from or settings.smtp_user,
        "smtp_host":       settings.smtp_host,
        "smtp_port":       settings.smtp_port,
        "email_directora": settings.email_directora,
        "email_compras":   "",
        "intranet_url":    settings.intranet_url,
        **_BRANDING_DEFAULTS,
        "email_intro_flujo1": "",
        "email_intro_flujo2": "",
        "email_intro_flujo3": "",
        "email_intro_flujo4": "",
    }

    # Capa 1: branding de la plataforma (desde config.json)
    for k, v in _load_platform_branding(plataforma).items():
        if v:
            cfg[k] = v

    # Capa 2: valores de la DB sobreescriben todo
    try:
        with Session(get_oc_engine()) as db:
            for row in db.exec(select(OcConfig)).all():
                if row.key in cfg and row.value:
                    cfg[row.key] = int(row.value) if row.key == "smtp_port" else row.value
    except Exception as exc:
        log.warning("[email] No se pudo leer oc_config de DB: %s", exc)

    return cfg


def _build_conf(cfg: dict) -> ConnectionConfig:
    """Construye la configuración fastapi-mail a partir de un dict de runtime config."""
    return ConnectionConfig(
        MAIL_USERNAME=cfg["smtp_user"],
        MAIL_PASSWORD=cfg["smtp_password"],
        MAIL_FROM=cfg["smtp_from"] or cfg["smtp_user"],
        MAIL_FROM_NAME=f"Compras {cfg.get('empresa_nombre', 'LOGIMAT S.A.S.')}",
        MAIL_PORT=cfg["smtp_port"],
        MAIL_SERVER=cfg["smtp_host"],
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def _send_html(
    cfg: dict,
    subject: str,
    recipients: list[str],
    body: str,
    flujo: str,
    cc: Optional[list[str]] = None,
) -> None:
    """Envía un correo HTML. Centraliza el manejo de errores SMTP para todos los flujos."""
    msg = MessageSchema(
        subject=subject,
        recipients=recipients,
        cc=cc or [],
        body=body,
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf(cfg)).send_message(msg)
        log.info("[email] %s enviado a %s", flujo, recipients)
    except Exception:
        log.exception("[email] Error enviando %s a %s", flujo, recipients)


# ── Utilidades de formato ─────────────────────────────────────────────────────

def _fmt_fecha(dt) -> str:
    """Formatea un datetime UTC → hora Colombia (America/Bogota)."""
    if dt is None:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt_col = dt.astimezone(ZoneInfo("America/Bogota"))
    meses = ["ene", "feb", "mar", "abr", "may", "jun",
             "jul", "ago", "sep", "oct", "nov", "dic"]
    hora = dt_col.strftime("%I:%M %p").lstrip("0").lower()
    return f"{dt_col.day} de {meses[dt_col.month - 1]}. de {dt_col.year}, {hora}"


def _fmt_cop(value) -> str:
    if value is None:
        return "—"
    return f"${value:,.0f} COP"


# ── Templates HTML ────────────────────────────────────────────────────────────

def _base(titulo: str, cuerpo: str, cfg: Optional[dict] = None, logo_uri: str = "") -> str:
    nombre = _b(cfg, "empresa_nombre")
    color  = _b(cfg, "empresa_color")
    nit    = _b(cfg, "empresa_nit")
    tel    = _b(cfg, "empresa_tel")
    dir_   = _b(cfg, "empresa_dir")
    dept   = _b(cfg, "empresa_dept")
    logo_html = (
        f'<img src="{logo_uri}" alt="{nombre}" '
        f'style="max-height:44px;max-width:140px;object-fit:contain;vertical-align:middle;margin-right:12px">'
        if logo_uri else ""
    )
    footer_nit = f" · NIT: {nit}" if nit else ""
    footer_tel = f" · PBX: {tel}" if tel else ""
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px">
      <div style="background:{color};padding:16px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:12px">
        {logo_html}
        <div>
          <h2 style="color:#fff;margin:0;font-size:18px;letter-spacing:1px">{nombre}</h2>
          <p style="color:rgba(255,255,255,0.75);margin:2px 0 0;font-size:12px">{dept}</p>
        </div>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none">
        <h3 style="color:#111827;margin-top:0;font-size:16px">{titulo}</h3>
        {cuerpo}
        <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:11px;margin:0">
          Este correo fue generado automáticamente por el sistema de compras de {nombre}.
          Por favor no responda a este mensaje.
        </p>
      </div>
      <div style="background:#f9fafb;padding:10px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center">
          {nombre}{footer_nit} · {dir_}{footer_tel}
        </p>
      </div>
    </div>
    """


def _fila(label: str, value: str, destacar: bool = False, cfg: Optional[dict] = None) -> str:
    accent = _b(cfg, "empresa_color") if destacar else "#111827"
    weight = "bold" if destacar else "normal"
    return f"""
      <tr>
        <td style="padding:9px 14px;background:#f3f4f6;font-weight:600;font-size:13px;
                   width:38%;border-bottom:1px solid #f0f0f0;color:#374151">{label}</td>
        <td style="padding:9px 14px;background:#fff;font-size:13px;
                   border-bottom:1px solid #f0f0f0;color:{accent};font-weight:{weight}">{value}</td>
      </tr>"""


def _tabla(*filas: str) -> str:
    return f"""
    <table style="width:100%;border-collapse:collapse;margin:16px 0;
                  border-radius:6px;overflow:hidden;border:1px solid #e5e7eb">
      {''.join(filas)}
    </table>"""


def _tabla_items(items: list[dict]) -> str:
    """Genera una tabla HTML con el detalle de ítems de una cotización multi-producto."""
    filas_html = ""
    for item in items:
        desc  = item.get("descripcion") or "—"
        ref   = item.get("referencia") or ""
        cant  = item.get("cantidad") or "—"
        vunit = _fmt_cop(item.get("valor_unitario")) if item.get("valor_unitario") else "—"
        vtot  = _fmt_cop(item.get("valor_total")) if item.get("valor_total") else "—"
        ref_cell = f"<br/><span style='color:#9ca3af;font-size:11px'>Ref: {ref}</span>" if ref else ""
        filas_html += f"""
        <tr>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151">
            {desc}{ref_cell}
          </td>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:center">{cant}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:right">{vunit}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:right">{vtot}</td>
        </tr>"""

    return f"""
    <table style="width:100%;border-collapse:collapse;margin:16px 0;
                  border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;font-size:13px">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Descripción</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600">Cant.</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">V. Unitario</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">V. Total</th>
        </tr>
      </thead>
      <tbody>{filas_html}</tbody>
    </table>"""


# ── Flujo 1 — En gestión → solicitante ───────────────────────────────────────

def _html_en_gestion(s: "SolicitudOC", cfg: Optional[dict] = None, logo_uri: str = "") -> str:
    intro = _intro(cfg, "email_intro_flujo1", s.solicitante_nombre)
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">{intro}</p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Cantidad", str(s.cantidad)),
        _fila("Prioridad", s.nivel_prioridad),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Estado", "🔄 En gestión"),
    )}
    <p style="color:#6b7280;font-size:13px">
      Si tienes alguna duda, puedes comunicarte con el equipo de compras.
    </p>
    """
    return _base("Tu solicitud está siendo gestionada", cuerpo, cfg, logo_uri=logo_uri)


# ── Flujo 2 — Cotización lista → solicitante ─────────────────────────────────

def _html_cotizacion_lista(s: "SolicitudOC", cfg: Optional[dict] = None, logo_uri: str = "") -> str:
    intro = _intro(cfg, "email_intro_flujo2", s.solicitante_nombre)
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">{intro}</p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Fecha de cotización", _fmt_fecha(s.fecha_cotizacion)),
        _fila("Estado", "⏳ Pendiente de aprobación"),
    )}
    """
    return _base("Cotización lista — pendiente de aprobación", cuerpo, cfg, logo_uri=logo_uri)


# ── Flujo 3 — Aprobación directora ───────────────────────────────────────────

def _html_aprobacion_directora(
    s: "SolicitudOC",
    cot: Optional["CotizacionProveedor"],
    cfg: Optional[dict] = None,
    logo_uri: str = "",
) -> str:
    intro = _intro(cfg, "email_intro_flujo3")
    seccion_cotizacion = ""
    if cot:
        filas_cot = "".join([
            _fila("Proveedor", cot.proveedor_nombre or "—"),
            _fila("NIT proveedor", cot.proveedor_nit or "—"),
            _fila("N° cotización", cot.numero_cotizacion_proveedor or "—"),
            _fila("Subtotal", _fmt_cop(cot.valor_antes_iva)),
            _fila("IVA", _fmt_cop(cot.valor_iva) if cot.valor_iva else "No aplica"),
            _fila("VALOR TOTAL", _fmt_cop(cot.valor_total), destacar=True, cfg=cfg),
            _fila("Forma de pago", cot.forma_pago or "—"),
            _fila("Plazo de entrega", cot.plazo_entrega or "—"),
        ])
        seccion_cotizacion = f"""
        <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:4px">💰 Cotización</p>
        {_tabla(filas_cot)}
        """
        if cot.items:
            seccion_cotizacion += f"""
            <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:4px">
              📦 Detalle de ítems ({len(cot.items)} productos)
            </p>
            {_tabla_items(cot.items)}
            """

    cuerpo = f"""
    <p style="color:#374151;font-size:14px">{intro}</p>
    <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:4px">📋 Datos de la solicitud</p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Solicitante", s.solicitante_nombre),
        _fila("Área", s.area_solicitante or "—"),
        _fila("Plataforma", s.plataforma or "—"),
        _fila("Prioridad", s.nivel_prioridad),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Fecha de cotización", _fmt_fecha(s.fecha_cotizacion)),
    )}
    {seccion_cotizacion}
    <p style="color:#374151;font-size:14px">
      Ingresa a la intranet para revisar y <strong>aprobar o rechazar</strong> la cotización.
    </p>
    """
    return _base(f"Aprobación requerida — {s.consecutivo_os}", cuerpo, cfg, logo_uri=logo_uri)


# ── Flujo 4 — OC enviada → solicitante ───────────────────────────────────────

def _html_oc_enviada(s: "SolicitudOC", cfg: Optional[dict] = None, logo_uri: str = "") -> str:
    intro = _intro(cfg, "email_intro_flujo4", s.solicitante_nombre)
    fila_entrega = _fila(
        "Fecha estimada de entrega",
        str(s.fecha_estimada_entrega) if s.fecha_estimada_entrega else "Por confirmar"
    )
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">{intro}</p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Fecha de envío OC", _fmt_fecha(s.fecha_envio_oc)),
        fila_entrega,
        _fila("Estado", "✅ OC enviada al proveedor"),
    )}
    <p style="color:#6b7280;font-size:13px">
      El equipo de compras te mantendrá informado sobre la entrega.
    </p>
    """
    return _base("Tu Orden de Compra fue enviada al proveedor", cuerpo, cfg, logo_uri=logo_uri)


# ── OC al proveedor ───────────────────────────────────────────────────────────

def _html_oc_proveedor(
    s: "SolicitudOC",
    numero_oc: str,
    items: Optional[list[dict]] = None,
    cfg: Optional[dict] = None,
    logo_uri: str = "",
) -> str:
    nombre_empresa = _b(cfg, "empresa_nombre")
    if items:
        detalle = f"""
        <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:4px">
          📦 Detalle del pedido ({len(items)} productos)
        </p>
        {_tabla_items(items)}
        """
    else:
        detalle = _tabla(
            _fila("Descripción", s.descripcion),
            _fila("Cantidad", str(s.cantidad)),
        )

    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Estimado proveedor,</p>
    <p style="color:#374151;font-size:14px">
      Adjunto encontrará la Orden de Compra <strong>{numero_oc}</strong> emitida por {nombre_empresa}.
      Por favor revísela y confírmenos su recepción junto con la fecha estimada de entrega.
    </p>
    {_tabla(
        _fila("N° Orden de Compra", numero_oc),
        _fila("Consecutivo OS", s.consecutivo_os),
        _fila("Fecha de emisión", _fmt_fecha(s.fecha_envio_oc or s.updated_at)),
    )}
    {detalle}
    <p style="color:#374151;font-size:14px">
      Para cualquier consulta, comuníquese con nuestro departamento de compras.
    </p>
    <p style="color:#374151;font-size:14px">Gracias por su atención.</p>
    """
    return _base(f"Orden de Compra {numero_oc}", cuerpo, cfg, logo_uri=logo_uri)


# ── Flujo Interno — Nueva solicitud → equipo de compras ──────────────────────

def _html_nueva_solicitud_interna(
    s: "SolicitudOC",
    intranet_url: str,
    cfg: Optional[dict] = None,
    logo_uri: str = "",
) -> str:
    color = _b(cfg, "empresa_color")
    link = f"{intranet_url}/oc/solicitudes/{s.id}"
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">
      <strong>{s.solicitante_nombre}</strong> del área <strong>{s.area_solicitante or "—"}</strong>
      está solicitando un nuevo artículo.
    </p>
    <p style="color:#374151;font-size:14px">A continuación se detalla con claridad:</p>
    {_tabla(
        _fila("Grupo de artículo", s.grupo_articulos or "—"),
        _fila("Detalle de la solicitud", s.descripcion),
        _fila("Cantidad solicitada", str(s.cantidad)),
        _fila("Plataforma", s.plataforma or "—"),
        _fila("Prioridad", s.nivel_prioridad),
        _fila("Fecha del registro", _fmt_fecha(s.fecha_solicitud)),
    )}
    <p style="color:#374151;font-size:14px">
      Para acceder a la solicitud haga click
      <a href="{link}" style="color:{color};font-weight:600">📋 aquí →</a>
    </p>
    <p style="color:#374151;font-size:14px">
      Agradecemos gestionar esta solicitud conforme a los procedimientos establecidos.
    </p>
    <p style="color:#374151;font-size:14px">
      Cordialmente,<br/><strong>{s.solicitante_nombre}</strong>
    </p>
    """
    return _base(f"Nueva solicitud de compra — {s.consecutivo_os}", cuerpo, cfg, logo_uri=logo_uri)


# ── Funciones públicas (llamar desde background tasks) ────────────────────────

async def send_en_gestion(s: "SolicitudOC") -> None:
    """Flujo 1 — email al solicitante cuando el auxiliar toma la solicitud."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 1")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 1: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Tu solicitud está siendo gestionada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_en_gestion(s, cfg, logo_uri=logo_uri),
        flujo="Flujo 1",
    )


async def send_cotizacion_lista(s: "SolicitudOC") -> None:
    """Flujo 2 — email al solicitante cuando hay cotizaciones listas."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 2")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 2: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Cotización lista — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_cotizacion_lista(s, cfg, logo_uri=logo_uri),
        flujo="Flujo 2",
    )


async def send_aprobacion_directora(
    s: "SolicitudOC",
    cotizacion: Optional["CotizacionProveedor"] = None,
) -> None:
    """Flujo 3 — email a la directora con detalle completo de la cotización."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 3")
        return
    directora_email = cfg["email_directora"]
    if not directora_email:
        log.warning("[email] Flujo 3: EMAIL_DIRECTORA no configurado")
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Aprobación requerida — {s.consecutivo_os}",
        recipients=[directora_email],
        body=_html_aprobacion_directora(s, cotizacion, cfg, logo_uri=logo_uri),
        flujo="Flujo 3",
    )


async def send_oc_a_proveedor(
    s: "SolicitudOC",
    numero_oc: str,
    pdf_path: str | None,
    email_proveedor: str,
    items: Optional[list[dict]] = None,
) -> None:
    """Envía el documento OC al proveedor como adjunto + CC al solicitante."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo envío OC a proveedor")
        return

    archivo: Path | None = None
    if pdf_path:
        p = Path(pdf_path)
        if p.exists():
            archivo = p

    if archivo is None:
        log.error(
            "[email] OC %s: PDF no encontrado en '%s' — correo al proveedor no enviado",
            numero_oc, pdf_path,
        )
        return

    # CC al solicitante si tiene email registrado
    cc_list = [s.solicitante_email] if s.solicitante_email else []

    logo_uri = _logo_base64(s.plataforma)
    nombre_empresa = _b(cfg, "empresa_nombre")
    msg = MessageSchema(
        subject=f"Orden de Compra {numero_oc} — {nombre_empresa}",
        recipients=[email_proveedor],
        cc=cc_list,
        body=_html_oc_proveedor(s, numero_oc, items=items, cfg=cfg, logo_uri=logo_uri),
        subtype=MessageType.html,
        attachments=[{
            "file": str(archivo),
            "mime_type": "application",
            "mime_subtype": "pdf",
            "headers": {
                "Content-Disposition": f'attachment; filename="{numero_oc}.pdf"',
                "Content-ID": f"<{numero_oc}>",
            },
        }],
    )
    try:
        await FastMail(_build_conf(cfg)).send_message(msg)
        log.info("[email] OC %s enviada a proveedor %s (cc: %s)", numero_oc, email_proveedor, cc_list)
    except Exception:
        log.exception("[email] Error enviando OC %s a proveedor %s", numero_oc, email_proveedor)


async def send_oc_enviada(s: "SolicitudOC") -> None:
    """Flujo 4 — email al solicitante cuando la OC fue enviada al proveedor."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 4")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 4: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Orden de Compra enviada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_oc_enviada(s, cfg, logo_uri=logo_uri),
        flujo="Flujo 4",
    )


# ── Entrega confirmada → solicitante ─────────────────────────────────────────

def _html_entrega_confirmada(s: "SolicitudOC", cfg: Optional[dict] = None, logo_uri: str = "") -> str:
    """HTML para notificar al solicitante que su pedido fue confirmado como entregado."""
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">
      El coordinador ha confirmado la recepción física de tu pedido. Tu solicitud queda marcada como entregada.
    </p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Fecha de envío OC", _fmt_fecha(s.fecha_envio_oc)),
        _fila("Fecha de recepción", _fmt_fecha(s.fecha_recibido)),
        _fila("Estado", "✅ Entregado"),
    )}
    <p style="color:#6b7280;font-size:13px">
      Si tienes alguna observación sobre el pedido recibido, comunícate con el equipo de compras.
    </p>
    """
    return _base("Tu pedido fue recibido y confirmado", cuerpo, cfg, logo_uri=logo_uri)


async def send_entrega_confirmada(s: "SolicitudOC") -> None:
    """Notifica al solicitante cuando coordinador confirma la recepción física."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo notificación entrega confirmada")
        return
    if not s.solicitante_email:
        log.warning("[email] Entrega confirmada: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Pedido recibido — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_entrega_confirmada(s, cfg, logo_uri=logo_uri),
        flujo="Entrega confirmada",
    )


# ── Rechazo de Solicitud → solicitante ───────────────────────────────────────

def _html_solicitud_rechazada(
    s: "SolicitudOC",
    motivo: str,
    usuario_rechazo: str,
    cfg: Optional[dict] = None,
    logo_uri: str = "",
) -> str:
    """Notifica al solicitante que su solicitud fue rechazada."""
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">
      El equipo de compras ha <strong>rechazado</strong> tu solicitud.
      A continuación encontrarás el detalle y el motivo del rechazo para que puedas ajustarla si es necesario.
    </p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Fecha de rechazo", _fmt_fecha(s.updated_at)),
        _fila("Rechazada por", usuario_rechazo),
        _fila("Motivo del rechazo", motivo, destacar=True, cfg=cfg),
    )}
    <p style="color:#6b7280;font-size:13px">
      Si tienes alguna duda sobre este rechazo, comunícate con compras o vuelve a generar la solicitud con los ajustes necesarios.
    </p>
    """
    return _base(f"Solicitud rechazada — {s.consecutivo_os}", cuerpo, cfg, logo_uri=logo_uri)


async def send_solicitud_rechazada(s: "SolicitudOC", motivo: str, usuario_rechazo: str) -> None:
    """Flujo rechazo — email al solicitante cuando compras rechaza la solicitud entera."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo notificación rechazo solicitud")
        return
    if not s.solicitante_email:
        log.warning("[email] Rechazo solicitud: %s sin email de solicitante", s.consecutivo_os)
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Solicitud rechazada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_solicitud_rechazada(s, motivo, usuario_rechazo, cfg, logo_uri=logo_uri),
        flujo="Rechazo solicitud",
    )


# ── Rechazo de cotización → auxiliar ─────────────────────────────────────────

def _html_rechazo_cotizacion(s: "SolicitudOC", motivo: str, cfg: Optional[dict] = None, logo_uri: str = "") -> str:
    """Notifica al auxiliar de compras que la cotización fue rechazada."""
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">
      La directora ha rechazado la cotización para la siguiente solicitud.
      Por favor busca una nueva cotización.
    </p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Estado", "🔄 En cotización"),
        _fila("Motivo del rechazo", motivo, destacar=True, cfg=cfg),
    )}
    <p style="color:#374151;font-size:14px">
      Ingresa a la intranet para gestionar una nueva cotización para esta solicitud.
    </p>
    """
    return _base(f"Cotización rechazada — {s.consecutivo_os}", cuerpo, cfg, logo_uri=logo_uri)


async def send_rechazo_cotizacion(s: "SolicitudOC", motivo: str, auxiliar_email: str) -> None:
    """Flujo rechazo — email al auxiliar cuando directora rechaza la cotización."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo notificación rechazo cotización")
        return
    if not auxiliar_email:
        log.warning("[email] Rechazo cotización: solicitud %s sin email de auxiliar", s.consecutivo_os)
        return

    logo_uri = _logo_base64(s.plataforma)
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Cotización rechazada — {s.consecutivo_os}",
        recipients=[auxiliar_email],
        body=_html_rechazo_cotizacion(s, motivo, cfg, logo_uri=logo_uri),
        flujo="Rechazo cotización",
    )


async def send_nueva_solicitud_interna(s: "SolicitudOC") -> None:
    """Flujo Interno — notifica al equipo de compras cuando un coordinador crea una solicitud."""
    cfg = _get_runtime_config(plataforma=s.plataforma)
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo notificación interna")
        return

    email_compras = cfg.get("email_compras") or cfg.get("email_directora")
    if not email_compras:
        log.warning("[email] Flujo Interno: email_compras no configurado")
        return

    logo_uri = _logo_base64(s.plataforma)
    intranet_url = cfg.get("intranet_url") or settings.intranet_url
    prefijo = _b(cfg, "email_prefijo")
    await _send_html(
        cfg,
        subject=f"{prefijo} Nueva solicitud — {s.consecutivo_os} | {s.solicitante_nombre}",
        recipients=[email_compras],
        body=_html_nueva_solicitud_interna(s, intranet_url, cfg, logo_uri=logo_uri),
        flujo="Flujo Interno",
    )
