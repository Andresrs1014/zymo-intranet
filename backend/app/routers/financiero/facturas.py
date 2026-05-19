import io
import logging
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import require_financiero
from app.database import get_db
from app.financiero_database import get_financiero_db
from app.services.platform_empresa import nombre_empresa_desde_plataforma
from app.models.financiero import (
    EstadoFactura,
    FacturaProveedor,
    SeguimientoFinancieroSolicitud,
    ValidacionFactura,
)
from app.models.oc import CotizacionProveedor, EstadoOC, OrdenCompra, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(tags=["Financiero - Facturas"])

# Directorio de almacenamiento configurado en settings.facturas_dir
# Default: /app/data/facturas (dentro del volumen Docker backend_data)
FACTURAS_DIR = Path(settings.facturas_dir)

# Porcentaje máximo de diferencia permitido entre valor de OC y valor de factura
TOLERANCIA_VALOR_PCT: float = 1.0

# Formatos aceptados para subida de factura
FORMATOS_FACTURA = frozenset({"pdf", "xlsx", "xls", "docx"})

# ── Schemas ───────────────────────────────────────────────────────────────────


class SolicitudConFacturaRead(BaseModel):
    """OC desde oc.db enriquecida con su factura si existe."""

    solicitud_id: uuid.UUID
    consecutivo_os: Optional[str]
    descripcion: Optional[str]
    solicitante_nombre: Optional[str]
    area_solicitante: Optional[str]
    plataforma: Optional[str]
    empresa_compra_nombre: Optional[str] = None
    condicion: Optional[str] = None
    estado: str
    fecha_en_plataforma: Optional[datetime]
    fecha_recibido: Optional[datetime]
    # Anticipo / proforma
    tiene_proforma: Optional[bool] = False
    proforma_path: Optional[str] = None
    # Forma de pago de la cotización aprobada
    forma_pago: Optional[str] = None
    # Cotización aprobada
    cotizacion_id: Optional[uuid.UUID]
    proveedor_nombre: Optional[str]
    proveedor_nit: Optional[str] = None
    aprobado_por_nombre: Optional[str] = None
    valor_aprobado: Optional[float]
    valor_antes_iva: Optional[float]
    valor_iva: Optional[float]
    # Orden de compra
    orden_id: Optional[uuid.UUID]
    numero_oc: Optional[str]
    # Factura (None si no se ha subido aún)
    factura_id: Optional[uuid.UUID]
    factura_estado: Optional[str]
    numero_factura: Optional[str]
    valor_factura: Optional[float]
    fecha_factura: Optional[date]
    # Bitácora financiera (anticipo/proforma, notas antes de validar factura)
    observaciones_seguimiento: Optional[str] = None
    seguimiento_updated_at: Optional[datetime] = None
    aval_compra_solicitud: Optional[str] = None
    items_cotizacion: Optional[List[Dict[str, Any]]] = None  # [{num, descripcion, cantidad, valor_unitario, valor_total, ...}]

    class Config:
        from_attributes = True


class CotizacionListaFinancieroRead(BaseModel):
    """Cotización de la solicitud — vista lectura para Financiero (sin subir archivos)."""

    id: uuid.UUID
    solicitud_id: uuid.UUID
    proveedor_nombre: str
    proveedor_nit: Optional[str] = None
    numero_cotizacion_proveedor: Optional[str] = None
    aprobada: Optional[bool] = None
    valor_total: float
    valor_aprobado: Optional[float] = None
    tiene_adjunto: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class SeguimientoSolicitudUpdate(BaseModel):
    observaciones: str = ""


class SeguimientoSolicitudRead(BaseModel):
    solicitud_id: uuid.UUID
    observaciones: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by_id: Optional[int] = None


class FacturaRead(BaseModel):
    id: uuid.UUID
    solicitud_id: uuid.UUID
    cotizacion_id: uuid.UUID
    orden_id: Optional[uuid.UUID]
    numero_factura: Optional[str]
    valor_factura: Optional[float]
    fecha_factura: Optional[date]
    nit_proveedor: Optional[str]
    nombre_proveedor: Optional[str]
    fecha_recibida_factura: Optional[date]
    aval_compra: Optional[str]
    fecha_confirmada_entrega: Optional[date]
    valor_aprobado_oc: Optional[float]
    pdf_path: Optional[str]
    extraccion_automatica: bool
    estado: str
    observaciones: Optional[str]
    registrado_por_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FacturaUpdate(BaseModel):
    numero_factura: Optional[str] = None
    valor_factura: Optional[float] = None
    fecha_factura: Optional[date] = None
    nit_proveedor: Optional[str] = None
    nombre_proveedor: Optional[str] = None
    fecha_recibida_factura: Optional[date] = None
    aval_compra: Optional[str] = None
    fecha_confirmada_entrega: Optional[date] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class ValidacionRead(BaseModel):
    id: uuid.UUID
    factura_id: uuid.UUID
    campo: str
    valor_esperado: Optional[str]
    valor_encontrado: Optional[str]
    cumple: bool
    observacion: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ExtraccionFacturaResult(BaseModel):
    numero_factura: Optional[str] = None
    valor_factura: Optional[float] = None
    fecha_factura: Optional[date] = None
    nit_proveedor: Optional[str] = None
    nombre_proveedor: Optional[str] = None
    nombre_archivo: str = ""
    campos_encontrados: int = 0


