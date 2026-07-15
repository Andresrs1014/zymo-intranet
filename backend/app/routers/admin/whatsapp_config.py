import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import require_admin
from app.database import get_db
from app.models.global_config import GlobalConfig
from app.models.user import User
from app.services.tc_whatsapp import WA_API_URL, _headers

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/whatsapp-config", tags=["Admin — WhatsApp corporativo"])

_KEYS = {"whatsapp_token", "whatsapp_phone_number_id"}


class WhatsappConfigRead(BaseModel):
    whatsapp_phone_number_id: str
    whatsapp_token_set: bool


class WhatsappConfigUpdate(BaseModel):
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_token: Optional[str] = None


class TestWhatsappBody(BaseModel):
    to: str


class TestWhatsappResult(BaseModel):
    ok: bool
    mensaje: str
    detalle: Optional[str] = None


def _rows(db: Session) -> dict[str, str]:
    return {r.key: r.value for r in db.exec(select(GlobalConfig).where(GlobalConfig.key.in_(_KEYS))).all()}


@router.get("", response_model=WhatsappConfigRead)
def get_whatsapp_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = _rows(db)
    return WhatsappConfigRead(
        whatsapp_phone_number_id=rows.get("whatsapp_phone_number_id", ""),
        whatsapp_token_set=bool(rows.get("whatsapp_token")),
    )


@router.patch("", status_code=status.HTTP_204_NO_CONTENT)
def update_whatsapp_config(
    payload: WhatsappConfigUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None or field not in _KEYS:
            continue
        existing = db.get(GlobalConfig, field)
        if existing:
            existing.value = value
            db.add(existing)
        else:
            db.add(GlobalConfig(key=field, value=value))
    db.commit()


@router.post("/test", response_model=TestWhatsappResult)
def test_whatsapp_config(
    body: TestWhatsappBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Envía un mensaje de prueba al número indicado — misma API que send_whatsapp()."""
    rows = _rows(db)
    token = rows.get("whatsapp_token", "")
    phone_number_id = rows.get("whatsapp_phone_number_id", "")

    if not token or not phone_number_id:
        return TestWhatsappResult(
            ok=False,
            mensaje="Configuración de WhatsApp incompleta.",
            detalle="Token y Phone Number ID deben estar configurados antes de hacer la prueba.",
        )

    url = WA_API_URL.format(phone_number_id=phone_number_id)
    try:
        resp = httpx.post(
            url,
            headers=_headers(token),
            json={
                "messaging_product": "whatsapp",
                "to": body.to,
                "type": "text",
                "text": {"body": "✅ Prueba de WhatsApp corporativo — ZYMO Intranet. Si recibes esto, la configuración funciona."},
            },
            timeout=10,
        )
        if resp.is_success:
            log.info("[whatsapp_test] Prueba enviada a %s", body.to)
            return TestWhatsappResult(ok=True, mensaje=f"Mensaje enviado correctamente a {body.to}.")
        log.warning("[whatsapp_test] Error %s: %s", resp.status_code, resp.text[:300])
        return TestWhatsappResult(
            ok=False,
            mensaje=f"Meta respondió con error {resp.status_code}.",
            detalle=resp.text[:500],
        )
    except Exception as exc:
        log.exception("[whatsapp_test] Error inesperado")
        return TestWhatsappResult(ok=False, mensaje="Error inesperado.", detalle=str(exc))
