"""
Servicio de correo electrónico para el módulo OC.
Usa fastapi-mail con SMTP de Office 365.

Flujos implementados:
  Flujo 1 — En gestión         → solicitante (estado: en_cotizacion)
  Flujo 2 — Cotización Lista   → solicitante (estado: pendiente_aprobacion)
  Flujo 3 — Aprobación Dir.    → directora   (estado: pendiente_aprobacion)  ← incluye valor cotización
  Flujo 4 — OC Enviada         → solicitante (estado: oc_enviada)
  Flujo OC Proveedor           → proveedor   (adjunto DOCX/PDF)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config import settings

if TYPE_CHECKING:
    from app.models.oc import CotizacionProveedor, SolicitudOC

log = logging.getLogger(__name__)

# ── Configuración SMTP ────────────────────────────────────────────────────────

def _get_runtime_config() -> dict:
    """Lee la config SMTP de oc_config (DB), con fallback a settings/.env."""
    from sqlmodel import Session, select
    from app.models.oc import OcConfig
    from app.oc_database import get_oc_engine

    cfg = {
        "smtp_user": settings.smtp_user,
        "smtp_password": settings.smtp_password,
        "smtp_from": settings.smtp_from or settings.smtp_user,
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "email_directora": settings.email_directora,
    }
    try:
        with Session(get_oc_engine()) as db:
            for row in db.exec(select(OcConfig)).all():
                if row.key in cfg and row.value:
                    cfg[row.key] = int(row.value) if row.key == "smtp_port" else row.value
    except Exception:
        pass
    return cfg


def _build_conf() -> ConnectionConfig:
    c = _get_runtime_config()
    return ConnectionConfig(
        MAIL_USERNAME=c["smtp_user"],
        MAIL_PASSWORD=c["smtp_password"],
        MAIL_FROM=c["smtp_from"] or c["smtp_user"],
        MAIL_FROM_NAME="Compras LOGIMAT",
        MAIL_PORT=c["smtp_port"],
        MAIL_SERVER=c["smtp_host"],
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


def _is_configured() -> bool:
    c = _get_runtime_config()
    return bool(c["smtp_user"] and c["smtp_password"])


def _get_directora_email() -> str:
    return _get_runtime_config()["email_directora"]


# ── Utilidades de formato ─────────────────────────────────────────────────────

def _fmt_fecha(dt) -> str:
    """Formatea un datetime UTC → hora Colombia (America/Bogota)."""
    if dt is None:
        return "—"
    from datetime import timezone
    from zoneinfo import ZoneInfo
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

def _base(titulo: str, cuerpo: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px">
      <div style="background:#C8102E;padding:16px 24px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:12px">
        <div>
          <h2 style="color:#fff;margin:0;font-size:18px;letter-spacing:1px">LOGIMAT S.A.S.</h2>
          <p style="color:rgba(255,255,255,0.75);margin:2px 0 0;font-size:12px">Departamento de Compras</p>
        </div>
      </div>
      <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none">
        <h3 style="color:#111827;margin-top:0;font-size:16px">{titulo}</h3>
        {cuerpo}
        <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:11px;margin:0">
          Este correo fue generado automáticamente por el sistema de compras de LOGIMAT S.A.S.
          Por favor no responda a este mensaje.
        </p>
      </div>
      <div style="background:#f9fafb;padding:10px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center">
          LOGIMAT S.A.S. · NIT: 830.103.877-6 · Zona Franca de Bogotá · PBX: (1) 7 44 92 00
        </p>
      </div>
    </div>
    """


def _fila(label: str, value: str, destacar: bool = False) -> str:
    bg_label = "#f3f4f6"
    bg_val = "#fff"
    color_val = "#C8102E" if destacar else "#111827"
    weight = "bold" if destacar else "normal"
    return f"""
      <tr>
        <td style="padding:9px 14px;background:{bg_label};font-weight:600;font-size:13px;
                   width:38%;border-bottom:1px solid #f0f0f0;color:#374151">{label}</td>
        <td style="padding:9px 14px;background:{bg_val};font-size:13px;
                   border-bottom:1px solid #f0f0f0;color:{color_val};font-weight:{weight}">{value}</td>
      </tr>"""