# ── Helpers de extracción ─────────────────────────────────────────────────────


def _extraer_texto(contenido: bytes, ext: str) -> str:
    if ext == "pdf":
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(contenido)) as pdf:
                texto = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception as e:
            log.warning("[motor-facturas] extracción texto PDF falló: %s", e)
            texto = ""
        from app.services.ocr_service import texto_con_ocr_fallback
        return texto_con_ocr_fallback(texto, contenido)
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
        except Exception as e:
            log.warning("[motor-facturas] extracción texto Excel falló: %s", e)
            return ""
    if ext == "docx":
        try:
            from docx import Document

            doc = Document(io.BytesIO(contenido))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            log.warning("[motor-facturas] extracción texto Word falló: %s", e)
            return ""
    return ""


from app.services.extraction_utils import extraer_campos_estructurado as _extraer_campos_estructurado  # noqa: E402
from app.services.number_utils import format_cop as _fmt_cop, parse_cop as _to_float  # noqa: E402

# Patrones que suelen confundirse con NIT (año-consecutivo, rangos cortos)
_NIT_FALSO_ANIO_CONSECUTIVO = re.compile(
    r"^(19|20)\d{2}\s*[-./]\s*\d{2,4}(?:\s|$)",
    re.IGNORECASE,
)


def _nit_extraido_es_plausible(raw: Optional[str]) -> bool:
    """Filtra capturas tipo '2026-3041' o cédulas demasiado cortas."""
    if not raw or not str(raw).strip():
        return False
    s = str(raw).strip()
    if _NIT_FALSO_ANIO_CONSECUTIVO.match(s):
        return False
    if re.fullmatch(r"\d{4}\s*[-./]\s*\d{4}", re.sub(r"\s+", " ", s)):
        return False
    digits = re.sub(r"\D", "", s)
    if len(digits) < 9:
        return False
    if len(digits) > 15:
        return False
    return True


def _limpiar_razon_social_extraida(raw: Optional[str]) -> Optional[str]:
    """Quita fragmentos colgantes del PDF/OCR ('es Industriales...' por corte de palabra)."""
    if not raw:
        return None
    t = " ".join(raw.split())
    # Palabras sueltas al inicio que suelen ser sobras de línea anterior
    prefixes = (
        "el ", "la ", "los ", "las ", "del ", "de ", "al ", "y ", "es ", "en ", "o ", "un ", "una ",
    )
    lower = t.lower()
    for _ in range(8):
        hit = False
        for p in prefixes:
            if lower.startswith(p):
                t = t[len(p) :].strip()
                lower = t.lower()
                hit = True
                break
        if not hit:
            break
    t = re.sub(r"^[:\-.\s]+", "", t)
    if len(t) < 3:
        return None
    return t[:200]


def _find_nit_factura(texto: str, flags: int, _extra: dict[str, str]) -> Optional[str]:
    for key in ("proveedor_nit", "nit"):
        v = _extra.get(key)
        if v and _nit_extraido_es_plausible(v.strip()):
            return v.strip()[:50]
    patrones = [
        r"\bN\.?I\.?T\.?\s*(?:N[o°]\.?)?\s*[:\-]?\s*(\d{1,3}[.\s]?\d{3}[.\s]?\d{3}\s*[-]?\s*\d)\b",
        r"\bNIT\b\s*[:\-]?\s*(\d{1,3}[.\s]?\d{3}[.\s]?\d{3}\s*[-./]\s*\d)\b",
        r"\bNIT\b[^\d]{0,20}(\d{2,4}[.\-]\d{2,4}[.\-]\d{2,4}[-]?\d)\b",
        r"IDENTIFICACI[OÓ]N\s+(?:TRIBUTARIA\s+)?(?:N[°oO]\.?)?\s*[:\-]?\s*(\d[\d.\-/\s]+?\d)\b",
    ]
    for pat in patrones:
        for m in re.finditer(pat, texto, flags):
            cand = re.sub(r"\s+", "", m.group(1).strip())
            if _nit_extraido_es_plausible(cand):
                return m.group(1).strip()[:50]
    return None


