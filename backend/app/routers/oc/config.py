import logging
import smtplib
import ssl
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import get_current_user
from app.models.oc import OcConfig
from app.models.user import User
from app.oc_database import get_oc_db

log = logging.getLogger(__name__)

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


class TestEmailResult(BaseModel):
    ok: bool
    mensaje: str
    detalle: Optional[str] = None


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


@router.post("/config/test-email", response_model=TestEmailResult)
def test_email(
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Envía un correo de prueba al smtp_user para verificar que las credenciales funcionan.
    Usa smtplib directamente para obtener el error SMTP exacto sin capturarlo en silencio.
    """
    _require_admin(current_user)

    rows = {r.key: r.value for r in oc_db.exec(select(OcConfig)).all()}
    host = rows.get("smtp_host") or settings.smtp_host
    port = int(rows.get("smtp_port") or settings.smtp_port)
    user = rows.get("smtp_user") or settings.smtp_user
    password = rows.get("smtp_password") or settings.smtp_password
    from_addr = rows.get("smtp_from") or settings.smtp_from or user
    to_addr = user  # el correo de prueba se manda al mismo remitente

    if not user or not password:
        return TestEmailResult(
            ok=False,
            mensaje="Credenciales SMTP no configuradas.",
            detalle="smtp_user y smtp_password deben estar configurados antes de hacer la prueba.",
        )

    # Construir mensaje mínimo (sin fastapi-mail para ver el error real de smtplib)
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[ZYMO Intranet] Correo de prueba SMTP"
    msg["From"] = f"Compras ZYMO <{from_addr}>"
    msg["To"] = to_addr
    html = """
    <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px">
      <h3 style="color:#111">✅ Prueba SMTP exitosa</h3>
      <p style="color:#444">Este correo confirma que la configuración SMTP de ZYMO Intranet
      está funcionando correctamente.</p>
      <p style="color:#888;font-size:12px">Generado desde /oc/configuracion</p>
    </div>
    """
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(user, password)
            smtp.sendmail(from_addr, [to_addr], msg.as_string())

        log.info("[email_test] Prueba SMTP exitosa → %s", to_addr)
        return TestEmailResult(
            ok=True,
            mensaje=f"Correo enviado correctamente a {to_addr}.",
            detalle=f"Servidor: {host}:{port} | Usuario: {user}",
        )

    except smtplib.SMTPAuthenticationError as e:
        detalle = (
            "Error de autenticación. Causas frecuentes en Office 365:\n"
            "1. SMTP AUTH deshabilitado en el buzón (habilitar en Centro de administración M365 → Usuarios → Correo → Autenticación SMTP).\n"
            "2. MFA activa sin contraseña de aplicación (crear una en Seguridad de la cuenta).\n"
            "3. Usuario o contraseña incorrectos.\n"
            f"Código SMTP: {e.smtp_code} — {e.smtp_error!r}"
        )
        log.warning("[email_test] SMTPAuthenticationError: %s %r", e.smtp_code, e.smtp_error)
        return TestEmailResult(ok=False, mensaje="Fallo de autenticación SMTP.", detalle=detalle)

    except smtplib.SMTPConnectError as e:
        detalle = (
            f"No se pudo conectar a {host}:{port}.\n"
            "Verifica que el host y puerto sean correctos y que el servidor esté accesible desde Docker.\n"
            f"Error: {e}"
        )
        log.warning("[email_test] SMTPConnectError: %s", e)
        return TestEmailResult(ok=False, mensaje="No se pudo conectar al servidor SMTP.", detalle=detalle)

    except smtplib.SMTPException as e:
        log.warning("[email_test] SMTPException: %s", e)
        return TestEmailResult(ok=False, mensaje="Error SMTP.", detalle=str(e))

    except TimeoutError:
        detalle = (
            f"Timeout conectando a {host}:{port} (15 s).\n"
            "El servidor no responde. Posible bloqueo de firewall o puerto incorrecto."
        )
        log.warning("[email_test] Timeout conectando a %s:%s", host, port)
        return TestEmailResult(ok=False, mensaje="Timeout de conexión.", detalle=detalle)

    except Exception as e:
        log.exception("[email_test] Error inesperado")
        return TestEmailResult(ok=False, mensaje="Error inesperado.", detalle=str(e))
