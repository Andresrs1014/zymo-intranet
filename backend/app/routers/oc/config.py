import io
import json
import logging
import random
import smtplib
import ssl
from datetime import date, timedelta
from typing import Optional

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import get_current_user
from app.models.oc import OcConfig
from app.models.user import User
from app.oc_database import get_oc_db
from app.services.field_synonyms import FIELD_SYNONYMS

log = logging.getLogger(__name__)

router = APIRouter(tags=["OC - Configuración"])

_ALLOWED_KEYS = {
    "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from",
    "email_directora", "email_compras", "intranet_url",
}


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
    email_compras: str
    intranet_url: str


class ConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    email_directora: Optional[str] = None
    email_compras: Optional[str] = None
    intranet_url: Optional[str] = None


class TestEmailResult(BaseModel):
    ok: bool
    mensaje: str
    detalle: Optional[str] = None


class ListasFormulario(BaseModel):
    prioridades: list[str]
    categorias: list[str]
    grupos_articulos: list[str]
    clientes: list[str]
    condiciones: list[str]


_DEFAULT_LISTAS: dict[str, list[str]] = {
    "lista_prioridades":      ["Alta", "Media", "Baja"],
    "lista_categorias":       ["Repuesto", "Insumo", "Herramienta", "Servicio", "Otro"],
    "lista_grupos_articulos": ["Mecánico", "Eléctrico", "Hidráulico", "Neumático", "Lubricantes", "Papelería", "Otro"],
    "lista_clientes":         [],
    "lista_condiciones":      ["Nuevo", "Reposición", "Urgente"],
}


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
        email_compras=rows.get("email_compras") or settings.email_directora,
        intranet_url=rows.get("intranet_url") or settings.intranet_url,
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