def _find_nombre_factura(texto: str, flags: int, _extra: dict[str, str]) -> Optional[str]:
    for key in ("proveedor_nombre",):
        v = _extra.get(key)
        if v:
            cl = _limpiar_razon_social_extraida(v)
            if cl:
                return cl
    patrones = [
        r"(?:RAZ[OÓ]N\s+SOCIAL|NOMBRE(?:\s+O)?\s+RAZ[OÓ]N\s+SOCIAL)[^\n:]{0,45}[:#.\-]?\s*([^\n]{3,200})",
        r"\bEMISOR\b[^\n:]{0,40}[:#.\-]?\s*([^\n]{3,200})",
        r"(?:PROVEEDOR\s+DE\s+BIENES|VENDEDOR|PROVEEDOR)\b[^\n:]{0,40}[:#.\-]?\s*([^\n]{3,200})",
        r"RAZ[OÓ]N\s+SOCIAL[\s\S]{0,35}?([A-ZÁÉÍÓÚÑ0-9\*][^\n]{2,180}?)(?:\n|$)",
        r"EMPRESA[\s\S]{0,25}?([A-ZÁÉÍÓÚÑ][^\n]{2,180}?)(?:\n|$)",
    ]
    for pat in patrones:
        m = re.search(pat, texto, flags)
        if m:
            cl = _limpiar_razon_social_extraida(m.group(1))
            if cl:
                return cl
    return None


def _parsear_factura(texto: str, extra: Optional[dict[str, str]] = None) -> ExtraccionFacturaResult:
    """Extrae campos de factura desde texto libre con regex.

    extra: dict de campos pre-resueltos via extracción estructurada (Excel/Word).
    Funciona como fallback cuando el regex no encuentra el campo en el texto.
    """
    _extra = extra or {}
    # DOTALL permite capturar valores cuando el PDF parte etiqueta y valor
    # en líneas distintas (frecuente en facturas electrónicas colombianas).
    flags = re.IGNORECASE | re.MULTILINE | re.DOTALL

    def find_money(patterns: list[str]) -> Optional[float]:
        for pat in patterns:
            m = re.search(pat, texto, flags)
            if m:
                val = _to_float(m.group(1))
                if val and val > 0:
                    return val
        return None

    def find_text(patterns: list[str]) -> Optional[str]:
        for pat in patterns:
            m = re.search(pat, texto, flags)
            if m:
                found = m.group(1).strip()
                if found:
                    return found[:200]
        return None

    def find_date(patterns: list[str]) -> Optional[date]:
        for pat in patterns:
            m = re.search(pat, texto, flags)
            if m:
                try:
                    return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                except Exception:
                    pass
                try:
                    return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                except Exception:
                    pass
        return None

    def money_or_extra(field: str, patterns: list[str]) -> Optional[float]:
        return find_money(patterns) or _to_float(_extra.get(field, ""))

    # Número de factura
    numero_factura = find_text(
        [
            r"N[oó]\.?\s*(?:DE\s+)?FACTURA[\s\S]{0,12}?([A-Z0-9\-]{4,})",
            r"FACTURA\s+(?:DE\s+VENTA\s+)?(?:N[oó]\.?\s*|#\s*)?((?:FE|FV|SETP)-[A-Z0-9\-]+|\d{5,})",
            r"\b(FE-\d+)\b",
            r"\b(FV-\d+)\b",
            r"\b(SETP-[A-Z0-9\-]+)\b",
            r"N[ÚUu]MERO\s+DE\s+FACTURA[\s\S]{0,12}?([A-Z0-9\-]{4,})",
        ]
    )
    if not numero_factura:
        numero_factura = (_extra.get("numero_factura") or "").strip() or None

    # Valor total de la factura
    valor_factura = money_or_extra(
        "valor_factura",
        [
            r"TOTAL\s+A\s+PAGAR[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"VALOR\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"GRAN\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"GRAND\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
            r"(?:IMPORTE\s+)?TOTAL\s+FACTURA[\s\S]{0,25}?\$?\s*([\d.,]+)",
            r"\bTOTAL\b[\s\S]{0,15}?\$?\s*([\d.,]+)",
        ],
    ) or money_or_extra("valor_total", [])  # alias: campo valor_total del motor cotizaciones

    # Fecha: patrones específicos antes del genérico
    fecha_factura = find_date(
        [
            r"FECHA\s+DE\s+EMISI[OÓ]N[\s\S]{0,40}?(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})",
            r"FECHA\s+DE\s+FACTURA[\s\S]{0,40}?(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})",
            r"FECHA\s+DE\s+EXPEDICI[OÓ]N[\s\S]{0,40}?(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})",
            r"FECHA(?:\s+DE)?[\s\S]{0,55}?(\d{2})[/\-](\d{2})[/\-](\d{4})",
            r"(\d{4})[/\-](\d{2})[/\-](\d{2})",
        ]
    ) or (_parse_date_str(_extra.get("fecha_factura") or _extra.get("fecha", "")))

    nit_proveedor = _find_nit_factura(texto, flags, _extra)
    nombre_proveedor = _find_nombre_factura(texto, flags, _extra)

    campos = sum(
        1
        for v in [numero_factura, valor_factura, fecha_factura, nit_proveedor, nombre_proveedor]
        if v is not None
    )

    return ExtraccionFacturaResult(
        numero_factura=numero_factura,
        valor_factura=valor_factura,
        fecha_factura=fecha_factura,
        nit_proveedor=nit_proveedor,
        nombre_proveedor=nombre_proveedor,
        campos_encontrados=campos,
    )


