"""
Servicio de correo electrónico para el módulo OC.
Usa fastapi-mail con SMTP de Office 365.

Flujos implementados:
  Flujo 2 — Cotización Lista   → solicitante (estado: pendiente_aprobacion)
  Flujo 3 — Aprobación Dir.    → directora   (estado: pendiente_aprobacion)
  Flujo 4 — OC Enviada         → solicitante (estado: oc_enviada)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config import settings

if TYPE_CHECKING:
    from app.models.oc import SolicitudOC

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
        MAIL_FROM_NAME="Compras Zymo",
        MAIL_PORT=c["smtp_port"],
        MAIL_SERVER=c["smtp_host"],
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


def _is_configured() -> bool:
    """Retorna False si no se han configurado credenciales SMTP."""
    c = _get_runtime_config()
    return bool(c["smtp_user"] and c["smtp_password"])


def _get_directora_email() -> str:
    return _get_runtime_config()["email_directora"]


# ── Templates HTML ────────────────────────────────────────────────────────────

def _base(titulo: str, cuerpo: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#003087;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">Zymo Logística — Compras</h2>
      </div>
      <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h3 style="color:#111827;margin-top:0">{titulo}</h3>
        {cuerpo}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px;margin:0">
          Este correo fue generado automáticamente por la intranet de Zymo Logística.
          Por favor no responda a este mensaje.
        </p>
      </div>
    </div>
    """


def _html_en_gestion(s: "SolicitudOC") -> str:
    cuerpo = f"""
    <p style="color:#374151">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151">
      Queremos informarte que tu solicitud de compra ha sido recibida y un auxiliar de compras
      ya está trabajando en ella. Te notificaremos en cuanto tengamos una cotización lista.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;width:40%;border-radius:4px 0 0 4px">Consecutivo</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.consecutivo_os}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Descripción</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.descripcion}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Estado</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">🔄 En gestión</td>
      </tr>
    </table>
    <p style="color:#374151">
      Si tienes alguna duda adicional sobre tu solicitud, puedes comunicarte con el equipo de compras.
    </p>
    """
    return _base("Tu solicitud está siendo gestionada", cuerpo)


def _html_cotizacion_lista(s: "SolicitudOC") -> str:
    cuerpo = f"""
    <p style="color:#374151">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151">
      Tu solicitud de compra ha sido procesada y tenemos cotizaciones listas para aprobación.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;width:40%;border-radius:4px 0 0 4px">Consecutivo</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.consecutivo_os}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Descripción</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.descripcion}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Estado</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">⏳ Pendiente de aprobación</td>
      </tr>
    </table>
    <p style="color:#374151">
      El equipo de compras se encuentra en el proceso de aprobación. Te notificaremos cuando la orden de compra sea enviada.
    </p>
    """
    return _base("Cotización lista para tu solicitud", cuerpo)


def _html_aprobacion_directora(s: "SolicitudOC") -> str:
    cuerpo = f"""
    <p style="color:#374151">
      Hay una solicitud de compra pendiente de tu aprobación:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;width:40%;border-radius:4px 0 0 4px">Consecutivo</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.consecutivo_os}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Descripción</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.descripcion}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Solicitante</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.solicitante_nombre}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Área</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.area_solicitante or "—"}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Plataforma</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.plataforma or "—"}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Prioridad</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.nivel_prioridad}</td>
      </tr>
    </table>
    <p style="color:#374151">
      Ingresa a la intranet para revisar y aprobar o rechazar la cotización.
    </p>
    """
    return _base(f"Aprobación requerida — {s.consecutivo_os}", cuerpo)


def _html_oc_enviada(s: "SolicitudOC") -> str:
    cuerpo = f"""
    <p style="color:#374151">Hola <strong>{s.solicitante_nombre}</strong>,</p>
    <p style="color:#374151">
      Nos complace informarte que la Orden de Compra para tu solicitud ha sido enviada al proveedor.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;width:40%;border-radius:4px 0 0 4px">Consecutivo</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.consecutivo_os}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Descripción</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">{s.descripcion}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px">Estado</td>
        <td style="padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0">✅ OC Enviada al proveedor</td>
      </tr>
      {"<tr><td style='padding:8px 12px;background:#e5e7eb;font-weight:bold;border-radius:4px 0 0 4px'>Fecha estimada entrega</td><td style='padding:8px 12px;background:#f3f4f6;border-radius:0 4px 4px 0'>" + str(s.fecha_estimada_entrega) + "</td></tr>" if s.fecha_estimada_entrega else ""}
    </table>
    <p style="color:#374151">
      Pronto recibirás el producto. El equipo de compras te mantendrá informado.
    </p>
    """
    return _base("Tu Orden de Compra fue enviada", cuerpo)


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
        subject=f"[Compras Zymo] Tu solicitud está siendo gestionada — {s.consecutivo_os}",
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
        subject=f"[Compras Zymo] Cotización lista — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_cotizacion_lista(s),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 2 enviado a %s", s.solicitante_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 2 para %s", s.consecutivo_os)


async def send_aprobacion_directora(s: "SolicitudOC") -> None:
    """Flujo 3 — email a la directora cuando hay cotización que aprobar."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo Flujo 3")
        return
    directora_email = _get_directora_email()
    if not directora_email:
        log.warning("[email] Flujo 3: EMAIL_DIRECTORA no configurado")
        return

    msg = MessageSchema(
        subject=f"[Compras Zymo] Aprobación requerida — {s.consecutivo_os}",
        recipients=[directora_email],
        body=_html_aprobacion_directora(s),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 3 enviado a directora (%s)", directora_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 3 para %s", s.consecutivo_os)


async def send_oc_enviada(s: "SolicitudOC") -> None:
    """Flujo 4 — email al solicitante cuando la OC fue enviada al proveedor."""
    if not _is_configured():
        log.warning("[email] SMTP no configurado — omitiendo Flujo 4")
        return
    if not s.solicitante_email:
        log.warning("[email] Flujo 4: solicitud %s sin email de solicitante", s.consecutivo_os)
        return

    msg = MessageSchema(
        subject=f"[Compras Zymo] Orden de Compra enviada — {s.consecutivo_os}",
        recipients=[s.solicitante_email],
        body=_html_oc_enviada(s),
        subtype=MessageType.html,
    )
    try:
        await FastMail(_build_conf()).send_message(msg)
        log.info("[email] Flujo 4 enviado a %s", s.solicitante_email)
    except Exception:
        log.exception("[email] Error enviando Flujo 4 para %s", s.consecutivo_os)
