import io
import re
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.oc_database import get_oc_db
from app.models.oc import CotizacionProveedor, EstadoOC, SolicitudOC
from app.models.user import User
from app.services.email_service import send_aprobacion_directora, send_cotizacion_lista

router = APIRouter(tags=["OC - Cotizaciones"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CotizacionCreate(BaseModel):
    proveedor_nombre: str
    proveedor_nit: Optional[str] = None
    proveedor_email: Optional[str] = None
    numero_cotizacion_proveedor: Optional[str] = None
    valor_unitario: float
    valor_antes_iva: Optional[float] = None
    valor_iva: Optional[float] = None
    valor_total: float
    fecha_vigencia: Optional[date] = None
    forma_pago: Optional[str] = None
    plazo_entrega: Optional[str] = None
    observaciones: Optional[str] = None


class CotizacionRead(BaseModel):
    id: uuid.UUID
    solicitud_id: uuid.UUID
    proveedor_nombre: str
    proveedor_nit: Optional[str]
    proveedor_email: Optional[str]
    numero_cotizacion_proveedor: Optional[str]
    valor_unitario: float
    valor_antes_iva: Optional[float]
    valor_iva: Optional[float]
    valor_total: float
    fecha_vigencia: Optional[date]
    forma_pago: Optional[str]
    plazo_entrega: Optional[str]
    observaciones: Optional[str]
    pdf_path: Optional[str]
    extraccion_automatica: bool
    aprobada: Optional[bool]
    valor_aprobado: Optional[float]
    aprobado_por_id: Optional[int]
    observaciones_aprobacion: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AprobarPayload(BaseModel):
    valor_aprobado: float
    observaciones_aprobacion: Optional[str] = None


class RechazarPayload(BaseModel):
    observaciones_aprobacion: str


class ExtraccionResult(BaseModel):
    proveedor_nit: Optional[str] = None
    valor_unitario: Optional[float] = None
    valor_antes_iva: Optional[float] = None
    valor_iva: Optional[float] = None
    valor_total: Optional[float] = None
    forma_pago: Optional[str] = None
    plazo_entrega: Optional[str] = None
    nombre_archivo: str = ""
    campos_encontrados: int = 0


# ── Helpers de extracción ─────────────────────────────────────────────────────

def _extraer_texto(contenido: bytes, ext: str) -> str:
    if ext == "pdf":
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(contenido)) as pdf:
                return "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception:
            return ""
    if ext in ("xlsx", "xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
            lines: list[str] = []
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    parts = [str(c) for c in row if c is not None]
                    if parts:
                        lines.append("  ".join(parts))
            return "\n".join(lines)
        except Exception:
            return ""
    if ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(contenido))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception:
            return ""
    return ""


def _to_float(raw: str) -> Optional[float]:
    try:
        cleaned = raw.replace("$", "").replace(" ", "").strip()
        # Detectar si usa punto como separador de miles (ej: 1.200.000,00)
        if re.search(r"\d{1,3}(\.\d{3})+,\d{2}$", cleaned):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned and "." in cleaned:
            # 1,200,000.50 formato anglosajón
            cleaned = cleaned.replace(",", "")
        elif "," in cleaned:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(".", "")
        return float(cleaned)
    except Exception:
        return None


def _parsear_campos(texto: str) -> ExtraccionResult:
    def find_money(patterns: list[str]) -> Optional[float]:
        for pat in patterns:
            m = re.search(pat, texto, re.IGNORECASE | re.MULTILINE)
            if m:
                val = _to_float(m.group(1))
                if val and val > 0:
                    return val
        return None

    def find_text(patterns: list[str]) -> Optional[str]:
        for pat in patterns:
            m = re.search(pat, texto, re.IGNORECASE | re.MULTILINE)
            if m:
                found = m.group(1).strip()
                if found:
                    return found[:200]
        return None

    nit = find_text([
        r"N\.?I\.?T\.?[:\s#]*(\d[\d.\-]+[-]\d)",
        r"NIT[:\s#]*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-]?\d)",
    ])

    total = find_money([
        r"TOTAL\s+A\s+PAGAR[:\s]*\$?\s*([\d.,]+)",
        r"VALOR\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
        r"GRAN\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
        r"\bTOTAL\b[:\s]*\$?\s*([\d.,]+)",
    ])

    subtotal = find_money([
        r"SUBTOTAL[:\s]*\$?\s*([\d.,]+)",
        r"SUB\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
        r"VALOR\s+ANTES\s+DE\s+IVA[:\s]*\$?\s*([\d.,]+)",
        r"BASE\s+(?:IVA|GRAVABLE)[:\s]*\$?\s*([\d.,]+)",
    ])

    iva = find_money([
        r"IVA\s+19%?[:\s]*\$?\s*([\d.,]+)",
        r"IVA\s+\d+%[:\s]*\$?\s*([\d.,]+)",
        r"\bIVA\b[:\s]*\$?\s*([\d.,]+)",
    ])

    unitario = find_money([
        r"VALOR\s+UNITARIO[:\s]*\$?\s*([\d.,]+)",
        r"V\.?\s*UNITARIO[:\s]*\$?\s*([\d.,]+)",
        r"PRECIO\s+UNITARIO[:\s]*\$?\s*([\d.,]+)",
        r"P\.?\s*UNITARIO[:\s]*\$?\s*([\d.,]+)",
    ])

    forma_pago = find_text([
        r"FORMA\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
        r"CONDICI[OÓ]N(?:ES)?\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
        r"MODALIDAD\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
    ])

    plazo = find_text([
        r"PLAZO\s+DE\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
        r"TIEMPO\s+DE\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
        r"FECHA\s+(?:DE\s+)?ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
    ])

    campos = sum(1 for v in [nit, total, subtotal, iva, unitario, forma_pago, plazo] if v is not None)

    return ExtraccionResult(
        proveedor_nit=nit,
        valor_unitario=unitario,
        valor_antes_iva=subtotal,
        valor_iva=iva,
        valor_total=total,
        forma_pago=forma_pago,
        plazo_entrega=plazo,
        campos_encontrados=campos,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/solicitudes/{solicitud_id}/cotizacion/extraer",
    response_model=ExtraccionResult,
    status_code=status.HTTP_200_OK,
)
async def extraer_cotizacion(
    solicitud_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Extrae campos de un PDF/Excel/Word de cotización sin guardar nada."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    nombre = file.filename or ""
    ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
    if ext not in ("pdf", "xlsx", "xls", "docx"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Formato no soportado. Use PDF, Excel (.xlsx) o Word (.docx).",
        )

    contenido = await file.read()
    texto = _extraer_texto(contenido, ext)
    resultado = _parsear_campos(texto)
    resultado.nombre_archivo = nombre
    return resultado


@router.post(
    "/solicitudes/{solicitud_id}/cotizacion",
    response_model=CotizacionRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_cotizacion(
    solicitud_id: uuid.UUID,
    payload: CotizacionCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    estados_validos = {EstadoOC.en_cotizacion, EstadoOC.rechazada}
    if solicitud.estado not in estados_validos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede cargar cotización en estado '{solicitud.estado}'.",
        )

    cotizacion = CotizacionProveedor(
        solicitud_id=solicitud_id,
        proveedor_nombre=payload.proveedor_nombre,
        proveedor_nit=payload.proveedor_nit,
        proveedor_email=payload.proveedor_email,
        numero_cotizacion_proveedor=payload.numero_cotizacion_proveedor,
        valor_unitario=payload.valor_unitario,
        valor_antes_iva=payload.valor_antes_iva,
        valor_iva=payload.valor_iva,
        valor_total=payload.valor_total,
        fecha_vigencia=payload.fecha_vigencia,
        forma_pago=payload.forma_pago,
        plazo_entrega=payload.plazo_entrega,
        observaciones=payload.observaciones,
        extraccion_automatica=False,
        created_at=datetime.now(timezone.utc),
    )
    oc_db.add(cotizacion)

    # Avanzar estado de la solicitud a pendiente_aprobacion
    solicitud.estado = EstadoOC.pendiente_aprobacion
    solicitud.fecha_cotizacion = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    oc_db.commit()
    oc_db.refresh(cotizacion)

    # Disparar emails Flujo 2 y 3 (cotización lista → pendiente_aprobacion)
    background_tasks.add_task(send_cotizacion_lista, solicitud)
    background_tasks.add_task(send_aprobacion_directora, solicitud, cotizacion)

    return cotizacion


@router.get(
    "/solicitudes/{solicitud_id}/cotizaciones",
    response_model=list[CotizacionRead],
)
def listar_cotizaciones(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    cotizaciones = oc_db.exec(
        select(CotizacionProveedor)
        .where(CotizacionProveedor.solicitud_id == solicitud_id)
        .order_by(CotizacionProveedor.created_at.desc())
    ).all()
    return cotizaciones


@router.patch(
    "/cotizaciones/{cotizacion_id}/aprobar",
    response_model=CotizacionRead,
)
def aprobar_cotizacion(
    cotizacion_id: uuid.UUID,
    payload: AprobarPayload,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    if current_user.role not in ("admin", "directivo", "administrativo"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo directivo, administrativo o admin pueden aprobar cotizaciones.",
        )

    cotizacion = oc_db.get(CotizacionProveedor, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada.")

    cotizacion.aprobada = True
    cotizacion.valor_aprobado = payload.valor_aprobado
    cotizacion.aprobado_por_id = current_user.id
    cotizacion.observaciones_aprobacion = payload.observaciones_aprobacion
    oc_db.add(cotizacion)

    # Avanzar estado de la solicitud
    solicitud = oc_db.get(SolicitudOC, cotizacion.solicitud_id)
    if solicitud:
        solicitud.estado = EstadoOC.aprobada
        solicitud.fecha_aprobacion = datetime.now(timezone.utc)
        solicitud.updated_at = datetime.now(timezone.utc)
        oc_db.add(solicitud)

    oc_db.commit()
    oc_db.refresh(cotizacion)
    return cotizacion


@router.patch(
    "/cotizaciones/{cotizacion_id}/rechazar",
    response_model=CotizacionRead,
)
def rechazar_cotizacion(
    cotizacion_id: uuid.UUID,
    payload: RechazarPayload,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    if current_user.role not in ("admin", "directivo", "administrativo"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo directivo, administrativo o admin pueden rechazar cotizaciones.",
        )

    cotizacion = oc_db.get(CotizacionProveedor, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cotización no encontrada.")

    cotizacion.aprobada = False
    cotizacion.aprobado_por_id = current_user.id
    cotizacion.observaciones_aprobacion = payload.observaciones_aprobacion
    oc_db.add(cotizacion)

    # Regresar solicitud a en_cotizacion para que el auxiliar busque otra cotización
    solicitud = oc_db.get(SolicitudOC, cotizacion.solicitud_id)
    if solicitud:
        solicitud.estado = EstadoOC.en_cotizacion
        solicitud.updated_at = datetime.now(timezone.utc)
        oc_db.add(solicitud)

    oc_db.commit()
    oc_db.refresh(cotizacion)
    return cotizacion