def _parse_date_str(raw: str) -> Optional[date]:
    """Intenta parsear un string de fecha en formatos dd/mm/yyyy o yyyy-mm-dd."""
    if not raw:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            from datetime import datetime as _dt
            return _dt.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ── Estados elegibles para gestión de facturas ────────────────────────────────

_ESTADOS_ELEGIBLES = {
    EstadoOC.oc_enviada,        # desde que la OC se envía al proveedor
    EstadoOC.oc_en_plataforma,
    EstadoOC.entregada,
    EstadoOC.cerrada,           # permanece visible aunque esté cerrada
}

# Solicitudes con anticipo/proforma: visibles desde aprobación para bitácora y seguimiento (antes de OC enviada).
_PROFORMA_SEGUIMIENTO_ESTADOS: frozenset = frozenset({
    EstadoOC.aprobada,
    EstadoOC.oc_enviada,
    EstadoOC.oc_en_plataforma,
    EstadoOC.entregada,
    EstadoOC.cerrada,
})


def _visible_en_lista_financiero(sol: SolicitudOC) -> bool:
    if sol.estado in _ESTADOS_ELEGIBLES:
        return True
    if sol.tiene_proforma and sol.estado in _PROFORMA_SEGUIMIENTO_ESTADOS:
        return True
    return False


def _fila_solicitud_financiero(
    sol: SolicitudOC,
    oc_db: Session,
    fin_db: Session,
    db: Session,
) -> SolicitudConFacturaRead:
    cotizacion = oc_db.exec(
        select(CotizacionProveedor)
        .where(
            CotizacionProveedor.solicitud_id == sol.id,
            CotizacionProveedor.aprobada == True,  # noqa: E712
        )
    ).first()
    orden: Optional[OrdenCompra] = None
    if cotizacion:
        orden = oc_db.exec(
            select(OrdenCompra).where(OrdenCompra.solicitud_id == sol.id)
        ).first()
    factura = fin_db.exec(
        select(FacturaProveedor).where(FacturaProveedor.solicitud_id == sol.id)
    ).first()
    seg = fin_db.get(SeguimientoFinancieroSolicitud, sol.id)
    empresa_nombre = nombre_empresa_desde_plataforma(sol.plataforma)
    aprobado_por_nombre: Optional[str] = None
    if cotizacion and cotizacion.aprobado_por_id:
        u = db.get(User, cotizacion.aprobado_por_id)
        if u:
            aprobado_por_nombre = u.full_name
    return SolicitudConFacturaRead(
        solicitud_id=sol.id,
        consecutivo_os=sol.consecutivo_os,
        descripcion=sol.descripcion,
        solicitante_nombre=sol.solicitante_nombre,
        area_solicitante=sol.area_solicitante,
        plataforma=sol.plataforma,
        empresa_compra_nombre=empresa_nombre,
        condicion=sol.condicion,
        estado=sol.estado,
        fecha_en_plataforma=sol.fecha_en_plataforma,
        fecha_recibido=sol.fecha_recibido,
        tiene_proforma=sol.tiene_proforma,
        proforma_path=sol.proforma_path,
        forma_pago=cotizacion.forma_pago if cotizacion else None,
        cotizacion_id=cotizacion.id if cotizacion else None,
        proveedor_nombre=cotizacion.proveedor_nombre if cotizacion else None,
        proveedor_nit=cotizacion.proveedor_nit if cotizacion else None,
        aprobado_por_nombre=aprobado_por_nombre,
        valor_aprobado=cotizacion.valor_aprobado if cotizacion else None,
        valor_antes_iva=cotizacion.valor_antes_iva if cotizacion else None,
        valor_iva=cotizacion.valor_iva if cotizacion else None,
        orden_id=orden.id if orden else None,
        numero_oc=orden.numero_oc if orden else None,
        factura_id=factura.id if factura else None,
        factura_estado=factura.estado if factura else None,
        numero_factura=factura.numero_factura if factura else None,
        valor_factura=factura.valor_factura if factura else None,
        fecha_factura=factura.fecha_factura if factura else None,
        observaciones_seguimiento=seg.observaciones if seg else None,
        seguimiento_updated_at=seg.updated_at if seg else None,
        aval_compra_solicitud=sol.aval_compra,
        items_cotizacion=cotizacion.items if cotizacion else None,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "/facturas",
    response_model=list[SolicitudConFacturaRead],
)
def listar_facturas(
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
    fin_db: Session = Depends(get_financiero_db),
    db: Session = Depends(get_db),
) -> list[SolicitudConFacturaRead]:
    """Lista OCs visibles para finanzas: envío en adelante, o aprobadas con proforma/anticipo."""
    cond = or_(
        SolicitudOC.estado.in_([e.value for e in _ESTADOS_ELEGIBLES]),
        and_(
            SolicitudOC.tiene_proforma == True,  # noqa: E712
            SolicitudOC.estado.in_([e.value for e in _PROFORMA_SEGUIMIENTO_ESTADOS]),
        ),
    )
    solicitudes = oc_db.exec(select(SolicitudOC).where(cond)).all()
    return [_fila_solicitud_financiero(s, oc_db, fin_db, db) for s in solicitudes]


