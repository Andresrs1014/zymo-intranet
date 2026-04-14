from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import get_current_user
from app.models.oc import OcConfig
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(tags=["OC - Configuración"])

_ALLOWED_KEYS = {"smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "email_directora"}


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores.")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ConfigRead(BaseModel):
    smtp_host: str
    smtp_port: str
    smtp_user: str
    smtp_password_set: bool
    smtp_from: str
    email_directora: str


class ConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    email_directora: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config", response_model=ConfigRead)
def get_config(
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    _require_admin(current_user)
    rows = {r.key: r.value for r in oc_db.exec(select(OcConfig)).all()}

    return ConfigRead(
        smtp_host=rows.get("smtp_host") or settings.smtp_host,
        smtp_port=rows.get("smtp_port") or str(settings.smtp_port),
        smtp_user=rows.get("smtp_user") or settings.smtp_user,
        smtp_password_set=bool(rows.get("smtp_password") or settings.smtp_password),
        smtp_from=rows.get("smtp_from") or settings.smtp_from or rows.get("smtp_user") or settings.smtp_user,
        email_directora=rows.get("email_directora") or settings.email_directora,
    )


@router.patch("/config", status_code=status.HTTP_204_NO_CONTENT)
def update_config(
    payload: ConfigUpdate,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    _require_admin(current_user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None or field not in _ALLOWED_KEYS:
            continue
        existing = oc_db.get(OcConfig, field)
        if existing:
            existing.value = value
            oc_db.add(existing)
        else:
            oc_db.add(OcConfig(key=field, value=value))

    oc_db.commit()
