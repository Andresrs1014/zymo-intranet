"""Envío de notificaciones WhatsApp Business API para eventos T&C."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

log = logging.getLogger(__name__)

WA_API_URL = "https://graph.facebook.com/v20.0/{phone_number_id}/messages"


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _build_body(to: str, message: str) -> dict:
    return {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }


def send_whatsapp(to: str, message: str) -> bool:
    """Envía mensaje de texto plano. Retorna True si 2xx."""
    from app.config import settings
    token = settings.whatsapp_api_token
    phone_id = settings.whatsapp_phone_number_id

    if not token or not phone_id:
        log.warning("[tc_wa] WhatsApp no configurado — token o phone_id vacíos")
        return False

    url = WA_API_URL.format(phone_number_id=phone_id)
    try:
        resp = httpx.post(url, headers=_headers(token), json=_build_body(to, message), timeout=10)
        if resp.is_success:
            log.info("[tc_wa] Mensaje enviado a %s", to)
            return True
        log.warning("[tc_wa] Error %s: %s", resp.status_code, resp.text[:200])
        return False
    except Exception as exc:
        log.error("[tc_wa] Excepción: %s", exc)
        return False


def build_induccion_message(
    lider_nombre: str,
    fecha: str,
    hora: str,
    evento_titulo: str,
    personas: list[str],
    lugar: str = "",
) -> str:
    nombres = ", ".join(personas[:5])
    if len(personas) > 5:
        nombres += f" y {len(personas) - 5} más"
    partes = [
        f"Hola {lider_nombre} 👋",
        f"El día *{fecha}* ingresa personal nuevo y estás programado para dar una capacitación a las *{hora}*.",
        f"📋 *{evento_titulo}*",
    ]
    if lugar:
        partes.append(f"📍 Lugar: {lugar}")
    if personas:
        partes.append(f"👥 Participantes: {nombres}")
    partes.append("Por favor confirma tu disponibilidad. ¡Gracias!")
    return "\n".join(partes)


def build_generic_message(
    lider_nombre: str,
    fecha: str,
    hora: str,
    evento_titulo: str,
    lugar: str = "",
) -> str:
    partes = [
        f"Hola {lider_nombre} 👋",
        f"Te informamos que el día *{fecha}* a las *{hora}* tienes programado:",
        f"📋 *{evento_titulo}*",
    ]
    if lugar:
        partes.append(f"📍 Lugar: {lugar}")
    partes.append("Por favor confirma tu asistencia. ¡Gracias!")
    return "\n".join(partes)