@router.get(
    "/solicitudes/{solicitud_id}",
    response_model=SolicitudConFacturaRead,
)
def obtener_solicitud_financiero(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
    fin_db: Session = Depends(get_financiero_db),
    db: Session = Depends(get_db),
) -> SolicitudConFacturaRead:
    sol = oc_db.get(SolicitudOC, solicitud_id)
    if not sol or not _visible_en_lista_financiero(sol):
        raise HTTPException(status_code=404, detail="Solicitud no encontrada o no visible en Financiero.")
    return _fila_solicitud_financiero(sol, oc_db, fin_db, db)


@router.patch(
    "/solicitudes/{solicitud_id}/seguimiento",
    response_model=SeguimientoSolicitudRead,
)
def actualizar_seguimiento_financiero(
    solicitud_id: uuid.UUID,
    payload: SeguimientoSolicitudUpdate,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
    fin_db: Session = Depends(get_financiero_db),
) -> SeguimientoSolicitudRead:
    sol = oc_db.get(SolicitudOC, solicitud_id)
    if not sol or not _visible_en_lista_financiero(sol):
        raise HTTPException(status_code=404, detail="Solicitud no encontrada o no visible en Financiero.")
    now = datetime.now(timezone.utc)
    seg = fin_db.get(SeguimientoFinancieroSolicitud, solicitud_id)
    if seg is None:
        seg = SeguimientoFinancieroSolicitud(solicitud_id=solicitud_id)
    seg.observaciones = payload.observaciones or None
    seg.updated_at = now
    seg.updated_by_id = current_user.id
    fin_db.add(seg)
    fin_db.commit()
    fin_db.refresh(seg)
    return SeguimientoSolicitudRead(
        solicitud_id=solicitud_id,
        observaciones=seg.observaciones,
        updated_at=seg.updated_at,
        updated_by_id=seg.updated_by_id,
    )


@router.post(
    "/solicitudes/{solicitud_id}/factura-borrador",
    response_model=FacturaRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_factura_borrador(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
    fin_db: Session = Depends(get_financiero_db),
) -> FacturaProveedor:
    """Crea un registro de factura sin archivo para que Finanzas cargue datos a mano antes de adjuntar PDF."""
    sol = oc_db.get(SolicitudOC, solicitud_id)
    if not sol or not _visible_en_lista_financiero(sol):
        raise HTTPException(status_code=404, detail="Solicitud no encontrada o no visible en Financiero.")
    existente = fin_db.exec(
        select(FacturaProveedor).where(FacturaProveedor.solicitud_id == solicitud_id)
    ).first()
    if existente:
        return existente  # type: ignore[return-value]

    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()
    if orden:
        cotizacion = oc_db.get(CotizacionProveedor, orden.cotizacion_id)
        if not cotizacion:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La OC no tiene cotización asociada.",
            )
    else:
        cotizacion = oc_db.exec(
            select(CotizacionProveedor)
            .where(
                CotizacionProveedor.solicitud_id == solicitud_id,
                CotizacionProveedor.aprobada == True,  # noqa: E712
            )
        ).first()
        if not cotizacion:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay cotización aprobada para esta solicitud.",
            )

    now = datetime.now(timezone.utc)
    factura = FacturaProveedor(
        solicitud_id=solicitud_id,
        cotizacion_id=cotizacion.id,
        orden_id=orden.id if orden else None,
        valor_aprobado_oc=cotizacion.valor_aprobado,
        aval_compra=sol.aval_compra,
        pdf_path=None,
        extraccion_automatica=False,
        estado=EstadoFactura.pendiente,
        registrado_por_id=current_user.id,
        created_at=now,
        updated_at=now,
    )
    fin_db.add(factura)
    fin_db.commit()
    fin_db.refresh(factura)
    return factura  # type: ignore[return-value]