@router.get("/config/listas", response_model=ListasFormulario)
def get_listas(
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> ListasFormulario:
    """Retorna las listas configurables del formulario de solicitud.
    Accesible para cualquier usuario autenticado (el formulario las necesita)."""
    rows = {r.key: r.value for r in oc_db.exec(select(OcConfig)).all()}

    def _get_lista(key: str) -> list[str]:
        raw = rows.get(key)
        if raw:
            try:
                return json.loads(raw)
            except Exception:
                return []
        return _DEFAULT_LISTAS.get(key, [])

    return ListasFormulario(
        prioridades=_get_lista("lista_prioridades"),
        categorias=_get_lista("lista_categorias"),
        grupos_articulos=_get_lista("lista_grupos_articulos"),
        clientes=_get_lista("lista_clientes"),
        condiciones=_get_lista("lista_condiciones"),
    )


@router.patch("/config/listas", status_code=status.HTTP_204_NO_CONTENT)
def update_listas(
    payload: ListasFormulario,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
) -> None:
    """Guarda las listas configurables. Solo admin."""
    _require_admin(current_user)

    mapping = {
        "lista_prioridades":      payload.prioridades,
        "lista_categorias":       payload.categorias,
        "lista_grupos_articulos": payload.grupos_articulos,
        "lista_clientes":         payload.clientes,
        "lista_condiciones":      payload.condiciones,
    }
    for key, value in mapping.items():
        serialized = json.dumps(value, ensure_ascii=False)
        existing = oc_db.get(OcConfig, key)
        if existing:
            existing.value = serialized
            oc_db.add(existing)
        else:
            oc_db.add(OcConfig(key=key, value=serialized))

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


# ── Test Excel generator ──────────────────────────────────────────────────────

_EMPRESAS = [
    "Suministros del Norte S.A.S.", "Proveedores Industriales Ltda.", "Papelería El Centro S.A.",
    "Distribuidora Tech Colombia S.A.S.", "Insumos y Repuestos del Valle Ltda.",
    "Ferretería Industrial Bogotá S.A.", "Oficina Total S.A.S.", "Comercializadora Andina Ltda.",
    "Electrónica y Sistemas S.A.", "Materiales y Construcción del Sur S.A.S.",
]

_ITEMS_POOL = [
    ("Resma de papel carta 75g", "PAP-001", 10, 12500),
    ("Tóner HP LaserJet 85A", "TON-HP85A", 3, 89000),
    ("Bolígrafo BIC punto fino azul x12", "ESC-BIC12", 5, 8900),
    ("Carpeta de palanca tamaño carta", "ARC-CAR01", 20, 5200),
    ("Marcador permanente Sharpie negro", "MAR-SHP01", 8, 3500),
    ("Cinta adhesiva transparente 48mm", "CIN-48T", 12, 2800),
    ("Grapadora metálica 26/6", "GRA-MET26", 4, 18500),
    ("Resaltador fluorescente amarillo", "RES-AMA01", 15, 1900),
    ("Sobre manila carta x100", "SOB-MAN100", 6, 14200),
    ("Perforadora 2 huecos metálica", "PER-2H01", 3, 22000),
    ("Sello automático personalizado", "SEL-AUT01", 2, 45000),
    ("Post-it notas adhesivas 76x76mm", "NOT-POST76", 10, 7500),
    ("Tijeras de oficina 20cm", "TIJ-20CM", 5, 6800),
    ("Regla metálica 30cm", "REG-30M", 8, 4500),
    ("Lapicero gel 0.5mm negro x10", "LAP-GEL10", 4, 12000),
    ("Borrador blanco para lápiz", "BOR-BLA01", 20, 800),
    ("Clip mariposa mediano x50", "CLI-MAR50", 10, 3200),
    ("Folder plástico oficio transparente", "FOL-PLA01", 15, 2100),
    ("Corrector líquido tipo lapicero", "COR-LIQ01", 6, 4200),
    ("Caja de clips estándar x100", "CLI-EST100", 12, 2500),
]

_FORMAS_PAGO = ["Contado", "Crédito 30 días", "Crédito 15 días", "50% anticipo - 50% contra entrega", "Transferencia inmediata"]
_PLAZOS = ["Inmediata", "3 días hábiles", "5 días hábiles", "8 días hábiles", "15 días calendario"]
_GARANTIAS = ["6 meses", "1 año fabricante", "30 días por defectos de fábrica", "No aplica", "12 meses"]
_ANTICIPOS = ["No requiere", "30%", "50%", "100% anticipado"]
_SALDOS = ["Contra entrega", "Al facturar", "30 días", "No aplica"]


def _rnd_syn(campo: str) -> str:
    """Retorna un sinónimo aleatorio del campo (incluye el propio nombre canónico)."""
    opciones = [campo] + FIELD_SYNONYMS.get(campo, [])
    return random.choice(opciones)


def _generar_excel_prueba() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cotización"

    empresa = random.choice(_EMPRESAS)
    nit = f"{random.randint(800, 999)}.{random.randint(100, 999)}.{random.randint(100, 999)}-{random.randint(0, 9)}"
    email = f"ventas@{empresa.split()[0].lower().replace(',', '')}.com"
    num_cot = f"COT-{random.randint(2025,2026)}-{random.randint(100,999)}"
    vigencia = (date.today() + timedelta(days=random.randint(10, 30))).isoformat()

    # ── Encabezado escalar ────────────────────────────────────────────────────
    fila = 1
    ws.cell(fila, 1, "COTIZACIÓN DE COMPRA")
    fila += 1
    ws.cell(fila, 1, _rnd_syn("numero_cotizacion_proveedor")).title()
    ws.cell(fila, 2, num_cot)
    fila += 1
    ws.cell(fila, 1, _rnd_syn("proveedor_nombre")).title()
    ws.cell(fila, 2, empresa)
    fila += 1
    ws.cell(fila, 1, _rnd_syn("proveedor_nit")).upper()
    ws.cell(fila, 2, nit)
    ws.cell(fila, 1, _rnd_syn("proveedor_nit").upper())
    fila += 1
    ws.cell(fila, 1, _rnd_syn("proveedor_email").title())
    ws.cell(fila, 2, email)
    fila += 1
    ws.cell(fila, 1, _rnd_syn("fecha_vigencia").title())
    ws.cell(fila, 2, vigencia)
    fila += 1
    ws.cell(fila, 1, _rnd_syn("forma_pago").title())
    ws.cell(fila, 2, random.choice(_FORMAS_PAGO))
    fila += 1
    ws.cell(fila, 1, _rnd_syn("plazo_entrega").title())
    ws.cell(fila, 2, random.choice(_PLAZOS))
    fila += 1
    ws.cell(fila, 1, _rnd_syn("garantia").title())
    ws.cell(fila, 2, random.choice(_GARANTIAS))
    fila += 1
    ws.cell(fila, 1, _rnd_syn("anticipo").title())
    ws.cell(fila, 2, random.choice(_ANTICIPOS))
    fila += 1
    ws.cell(fila, 1, _rnd_syn("pago_saldo").title())
    ws.cell(fila, 2, random.choice(_SALDOS))
    fila += 2  # fila en blanco

    # ── Tabla de ítems ────────────────────────────────────────────────────────
    col_desc = _rnd_syn("descripcion").title()
    col_ref  = _rnd_syn("referencia").title()
    col_cant = _rnd_syn("cantidad").title()
    col_unit = _rnd_syn("valor_unitario").title()
    col_tot  = _rnd_syn("valor_total").title()

    ws.cell(fila, 1, "No.")
    ws.cell(fila, 2, col_desc)
    ws.cell(fila, 3, col_ref)
    ws.cell(fila, 4, col_cant)
    ws.cell(fila, 5, col_unit)
    ws.cell(fila, 6, col_tot)
    fila += 1

    n_items = random.randint(3, 10)
    pool = random.sample(_ITEMS_POOL, min(n_items, len(_ITEMS_POOL)))
    subtotal = 0.0

    for i, (desc, ref, cant_base, precio_base) in enumerate(pool, 1):
        cant = random.randint(1, cant_base)
        precio = round(precio_base * random.uniform(0.9, 1.15), -2)  # variación ±15%
        total_fila = round(cant * precio, 2)
        subtotal += total_fila
        ws.cell(fila, 1, i)
        ws.cell(fila, 2, desc)
        ws.cell(fila, 3, ref)
        ws.cell(fila, 4, cant)
        ws.cell(fila, 5, precio)
        ws.cell(fila, 6, total_fila)
        fila += 1

    fila += 1  # fila en blanco

    iva = round(subtotal * 0.19, 2)
    total = round(subtotal + iva, 2)

    ws.cell(fila, 5, _rnd_syn("valor_antes_iva").title())
    ws.cell(fila, 6, subtotal)
    fila += 1
    ws.cell(fila, 5, _rnd_syn("valor_iva").upper())
    ws.cell(fila, 6, iva)
    fila += 1
    ws.cell(fila, 5, _rnd_syn("valor_total").title())
    ws.cell(fila, 6, total)

    # Ajustar ancho columnas
    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 40
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 10
    ws.column_dimensions["E"].width = 22
    ws.column_dimensions["F"].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


@router.get("/config/test/generar-excel")
def generar_excel_prueba(
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Genera un Excel de prueba con datos aleatorios usando sinónimos del motor."""
    _require_admin(current_user)

    # Incrementar contador
    counter_row = oc_db.get(OcConfig, "test_excel_counter")
    counter = int(counter_row.value) + 1 if counter_row else 1
    if counter_row:
        counter_row.value = str(counter)
        oc_db.add(counter_row)
    else:
        oc_db.add(OcConfig(key="test_excel_counter", value=str(counter)))
    oc_db.commit()

    filename = f"prueba.{counter:03d}.xlsx"
    contenido = _generar_excel_prueba()

    return StreamingResponse(
        io.BytesIO(contenido),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
