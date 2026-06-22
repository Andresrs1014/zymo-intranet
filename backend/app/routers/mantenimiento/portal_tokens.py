"""Token de portal permanente por auxiliar."""
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.mantenimiento import MntAuxiliarPortal


def ensure_portal_token(oc_db: Session, user_id: int) -> str:
    row = oc_db.get(MntAuxiliarPortal, user_id)
    if row:
        return row.portal_token
    token = secrets.token_urlsafe(32)
    row = MntAuxiliarPortal(user_id=user_id, portal_token=token)
    oc_db.add(row)
    oc_db.commit()
    oc_db.refresh(row)
    return token


def regenerate_portal_token(oc_db: Session, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    row = oc_db.get(MntAuxiliarPortal, user_id)
    now = datetime.now(timezone.utc)
    if row:
        row.portal_token = token
        row.updated_at = now
    else:
        row = MntAuxiliarPortal(user_id=user_id, portal_token=token)
    oc_db.add(row)
    oc_db.commit()
    oc_db.refresh(row)
    return token


def resolve_portal_user(portal_token: str, oc_db: Session, app_db: Session):
    from app.models.user import User

    row = oc_db.exec(
        select(MntAuxiliarPortal).where(MntAuxiliarPortal.portal_token == portal_token)
    ).first()
    if not row:
        raise HTTPException(status_code=401, detail="Portal inválido o revocado.")
    user = app_db.get(User, row.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario del portal inactivo.")
    return user, row


def portal_url(portal_token: str, open_solicitud_id: int | None = None) -> str:
    import os
    base = os.environ.get("FRONTEND_URL", "https://zymointranet.com").rstrip("/")
    url = f"{base}/m/portal/{portal_token}"
    if open_solicitud_id:
        url = f"{url}?open={open_solicitud_id}"
    return url


def resolve_portal_user_id(portal_token: str, oc_db: Session) -> int:
    row = oc_db.exec(
        select(MntAuxiliarPortal).where(MntAuxiliarPortal.portal_token == portal_token)
    ).first()
    if not row:
        raise HTTPException(status_code=401, detail="Portal inválido o revocado.")
    return row.user_id