@router.get(
    "/solicitudes/{solicitud_id}/cotizaciones",
    response_model=list[CotizacionListaFinancieroRead],
)
def listar_cotizaciones_financiero(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
) -> list[CotizacionListaFinancieroRead]:
    sol = oc_db.get(SolicitudOC, solicitud_id)
    if not sol or not _visible_en_lista_financiero(sol):
        raise HTTPException(status_code=404, detail="Solicitud no encontrada o no visible en Financiero.")
    rows = oc_db.exec(
        select(CotizacionProveedor)
        .where(CotizacionProveedor.solicitud_id == solicitud_id)
        .order_by(CotizacionProveedor.created_at.desc())
    ).all()
    out: list[CotizacionListaFinancieroRead] = []
    for c in rows:
        out.append(
            CotizacionListaFinancieroRead(
                id=c.id,
                solicitud_id=c.solicitud_id,
                proveedor_nombre=c.proveedor_nombre,
                proveedor_nit=c.proveedor_nit,
                numero_cotizacion_proveedor=c.numero_cotizacion_proveedor,
                aprobada=c.aprobada,
                valor_total=c.valor_total,
                valor_aprobado=c.valor_aprobado,
                tiene_adjunto=bool(c.pdf_path and str(c.pdf_path).strip()),
                created_at=c.created_at,
            )
        )
    return out


@router.get(
    "/cotizaciones/{cotizacion_id}/adjunto",
    response_class=FileResponse,
)
def descargar_adjunto_cotizacion_financiero(
    cotizacion_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
) -> FileResponse:
    """Descarga el archivo adjunto de una cotización (solo lectura para Finanzas)."""
    cotizacion = oc_db.get(CotizacionProveedor, cotizacion_id)
    if not cotizacion or not cotizacion.pdf_path:
        raise HTTPException(status_code=404, detail="Archivo no disponible.")
    sol = oc_db.get(SolicitudOC, cotizacion.solicitud_id)
    if not sol or not _visible_en_lista_financiero(sol):
        raise HTTPException(status_code=404, detail="No autorizado o solicitud no visible en Financiero.")
    path = Path(cotizacion.pdf_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco.")
    ext = path.suffix.lower().lstrip(".")
    mime_map = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    media_type = mime_map.get(ext, "application/octet-stream")
    return FileResponse(
        str(path),
        media_type=media_type,
        filename=f"cotizacion_{cotizacion_id}.{ext}",
    )


@router.get("/facturas/{solicitud_id}/proforma")
def descargar_proforma_financiero(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
):
    """Descarga la proforma de una solicitud desde el módulo financiero."""
    from pathlib import Path as _Path

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud or not solicitud.proforma_path:
        raise HTTPException(status_code=404, detail="Proforma no disponible para esta solicitud.")

    archivo = _Path(solicitud.proforma_path)
    if not archivo.exists():
        raise HTTPException(status_code=404, detail="Archivo de proforma no encontrado en el servidor.")

    extension = archivo.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }
    media_type = media_types.get(extension, "application/octet-stream")
    return FileResponse(
        str(archivo),
        media_type=media_type,
        filename=f"proforma_{solicitud.consecutivo_os}{extension}",
    )


