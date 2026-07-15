from sqlmodel import Session, select

from app.database import get_engine
from app.models.global_config import GlobalConfig

_KEYS = ("whatsapp_token", "whatsapp_phone_number_id")


def get_global_whatsapp() -> dict | None:
    """Lee el WhatsApp Business API centralizado (Configuración de la intranet → WhatsApp corporativo).

    Retorna None si aún no está configurado — el llamador debe hacer fallback a su
    config local (PtcWaConfig / settings.whatsapp_*) hasta que el admin la llene ahí.
    """
    with Session(get_engine()) as db:
        rows = {r.key: r.value for r in db.exec(select(GlobalConfig).where(GlobalConfig.key.in_(_KEYS))).all()}

    if not (rows.get("whatsapp_token") and rows.get("whatsapp_phone_number_id")):
        return None

    return {
        "whatsapp_token": rows["whatsapp_token"],
        "whatsapp_phone_number_id": rows["whatsapp_phone_number_id"],
    }
