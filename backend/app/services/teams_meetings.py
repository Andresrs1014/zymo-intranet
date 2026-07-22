"""Creación de reuniones de Microsoft Teams para eventos de Agenda T&C,
vía Microsoft Graph API (client credentials — app-only, sin login del líder).

Requiere una App Registration en Microsoft Entra ID con permiso de aplicación
`Calendars.ReadWrite` (consentimiento de administrador) y las credenciales en
.env (graph_tenant_id, graph_client_id, graph_client_secret,
graph_organizer_email). Si no están configuradas, todas las funciones
retornan None/False sin lanzar — la creación del evento en T&C nunca debe
fallar por esto.
"""
from __future__ import annotations

import logging
import time
from datetime import date

import httpx

from app.config import settings

log = logging.getLogger(__name__)

_TIMEZONE = "America/Bogota"
_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
_GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# ponytail: token cacheado en memoria de proceso (dura ~1h) — no hace falta
# Redis para un solo backend; si se escala a multi-proceso, mover a la BD.
_token_cache: dict[str, object] = {"value": "", "expires_at": 0.0}


def is_configured() -> bool:
    return bool(
        settings.graph_tenant_id
        and settings.graph_client_id
        and settings.graph_client_secret
        and settings.graph_organizer_email
    )


def _get_app_token() -> str | None:
    if _token_cache["expires_at"] > time.time() + 60:
        return _token_cache["value"]  # type: ignore[return-value]

    url = _TOKEN_URL.format(tenant=settings.graph_tenant_id)
    body = {
        "client_id": settings.graph_client_id,
        "client_secret": settings.graph_client_secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }
    try:
        resp = httpx.post(url, data=body, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        _token_cache["value"] = data["access_token"]
        _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
        return _token_cache["value"]  # type: ignore[return-value]
    except Exception as exc:
        log.error("[teams] No se pudo obtener token de Graph API: %s", exc)
        return None


def crear_reunion(
    titulo: str,
    descripcion: str,
    fecha: date,
    hora_inicio: str,
    hora_fin: str,
) -> dict | None:
    """Crea un evento de calendario con reunión de Teams para el organizador
    configurado. Retorna {"event_id", "join_url"} o None si falla (sin
    lanzar — el llamador decide qué hacer con un None)."""
    if not is_configured():
        log.warning("[teams] Graph API no configurado — omitiendo creación de reunión")
        return None

    token = _get_app_token()
    if not token:
        return None

    start_iso = f"{fecha.isoformat()}T{hora_inicio}:00"
    end_iso = f"{fecha.isoformat()}T{hora_fin}:00"

    payload = {
        "subject": titulo,
        "body": {"contentType": "HTML", "content": descripcion or ""},
        "start": {"dateTime": start_iso, "timeZone": _TIMEZONE},
        "end": {"dateTime": end_iso, "timeZone": _TIMEZONE},
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness",
    }
    url = f"{_GRAPH_BASE}/users/{settings.graph_organizer_email}/events"
    try:
        resp = httpx.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        join_url = (data.get("onlineMeeting") or {}).get("joinUrl", "")
        if not join_url:
            log.warning("[teams] Evento creado sin joinUrl — respuesta: %s", data)
            return None
        return {"event_id": data["id"], "join_url": join_url}
    except Exception as exc:
        log.error("[teams] Error creando reunión: %s", exc)
        return None