@router.post(
    "/facturas/{solicitud_id}",
    response_model=FacturaRead,
    status_code=status.HTTP_201_CREATED,
)
async def subir_factura(
    solicitud_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
    fin_db: Session = Depends(get_financiero_db),
) -> FacturaRead:
    """Sube el PDF de factura, extrae campos automáticamente y crea/actualiza el registro."""
    # 1. Verificar solicitud
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado not in _ESTADOS_ELEGIBLES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La solicitud está en estado '{solicitud.estado}', no es elegible para factura.",
        )

    # 2. Cotización aprobada
    cotizacion = oc_db.exec(
        select(CotizacionProveedor)
        .where(
            CotizacionProveedor.solicitud_id == solicitud_id,
            CotizacionProveedor.aprobada == True,  # noqa: E712
        )
    ).first()
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay cotización aprobada para esta solicitud.",
        )

    # 3. Orden de compra
    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()
    if orden:
        cot_desde_oc = oc_db.get(CotizacionProveedor, orden.cotizacion_id)
        if cot_desde_oc:
            cotizacion = cot_desde_oc

    # 4. Guardar PDF
    nombre = file.filename or f"{solicitud_id}.pdf"
    ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else "pdf"
    if ext not in FORMATOS_FACTURA:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Formato no soportado. Formatos aceptados: {', '.join(sorted(FORMATOS_FACTURA))}.",
        )

    contenido = await file.read()
    FACTURAS_DIR.mkdir(parents=True, exist_ok=True)
    # Guardar con la extensión original para no corromper el tipo MIME al servir
    factura_dest = FACTURAS_DIR / f"{solicitud_id}.{ext}"
    factura_dest.write_bytes(contenido)

    # 5. Extraer campos — estructurado primero (Excel/Word), luego regex sobre texto
    texto = _extraer_texto(contenido, ext)
    extra = _extraer_campos_estructurado(contenido, ext)   # vacío para PDF
    extraccion = _parsear_factura(texto, extra=extra)
    extraccion.nombre_archivo = nombre
    log.info(
        "[facturas] extracción %s: %d campos encontrados (extra=%d)",
        ext, extraccion.campos_encontrados, len(extra),
    )

    # 6. Crear o actualizar FacturaProveedor
    now = datetime.now(timezone.utc)
    factura = fin_db.exec(
        select(FacturaProveedor).where(FacturaProveedor.solicitud_id == solicitud_id)
    ).first()

    if factura is None:
        factura = FacturaProveedor(
            solicitud_id=solicitud_id,
            cotizacion_id=cotizacion.id,
            orden_id=orden.id if orden else None,
            numero_factura=extraccion.numero_factura,
            valor_factura=extraccion.valor_factura,
            fecha_factura=extraccion.fecha_factura,
            nit_proveedor=extraccion.nit_proveedor,
            nombre_proveedor=extraccion.nombre_proveedor,
            valor_aprobado_oc=cotizacion.valor_aprobado,
            aval_compra=solicitud.aval_compra,
            pdf_path=str(factura_dest),
            extraccion_automatica=extraccion.campos_encontrados > 0,
            estado=EstadoFactura.pendiente,
            registrado_por_id=current_user.id,
            created_at=now,
            updated_at=now,
        )
    else:
        factura.cotizacion_id = cotizacion.id
        factura.orden_id = orden.id if orden else None
        factura.numero_factura = extraccion.numero_factura or factura.numero_factura
        factura.valor_factura = extraccion.valor_factura or factura.valor_factura
        factura.fecha_factura = extraccion.fecha_factura or factura.fecha_factura
        factura.nit_proveedor = extraccion.nit_proveedor or factura.nit_proveedor
        factura.nombre_proveedor = extraccion.nombre_proveedor or factura.nombre_proveedor
        factura.valor_aprobado_oc = cotizacion.valor_aprobado
        factura.pdf_path = str(factura_dest)
        factura.extraccion_automatica = extraccion.campos_encontrados > 0
        factura.updated_at = now

    fin_db.add(factura)
    fin_db.commit()
    fin_db.refresh(factura)

    # Validación automática deshabilitada: solo al pulsar «Correr validación».
    return factura  # type: ignore[return-value]


@router.get(
    "/facturas/{factura_id}/pdf",
    response_class=FileResponse,
)
def previsualizar_factura_pdf(
    factura_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
) -> FileResponse:
    """Retorna el archivo de la factura inline para previsualización en el browser."""
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    if not factura.pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta factura no tiene archivo asociado.",
        )

    archivo = Path(factura.pdf_path)
    ext = archivo.suffix.lower().lstrip(".")

    if ext in ("xlsx", "xls", "docx"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo de esta factura no es un PDF, no se puede previsualizar en el browser.",
        )

    if not archivo.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo de la factura no existe en el servidor.",
        )

    return FileResponse(
        path=str(archivo),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{archivo.name}"'},
    )


@router.get(
    "/facturas/{factura_id}",
    response_model=FacturaRead,
)
def obtener_factura(
    factura_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
) -> FacturaRead:
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")
    return factura  # type: ignore[return-value]


@router.patch(
    "/facturas/{factura_id}",
    response_model=FacturaRead,
)
def actualizar_factura(
    factura_id: uuid.UUID,
    payload: FacturaUpdate,
    current_user: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
) -> FacturaRead:
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(factura, field, value)
    factura.updated_at = datetime.now(timezone.utc)

    fin_db.add(factura)
    fin_db.commit()
    fin_db.refresh(factura)
    return factura  # type: ignore[return-value]


@router.delete(
    "/facturas/{factura_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_factura(
    factura_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
) -> None:
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    # Eliminar validaciones asociadas
    validaciones = fin_db.exec(
        select(ValidacionFactura).where(ValidacionFactura.factura_id == factura_id)
    ).all()
    for validacion in validaciones:
        fin_db.delete(validacion)

    fin_db.delete(factura)
    fin_db.commit()


@router.get(
    "/facturas/{factura_id}/validaciones",
    response_model=list[ValidacionRead],
)
def listar_validaciones(
    factura_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
) -> list[ValidacionRead]:
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    validaciones = fin_db.exec(
        select(ValidacionFactura).where(ValidacionFactura.factura_id == factura_id)
    ).all()
    return validaciones  # type: ignore[return-value]