def _tabla(*filas: str) -> str:
    return f"""
    <table style="width:100%;border-collapse:collapse;margin:16px 0;
                  border-radius:6px;overflow:hidden;border:1px solid #e5e7eb">
      {''.join(filas)}
    </table>"""


# ── Flujo 1 — En gestión → solicitante ───────────────────────────────────────

def _html_en_gestion(s: "SolicitudOC") -> str:
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">
      Tu solicitud de compra ha sido recibida y un auxiliar de compras ya está trabajando en ella.
      Te notificaremos en cuanto tengamos una cotización lista.
    </p>
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
    return _base("Tu solicitud está siendo gestionada", cuerpo)


# ── Flujo 2 — Cotización lista → solicitante ─────────────────────────────────

def _html_cotizacion_lista(s: "SolicitudOC") -> str:
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">
      Ya tenemos una cotización lista para tu solicitud. Está en proceso de aprobación por la dirección.
      Te notificaremos cuando la orden de compra sea enviada al proveedor.
    </p>
    {_tabla(
        _fila("Consecutivo", s.consecutivo_os),
        _fila("Descripción", s.descripcion),
        _fila("Fecha de solicitud", _fmt_fecha(s.fecha_solicitud)),
        _fila("Fecha de cotización", _fmt_fecha(s.fecha_cotizacion)),
        _fila("Estado", "⏳ Pendiente de aprobación"),
    )}
    """
    return _base("Cotización lista — pendiente de aprobación", cuerpo)


# ── Flujo 3 — Aprobación directora ───────────────────────────────────────────

def _html_aprobacion_directora(s: "SolicitudOC", cot: Optional["CotizacionProveedor"]) -> str:
    filas_cot = ""
    if cot:
        filas_cot = "".join([
            _fila("Proveedor", cot.proveedor_nombre or "—"),
            _fila("NIT proveedor", cot.proveedor_nit or "—"),
            _fila("N° cotización", cot.numero_cotizacion_proveedor or "—"),
            _fila("Subtotal", _fmt_cop(cot.valor_antes_iva), destacar=False),
            _fila("IVA", _fmt_cop(cot.valor_iva) if cot.valor_iva else "No aplica"),
            _fila("VALOR TOTAL", _fmt_cop(cot.valor_total), destacar=True),
            _fila("Forma de pago", cot.forma_pago or "—"),
            _fila("Plazo de entrega", cot.plazo_entrega or "—"),
        ])

    cuerpo = f"""
    <p style="color:#374151;font-size:14px">
      Hay una solicitud de compra que requiere tu aprobación:
    </p>

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

    {"<p style='color:#374151;font-size:13px;font-weight:600;margin-bottom:4px'>💰 Detalle de la cotización</p>" + _tabla(filas_cot) if filas_cot else ""}

    <p style="color:#374151;font-size:14px">
      Ingresa a la intranet para revisar y <strong>aprobar o rechazar</strong> la cotización.
    </p>
    """
    return _base(f"Aprobación requerida — {s.consecutivo_os}", cuerpo)


# ── Flujo 4 — OC enviada → solicitante ───────────────────────────────────────

def _html_oc_enviada(s: "SolicitudOC") -> str:
    fila_entrega = _fila(
        "Fecha estimada de entrega",
        str(s.fecha_estimada_entrega) if s.fecha_estimada_entrega else "Por confirmar"
    )
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151;font-size:14px">
      La Orden de Compra para tu solicitud ha sido generada y enviada al proveedor.
    </p>
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
    return _base("Tu Orden de Compra fue enviada al proveedor", cuerpo)


# ── OC al proveedor ───────────────────────────────────────────────────────────

def _html_oc_proveedor(s: "SolicitudOC", numero_oc: str) -> str:
    cuerpo = f"""
    <p style="color:#374151;font-size:14px">Estimado proveedor,</p>
    <p style="color:#374151;font-size:14px">
      Adjunto encontrará la Orden de Compra <strong>{numero_oc}</strong> emitida por LOGIMAT S.A.S.
      Por favor revísela y confírmenos su recepción junto con la fecha estimada de entrega.
    </p>
    {_tabla(
        _fila("N° Orden de Compra", numero_oc),
        _fila("Descripción", s.descripcion),
        _fila("Consecutivo OS", s.consecutivo_os),
        _fila("Cantidad", str(s.cantidad)),
        _fila("Fecha de emisión", _fmt_fecha(s.fecha_envio_oc or s.updated_at)),
    )}
    <p style="color:#374151;font-size:14px">
      Para cualquier consulta sobre esta orden, puede comunicarse con nuestro departamento de compras.
    </p>
    <p style="color:#374151;font-size:14px">Gracias por su atención.</p>
    """
    return _base(f"Orden de Compra {numero_oc}", cuerpo)


# ── Funciones públicas (llamar desde background tasks) ────────────────────────

async def send_en_gestion(s: "SolicitudOC") -> None:
    """Flujo 1 — email al solicitante cuando el auxiliar toma la solicitud."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo Flujo 1")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 1: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    msg = MessageSchema(
        subject=f"[Compras LOGIMAT] Tu solicitud está siendo gestionada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_en_gestion(s),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 1 enviado a %s", s.solicitante_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 1 para %s", s.consecutivo_os)


async def send_cotizacion_lista(s: "SolicitudOC") -> None:
    """Flujo 2 — email al solicitante cuando hay cotizaciones listas."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo Flujo 2")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 2: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    msg = MessageSchema(
        subject=f"[Compras LOGIMAT] Cotización lista — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_cotizacion_lista(s),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 2 enviado a %s", s.solicitante_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 2 para %s", s.consecutivo_os)


async def send_aprobacion_directora(
    s: "SolicitudOC",
    cotizacion: Optional["CotizacionProveedor"] = None,
) -> None:
    """Flujo 3 — email a la directora con detalle completo de la cotización."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo Flujo 3")
        return
    directora_email = _get_directora_email()
    if not directora_email:
        log.warning("[email] Flujo 3: EMAIL_DIRECTORA no configurado")
        return

    msg = MessageSchema(
        subject=f"[Compras LOGIMAT] Aprobación requerida — {s.consecutivo_os}",
        recipients=[directora_email],
        body=_html_aprobacion_directora(s, cotizacion),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 3 enviado a directora (%s)", directora_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 3 para %s", s.consecutivo_os)


