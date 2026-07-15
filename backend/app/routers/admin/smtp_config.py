import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import require_admin
from app.database import get_db
from app.models.global_config import GlobalConfig
from app.models.user import User

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/smtp-config", tags=["Admin — SMTP corporativo"])

# Cuenta compartida usada por Tickets/T&C/Tareas para enviar alertas por correo.
# Deliberadamente NO vive en .env — la carga el admin desde /admin/configuracion.
_KEYS = {"smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from"}


class SmtpConfigRead(BaseModel):
    smtp_host: str
    smtp_port: str
    smtp_user: str
    smtp_password_set: bool
    smtp_from: str


class SmtpConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None


class TestEmailResult(BaseModel):
    ok: bool
    mensaje: str
    detalle: Optional[str] = None


class SmtpConfigService(BaseModel):
    """Config completa (incluye password) para llamadas servicio-a-servicio (task-backend, etc.)."""
    smtp_host: str
    smtp_port: str
    smtp_user: str
    smtp_password: str
    smtp_from: str


def _rows(db: Session) -> dict[str, str]:
    return {r.key: r.value for r in db.exec(select(GlobalConfig).where(GlobalConfig.key.in_(_KEYS))).all()}


def _is_valid_internal_key(key: Optional[str]) -> bool:
    return bool(key and settings.internal_key and key == settings.internal_key)


@router.get("", response_model=SmtpConfigRead)
def get_smtp_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = _rows(db)
    return SmtpConfigRead(
        smtp_host=rows.get("smtp_host", ""),
        smtp_port=rows.get("smtp_port", "587"),
        smtp_user=rows.get("smtp_user", ""),
        smtp_password_set=bool(rows.get("smtp_password")),
        smtp_from=rows.get("smtp_from", ""),
    )


@router.patch("", status_code=status.HTTP_204_NO_CONTENT)
def update_smtp_config(
    payload: SmtpConfigUpdate,
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


@router.get("/service", response_model=SmtpConfigService)
def get_smtp_config_service(
    x_internal_key: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """SMTP corporativo para consumo servicio-a-servicio (task-backend, helix-backend, etc.).

    Requiere X-Internal-Key — nunca expuesto a usuarios finales (a diferencia de GET "" que
    oculta la contraseña real).
    """
    if not _is_valid_internal_key(x_internal_key):
        raise HTTPException(status_code=401, detail="No autorizado")
    rows = _rows(db)
    return SmtpConfigService(
        smtp_host=rows.get("smtp_host", ""),
        smtp_port=rows.get("smtp_port", "587"),
        smtp_user=rows.get("smtp_user", ""),
        smtp_password=rows.get("smtp_password", ""),
        smtp_from=rows.get("smtp_from", ""),
    )


@router.post("/test", response_model=TestEmailResult)
def test_smtp_config(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Envía un correo de prueba al propio smtp_user — misma lógica que /oc/config/test-email."""
    rows = _rows(db)
    host = rows.get("smtp_host", "")
    port_raw = rows.get("smtp_port", "587")
    user = rows.get("smtp_user", "")
    password = rows.get("smtp_password", "")
    from_addr = rows.get("smtp_from") or user

    if not host or not user or not password:
        return TestEmailResult(
            ok=False,
            mensaje="Configuración SMTP incompleta.",
            detalle="Host, usuario y contraseña deben estar configurados antes de hacer la prueba.",
        )

    try:
        port = int(port_raw)
    except ValueError:
        return TestEmailResult(ok=False, mensaje="Puerto SMTP inválido.", detalle=f"'{port_raw}' no es un número.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[ZYMO Intranet] Correo de prueba SMTP corporativo"
    msg["From"] = f"ZYMO Intranet <{from_addr}>"
    msg["To"] = user
    html = """
    <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px">
      <h3 style="color:#111">✅ Prueba SMTP exitosa</h3>
      <p style="color:#444">Este correo confirma que la cuenta SMTP corporativa centralizada
      está funcionando correctamente.</p>
      <p style="color:#888;font-size:12px">Generado desde /admin/configuracion</p>
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
            smtp.sendmail(from_addr, [user], msg.as_string())

        log.info("[smtp_test] Prueba SMTP corporativa exitosa → %s", user)
        return TestEmailResult(
            ok=True,
            mensaje=f"Correo enviado correctamente a {user}.",
            detalle=f"Servidor: {host}:{port} | Usuario: {user}",
        )

    except smtplib.SMTPAuthenticationError as e:
        detalle = (
            "Error de autenticación. Para Gmail:\n"
            "1. La cuenta debe tener verificación en 2 pasos activada.\n"
            "2. Usa una 'contraseña de aplicación' (myaccount.google.com/apppasswords), no la contraseña normal.\n"
            f"Código SMTP: {e.smtp_code} — {e.smtp_error!r}"
        )
        log.warning("[smtp_test] SMTPAuthenticationError: %s %r", e.smtp_code, e.smtp_error)
        return TestEmailResult(ok=False, mensaje="Fallo de autenticación SMTP.", detalle=detalle)

    except smtplib.SMTPConnectError as e:
        log.warning("[smtp_test] SMTPConnectError: %s", e)
        return TestEmailResult(
            ok=False,
            mensaje="No se pudo conectar al servidor SMTP.",
            detalle=f"No se pudo conectar a {host}:{port}. Verifica host y puerto.\nError: {e}",
        )

    except smtplib.SMTPException as e:
        log.warning("[smtp_test] SMTPException: %s", e)
        return TestEmailResult(ok=False, mensaje="Error SMTP.", detalle=str(e))

    except TimeoutError:
        log.warning("[smtp_test] Timeout conectando a %s:%s", host, port)
        return TestEmailResult(
            ok=False,
            mensaje="Timeout de conexión.",
            detalle=f"Timeout conectando a {host}:{port} (15 s). Posible bloqueo de firewall o puerto incorrecto.",
        )

    except Exception as e:
        log.exception("[smtp_test] Error inesperado")
        return TestEmailResult(ok=False, mensaje="Error inesperado.", detalle=str(e))
