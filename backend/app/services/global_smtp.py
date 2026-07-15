from sqlmodel import Session, select

from app.database import get_engine
from app.models.global_config import GlobalConfig

_KEYS = ("smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from")


def get_global_smtp() -> dict | None:
    """Lee el SMTP corporativo centralizado (Configuración de la intranet → SMTP corporativo).

    Retorna None si aún no está configurado — el llamador debe hacer fallback a su
    config local (OcConfig / PtcSmtpConfig) hasta que el admin la llene ahí.
    """
    with Session(get_engine()) as db:
        rows = {r.key: r.value for r in db.exec(select(GlobalConfig).where(GlobalConfig.key.in_(_KEYS))).all()}

    if not (rows.get("smtp_host") and rows.get("smtp_user") and rows.get("smtp_password")):
        return None

    return {
        "smtp_host": rows["smtp_host"],
        "smtp_port": int(rows.get("smtp_port") or 587),
        "smtp_user": rows["smtp_user"],
        "smtp_password": rows["smtp_password"],
        "smtp_from": rows.get("smtp_from") or rows["smtp_user"],
    }
