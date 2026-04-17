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
from datetime import timezone
from pathlib import Path
from typing import TYPE_CHECKING, Optional
from zoneinfo import ZoneInfo

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
        "email_compras": "",
        "intranet_url": settings.intranet_url,
    }
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
        MAIL_FROM_NAME="Compras LOGIMAT",
        MAIL_PORT=cfg["smtp_port"],
        MAIL_SERVER=cfg["smtp_host"],
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def _send_html(cfg: dict, subject: str, recipients: list[str], body: str, flujo: str) -> None:
    """Envía un correo HTML. Centraliza el manejo de errores SMTP para todos los flujos."""
    msg = MessageSchema(subject=subject, recipients=recipients, body=body, subtype=MessageType.html)
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


def _tabla_items(items: list[dict]) -> str:
    """Genera una tabla HTML con el detalle de ítems de una cotización multi-producto."""
    filas_html = ""
    for item in items:
        desc = item.get("descripcion") or "—"
        ref = item.get("referencia") or ""
        cant = item.get("cantidad") or "—"
        vunit = _fmt_cop(item.get("valor_unitario")) if item.get("valor_unitario") else "—"
        vtotal = _fmt_cop(item.get("valor_total")) if item.get("valor_total") else "—"
        ref_cell = f"<br/><span style='color:#9ca3af;font-size:11px'>Ref: {ref}</span>" if ref else ""
        filas_html += f"""
        <tr>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151">
            {desc}{ref_cell}
          </td>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:center">{cant}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:right">{vunit}</td>
          <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;text-align:right">{vtotal}</td>
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
    seccion_cotizacion = ""
    if cot:
        filas_cot = "".join([
            _fila("Proveedor", cot.proveedor_nombre or "—"),
            _fila("NIT proveedor", cot.proveedor_nit or "—"),
            _fila("N° cotización", cot.numero_cotizacion_proveedor or "—"),
            _fila("Subtotal", _fmt_cop(cot.valor_antes_iva)),
            _fila("IVA", _fmt_cop(cot.valor_iva) if cot.valor_iva else "No aplica"),
            _fila("VALOR TOTAL", _fmt_cop(cot.valor_total), destacar=True),
            _fila("Forma de pago", cot.forma_pago or "—"),
            _fila("Plazo de entrega", cot.plazo_entrega or "—"),
        ])
        seccion_cotizacion = f"""
        <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:4px">💰 Cotización</p>
        {_tabla(filas_cot)}
        """
        # Si hay múltiples ítems, mostrar la tabla de detalle
        if cot.items:
            seccion_cotizacion += f"""
            <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:4px">
              📦 Detalle de ítems ({len(cot.items)} productos)
            </p>
            {_tabla_items(cot.items)}
            """

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
    {seccion_cotizacion}
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

def _html_oc_proveedor(
    s: "SolicitudOC",
    numero_oc: str,
    items: Optional[list[dict]] = None,
) -> str:
    # Si hay ítems múltiples, mostrar tabla; si no, una sola fila de descripción
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
      Adjunto encontrará la Orden de Compra <strong>{numero_oc}</strong> emitida por LOGIMAT S.A.S.
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
    return _base(f"Orden de Compra {numero_oc}", cuerpo)


# ── Funciones públicas (llamar desde background tasks) ────────────────────────

async def send_en_gestion(s: "SolicitudOC") -> None:
    """Flujo 1 — email al solicitante cuando el auxiliar toma la solicitud."""
    cfg = _get_runtime_config()
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 1")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 1: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    await _send_html(
        cfg,
        subject=f"[Compras LOGIMAT] Tu solicitud está siendo gestionada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_en_gestion(s),
        flujo="Flujo 1",
    )


async def send_cotizacion_lista(s: "SolicitudOC") -> None:
    """Flujo 2 — email al solicitante cuando hay cotizaciones listas."""
    cfg = _get_runtime_config()
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 2")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 2: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    await _send_html(
        cfg,
        subject=f"[Compras LOGIMAT] Cotización lista — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_cotizacion_lista(s),
        flujo="Flujo 2",
    )


async def send_aprobacion_directora(
    s: "SolicitudOC",
    cotizacion: Optional["CotizacionProveedor"] = None,
) -> None:
    """Flujo 3 — email a la directora con detalle completo de la cotización."""
    cfg = _get_runtime_config()
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 3")
        return
    directora_email = cfg["email_directora"]
    if not directora_email:
        log.warning("[email] Flujo 3: EMAIL_DIRECTORA no configurado")
        return

    await _send_html(
        cfg,
        subject=f"[Compras LOGIMAT] Aprobación requerida — {s.consecutivo_os}",
        recipients=[directora_email],
        body=_html_aprobacion_directora(s, cotizacion),
        flujo="Flujo 3",
    )


async def send_oc_a_proveedor(
    s: "SolicitudOC",
    numero_oc: str,
    pdf_path: str | None,
    email_proveedor: str,
    items: Optional[list[dict]] = None,
) -> None:
    """Envía el documento OC al proveedor como adjunto."""
    cfg = _get_runtime_config()
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo envío OC a proveedor")
        return

    archivo: Path | None = None
    if pdf_path:
        p = Path(pdf_path)
        if p.exists():
            archivo = p
    if archivo is None:
        xlsx = Path(f"/app/data/oc_docs/{numero_oc}.xlsx")
        if xlsx.exists():
            archivo = xlsx

    if archivo is None:
        log.warning("[email] No se encontró el archivo OC %s para enviar al proveedor", numero_oc)
        return

    ext = archivo.suffix.lstrip(".")
    _mime_map = {
        "pdf": "pdf",
        "xlsx": "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "docx": "vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    mime_subtype = _mime_map.get(ext, "octet-stream")

    msg = MessageSchema(
        subject=f"Orden de Compra {numero_oc} — LOGIMAT S.A.S.",
        recipients=[email_proveedor],
        body=_html_oc_proveedor(s, numero_oc, items=items),
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
        await FastMail(_build_conf(cfg)).send_message(msg)
        log.info("[email] OC %s enviada a proveedor %s", numero_oc, email_proveedor)
    except Exception:
        log.exception("[email] Error enviando OC %s a proveedor %s", numero_oc, email_proveedor)


async def send_oc_enviada(s: "SolicitudOC") -> None:
    """Flujo 4 — email al solicitante cuando la OC fue enviada al proveedor."""
    cfg = _get_runtime_config()
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo Flujo 4")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 4: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    await _send_html(
        cfg,
        subject=f"[Compras LOGIMAT] Orden de Compra enviada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_oc_enviada(s),
        flujo="Flujo 4",
    )


# ── Flujo Interno — Nueva solicitud → equipo de compras ──────────────────────

def _html_nueva_solicitud_interna(s: "SolicitudOC", intranet_url: str) -> str:
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
      <a href="{link}" style="color:#C8102E;font-weight:600">📋 aquí →</a>
    </p>
    <p style="color:#374151;font-size:14px">
      Agradecemos gestionar esta solicitud conforme a los procedimientos establecidos.
    </p>
    <p style="color:#374151;font-size:14px">
      Cordialmente,<br/><strong>{s.solicitante_nombre}</strong>
    </p>
    """
    return _base(f"Nueva solicitud de compra — {s.consecutivo_os}", cuerpo)


async def send_nueva_solicitud_interna(s: "SolicitudOC") -> None:
    """Flujo Interno — notifica al equipo de compras cuando un coordinador crea una solicitud."""
    cfg = _get_runtime_config()
    if not (cfg["smtp_user"] and cfg["smtp_password"]):
        log.warning("[email] SMTP no configurado — omitiendo notificación interna")
        return

    email_compras = cfg.get("email_compras") or cfg.get("email_directora")
    if not email_compras:
        log.warning("[email] Flujo Interno: email_compras no configurado")
        return

    intranet_url = cfg.get("intranet_url") or settings.intranet_url

    await _send_html(
        cfg,
        subject=f"[Compras] Nueva solicitud — {s.consecutivo_os} | {s.solicitante_nombre}",
        recipients=[email_compras],
        body=_html_nueva_solicitud_interna(s, intranet_url),
        flujo="Flujo Interno",
    )