async def send_oc_a_proveedor(
    s: "SolicitudOC",
    numero_oc: str,
    pdf_path: str | None,
    email_proveedor: str,
) -> None:
    """Envía el documento OC al proveedor como adjunto."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo envío OC a proveedor")
        return

    from pathlib import Path
    archivo: Path | None = None
    if pdf_path:
        p = Path(pdf_path)
        if p.exists():
            archivo = p
    if archivo is None:
        docx = Path(f"/app/data/oc_docs/{numero_oc}.docx")
        if docx.exists():
            archivo = docx

    if archivo is None:
        log.warning("[email] No se encontró el archivo OC %s para enviar al proveedor", numero_oc)
        return

    ext = archivo.suffix.lstrip(".")
    mime_subtype = "pdf" if ext == "pdf" else "vnd.openxmlformats-officedocument.wordprocessingml.document"

    msg = MessageSchema(
        subject=f"Orden de Compra {numero_oc} — LOGIMAT S.A.S.",
        recipients=[email_proveedor],
        body=_html_oc_proveedor(s, numero_oc),
        subtype=MessageType.html,
        attachments=[{
            "file": str(archivo),
            "mime_type": "application",
            "mime_subtype": mime_subtype,
            "headers": {
                "Content-Disposition": f'attachment; filename="{numero_oc}.{ext}"',
                "Content-ID": f"<{numero_oc}>",
            },
        }],
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] OC %s enviada a proveedor %s", numero_oc, email_proveedor)
    except Exception:
        log.exception("[email] Error enviando OC %s a proveedor %s", numero_oc, email_proveedor)


async def send_oc_enviada(s: "SolicitudOC") -> None:
    """Flujo 4 — email al solicitante cuando la OC fue enviada al proveedor."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo Flujo 4")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 4: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    msg = MessageSchema(
        subject=f"[Compras LOGIMAT] Orden de Compra enviada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_oc_enviada(s),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 4 enviado a %s", s.solicitante_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 4 para %s", s.consecutivo_os)