@router.post(
    "/facturas/{factura_id}/validar",
    response_model=list[ValidacionRead],
)
def validar_factura(
    factura_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    fin_db: Session = Depends(get_financiero_db),
    oc_db: Session = Depends(get_oc_db),
) -> list[ValidacionRead]:
    """Ejecuta la validación manual: factura vs datos de la OC emitida."""
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == factura.solicitud_id)
    ).first()
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay orden de compra para esta solicitud; no se puede validar contra la OC.",
        )

    cotizacion = oc_db.get(CotizacionProveedor, orden.cotizacion_id)
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La OC no tiene cotización asociada en oc.db.",
        )

    _ejecutar_validacion(factura, orden, cotizacion, fin_db)
    fin_db.refresh(factura)

    validaciones = fin_db.exec(
        select(ValidacionFactura).where(ValidacionFactura.factura_id == factura_id)
    ).all()
    return validaciones  # type: ignore[return-value]


@router.get(
    "/solicitudes/{solicitud_id}/descargar-oc",
    response_class=FileResponse,
)
def descargar_oc(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
) -> FileResponse:
    """Descarga el PDF de la OC desde oc.db para el módulo de contabilidad."""
    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró una OC para esta solicitud.",
        )
    if not orden.pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La OC no tiene PDF asociado.",
        )
    pdf_path = Path(orden.pdf_path)
    if not pdf_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo PDF de la OC no existe en el servidor.",
        )
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"OC_{orden.numero_oc}.pdf",
    )


# ── Lógica de validación ──────────────────────────────────────────────────────


def _ejecutar_validacion(
    factura: FacturaProveedor,
    orden: OrdenCompra,
    cotizacion: CotizacionProveedor,
    fin_db: Session,
) -> None:
    """Compara la factura con los datos de la OC emitida (cotización vinculada a `orden`).

    Los importes y proveedor en la OC provienen de esa cotización; la referencia normativa es la OC
    generada a partir de ella.
    """
    if cotizacion.id != orden.cotizacion_id:
        log.warning(
            "[validación] cotización %s no coincide con orden.cotizacion_id %s — usando datos de la orden",
            cotizacion.id,
            orden.cotizacion_id,
        )
    now = datetime.now(timezone.utc)
    checks: list[tuple[str, Optional[str], Optional[str], bool, Optional[str]]] = []

    # 1. Número de factura — verificar presencia
    num = factura.numero_factura
    cumple_numero = bool(num and num.strip())
    checks.append((
        "numero_factura",
        "Campo requerido",
        num if num else None,
        cumple_numero,
        None if cumple_numero else "Número de factura no diligenciado",
    ))

    # 2. Valor — comparar contra valor aprobado de la OC (tolerancia configurable)
    val_esperado = cotizacion.valor_aprobado
    val_encontrado = factura.valor_factura
    if val_esperado is not None and val_encontrado is not None:
        diferencia_pct = abs(val_encontrado - val_esperado) / max(val_esperado, 1) * 100
        cumple_valor = diferencia_pct <= TOLERANCIA_VALOR_PCT
        obs_valor = (
            None if cumple_valor
            else f"Diferencia de {diferencia_pct:.2f}% (tolerancia {TOLERANCIA_VALOR_PCT}%)"
        )
    elif val_esperado is None:
        cumple_valor = False
        obs_valor = "La OC no registra valor aprobado para comparar"
    else:
        cumple_valor = False
        obs_valor = "Indique el valor en el formulario de factura para comparar con la OC"
    checks.append((
        "valor",
        _fmt_cop(val_esperado),
        _fmt_cop(val_encontrado),
        cumple_valor,
        obs_valor,
    ))

    # 3. Fecha de factura — verificar presencia
    fecha = factura.fecha_factura
    cumple_fecha = fecha is not None
    checks.append((
        "fecha_factura",
        "Campo requerido",
        str(fecha) if fecha else None,
        cumple_fecha,
        None if cumple_fecha else "Fecha de factura no diligenciada",
    ))

    # Upsert validaciones
    for campo, esperado, encontrado, cumple, obs in checks:
        existente = fin_db.exec(
            select(ValidacionFactura).where(
                ValidacionFactura.factura_id == factura.id,
                ValidacionFactura.campo == campo,
            )
        ).first()
        if existente:
            existente.valor_esperado = esperado
            existente.valor_encontrado = encontrado
            existente.cumple = cumple
            existente.observacion = obs
            existente.created_at = now
            fin_db.add(existente)
        else:
            fin_db.add(ValidacionFactura(
                factura_id=factura.id,
                campo=campo,
                valor_esperado=esperado,
                valor_encontrado=encontrado,
                cumple=cumple,
                observacion=obs,
                created_at=now,
            ))

    # Actualizar estado de la factura
    all_pass = all(cumple for _, _, _, cumple, _ in checks)
    factura.estado = EstadoFactura.validada if all_pass else EstadoFactura.con_diferencias
    factura.updated_at = now
    fin_db.add(factura)
    fin_db.commit()
