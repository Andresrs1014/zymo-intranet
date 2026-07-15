import re
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.personal_database import PtcPersona, get_personal_engine
from app.services.tc_whatsapp import send_whatsapp

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp — servicio interno"])


class SendWhatsappBody(BaseModel):
    userId: int
    message: str


class SendWhatsappResult(BaseModel):
    ok: bool
    detalle: Optional[str] = None


def _is_valid_internal_key(key: Optional[str]) -> bool:
    return bool(key and settings.internal_key and key == settings.internal_key)


@router.post("/send", response_model=SendWhatsappResult)
def send_whatsapp_to_user(
    body: SendWhatsappBody,
    x_internal_key: Optional[str] = Header(default=None),
):
    """Envía un WhatsApp a un usuario de la intranet, resolviendo su teléfono
    corporativo desde el directorio T&C. Solo servicio-a-servicio (X-Internal-Key) —
    lo usan task-backend/helix-backend para alertas, no hay uso desde el frontend."""
    if not _is_valid_internal_key(x_internal_key):
        raise HTTPException(status_code=401, detail="No autorizado")

    with Session(get_personal_engine()) as db:
        persona = db.exec(select(PtcPersona).where(PtcPersona.user_id == body.userId)).first()

    telefono = (persona.telefono_corporativo if persona else "") or (persona.telefono if persona else "")
    telefono = re.sub(r"\D", "", telefono or "")
    if not telefono:
        return SendWhatsappResult(ok=False, detalle="El usuario no tiene teléfono corporativo registrado en el directorio.")

    ok = send_whatsapp(telefono, body.message)
    return SendWhatsappResult(ok=ok, detalle=None if ok else "Fallo el envío — revisa la configuración de WhatsApp corporativo.")
