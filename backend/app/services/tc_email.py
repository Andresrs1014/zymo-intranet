"""Envío de emails via SMTP para notificaciones de eventos T&C."""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

log = logging.getLogger(__name__)


def send_email(
    host: str, port: int, usuario: str, password: str,
    from_email: str, from_nombre: str,
    to: str, subject: str, body_html: str,
) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_nombre} <{from_email}>"
        msg["To"] = to
        msg.attach(MIMEText(body_html, "html", "utf-8"))
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(usuario, password)
            smtp.sendmail(from_email, to, msg.as_string())
        log.info("[tc_email] Enviado a %s", to)
        return True
    except Exception as exc:
        log.error("[tc_email] Error: %s", exc)
        return False


def build_evento_email(
    lider_nombre: str,
    fecha: str,
    hora: str,
    evento_titulo: str,
    lugar: str = "",
    personas: list[str] | None = None,
) -> tuple[str, str]:
    """Retorna (subject, html)."""
    filas_extra = ""
    if lugar:
        filas_extra += f"<tr><td style='padding:8px;font-weight:bold'>Lugar</td><td style='padding:8px'>{lugar}</td></tr>"

    participantes_html = ""
    if personas:
        lista = personas[:8]
        extra = len(personas) - 8
        items = "".join(f"<li>{n}</li>" for n in lista)
        participantes_html = f"<p><strong>Participantes:</strong></p><ul>{items}</ul>"
        if extra > 0:
            participantes_html += f"<p>...y {extra} más</p>"

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff">
  <div style="border-left:4px solid #0d9488;padding-left:16px;margin-bottom:20px">
    <h2 style="color:#0d9488;margin:0">Notificación de evento T&amp;C</h2>
    <p style="color:#6b7280;margin:4px 0 0">Talento y Cultura — ZYMO</p>
  </div>
  <p>Hola <strong>{lider_nombre}</strong>,</p>
  <p>Te informamos que tienes programado el siguiente evento:</p>
  <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin:16px 0">
    <tr><td style="padding:10px 16px;font-weight:bold;color:#374151;width:120px">Evento</td>
        <td style="padding:10px 16px;color:#111827">{evento_titulo}</td></tr>
    <tr style="background:#f3f4f6">
        <td style="padding:10px 16px;font-weight:bold;color:#374151">Fecha</td>
        <td style="padding:10px 16px;color:#111827">{fecha}</td></tr>
    <tr><td style="padding:10px 16px;font-weight:bold;color:#374151">Hora</td>
        <td style="padding:10px 16px;color:#111827">{hora}</td></tr>
    {filas_extra}
  </table>
  {participantes_html}
  <p style="margin-top:24px">Por favor confirma tu disponibilidad.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px">
    Este mensaje fue enviado automáticamente desde la Intranet ZYMO.
  </p>
</div>
"""
    subject = f"[T&C] {evento_titulo} — {fecha}"
    return subject, html
