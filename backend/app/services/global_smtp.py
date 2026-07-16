from sqlmodel import Session, select

from app.database import get_engine
from app.models.global_config import GlobalConfig

_PRIMARY_KEYS = ("smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from")
_BACKUP_KEYS = ("smtp_backup_host", "smtp_backup_port", "smtp_backup_user", "smtp_backup_password", "smtp_backup_from")


def _sanitize_from(smtp_from: str | None, smtp_user: str) -> str:
    """smtp_from se usa tal cual como MAIL_FROM (dirección real, no un nombre para mostrar).
    Un valor sin "@" (dato viejo/malo) rompería el envío para toda la intranet — se ignora
    y se cae a smtp_user en vez de propagar basura a smtplib/fastapi-mail."""
    value = smtp_from or ""
    return value if "@" in value else smtp_user


def _read(keys: tuple[str, ...]) -> dict[str, str]:
    with Session(get_engine()) as db:
        return {r.key: r.value for r in db.exec(select(GlobalConfig).where(GlobalConfig.key.in_(keys))).all()}


def get_global_smtp() -> dict | None:
    """Lee el SMTP corporativo principal (Configuración de la intranet → SMTP corporativo).

    Retorna None si aún no está configurado — el llamador debe intentar el de respaldo
    (ver get_global_smtp_backup) y, si tampoco hay, omitir el envío.
    """
    rows = _read(_PRIMARY_KEYS)
    if not (rows.get("smtp_host") and rows.get("smtp_user") and rows.get("smtp_password")):
        return None
    return {
        "smtp_host": rows["smtp_host"],
        "smtp_port": int(rows.get("smtp_port") or 587),
        "smtp_user": rows["smtp_user"],
        "smtp_password": rows["smtp_password"],
        "smtp_from": _sanitize_from(rows.get("smtp_from"), rows["smtp_user"]),
    }


def get_global_smtp_backup() -> dict | None:
    """Lee el SMTP de respaldo — mismo hub, sección separada. Se usa solo si el
    principal falla al conectar/autenticar/enviar, no si simplemente no está configurado."""
    rows = _read(_BACKUP_KEYS)
    if not (rows.get("smtp_backup_host") and rows.get("smtp_backup_user") and rows.get("smtp_backup_password")):
        return None
    return {
        "smtp_host": rows["smtp_backup_host"],
        "smtp_port": int(rows.get("smtp_backup_port") or 587),
        "smtp_user": rows["smtp_backup_user"],
        "smtp_password": rows["smtp_backup_password"],
        "smtp_from": _sanitize_from(rows.get("smtp_backup_from"), rows["smtp_backup_user"]),
    }


def get_smtp_candidates() -> list[dict]:
    """Configs a intentar en orden: principal primero, respaldo después. Vacía si
    ninguna de las dos está configurada — ya no hay fallback a config local por
    herramienta (OcConfig / PtcSmtpConfig / SystemConfig de Tareas)."""
    candidates = []
    primary = get_global_smtp()
    if primary:
        candidates.append(primary)
    backup = get_global_smtp_backup()
    if backup:
        candidates.append(backup)
    return candidates
