import io
import logging
import re
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import require_financiero
from app.financiero_database import get_financiero_db
from app.models.financiero import EstadoFactura, FacturaProveedor, ValidacionFactura
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
    estado: str
    fecha_en_plataforma: Optional[datetime]
    fecha_recibido: Optional[datetime]
    # Cotización aprobada
    cotizacion_id: Optional[uuid.UUID]
    proveedor_nombre: Optional[str]
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

    class Config:
        from_attributes = True


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
from app.services.number_utils import parse_cop as _to_float  # noqa: E402


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

    def text_or_extra(field: str, patterns: list[str]) -> Optional[str]:
        return find_text(patterns) or (_extra.get(field) or None)

    def money_or_extra(field: str, patterns: list[str]) -> Optional[float]:
        return find_money(patterns) or _to_float(_extra.get(field, ""))

    # Número de factura
    numero_factura = text_or_extra("numero_factura", [
        r"N[oó]\.?\s*(?:DE\s+)?FACTURA[\s\S]{0,10}?([A-Z0-9\-]{3,})",
        r"FACTURA\s+(?:DE\s+VENTA\s+)?(?:N[oó]\.?\s*|#\s*)?([FE]{2}-\d+|FV-\d+|\d{5,})",
        r"\b(FE-\d+)\b",
        r"\b(FV-\d+)\b",
        r"N[ÚUu]MERO\s+DE\s+FACTURA[\s\S]{0,10}?([A-Z0-9\-]{3,})",
    ])

    # Valor total de la factura
    valor_factura = money_or_extra("valor_factura", [
        r"TOTAL\s+A\s+PAGAR[\s\S]{0,20}?\$?\s*([\d.,]+)",
        r"VALOR\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
        r"GRAN\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
        r"GRAND\s+TOTAL[\s\S]{0,20}?\$?\s*([\d.,]+)",
        r"\bTOTAL\b[\s\S]{0,15}?\$?\s*([\d.,]+)",
    ]) or money_or_extra("valor_total", [])  # alias: campo valor_total del motor cotizaciones

    # Fecha de la factura — dd/mm/yyyy o yyyy-mm-dd
    fecha_factura = find_date([
        r"FECHA[\s\S]{0,15}?(\d{2})[/\-](\d{2})[/\-](\d{4})",
        r"(\d{4})[/\-](\d{2})[/\-](\d{2})",
    ]) or (_parse_date_str(_extra.get("fecha_factura") or _extra.get("fecha", "")))

    # NIT del proveedor — también usa proveedor_nit del motor de cotizaciones
    nit_proveedor = text_or_extra("proveedor_nit", [
        r"N\.?I\.?T\.?[\s\S]{0,10}?(\d[\d.\-]+[-]?\d)",
        r"NIT[\s\S]{0,10}?(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-]?\d)",
        r"IDENTIFICACI[OÓ]N[\s\S]{0,10}?(\d[\d.\-]+)",
    ])

    # Nombre / razón social del proveedor — también usa proveedor_nombre
    nombre_proveedor = text_or_extra("proveedor_nombre", [
        r"RAZ[OÓ]N\s+SOCIAL[\s\S]{0,10}?(.{3,150}?)(?:\n|$)",
        r"EMPRESA[\s\S]{0,10}?(.{3,150}?)(?:\n|$)",
        r"PROVEEDOR[\s\S]{0,10}?(.{3,150}?)(?:\n|$)",
    ])

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


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "/facturas",
    response_model=list[SolicitudConFacturaRead],
)
def listar_facturas(
    current_user: User = Depends(require_financiero),
    oc_db: Session = Depends(get_oc_db),
    fin_db: Session = Depends(get_financiero_db),
) -> list[SolicitudConFacturaRead]:
    """Lista todas las OCs en estados elegibles, enriquecidas con su factura si existe."""
    estados = [e.value for e in _ESTADOS_ELEGIBLES]
    solicitudes = oc_db.exec(
        select(SolicitudOC).where(SolicitudOC.estado.in_(estados))
    ).all()

    resultado: list[SolicitudConFacturaRead] = []
    for sol in solicitudes:
        # Cotización aprobada
        cotizacion = oc_db.exec(
            select(CotizacionProveedor)
            .where(
                CotizacionProveedor.solicitud_id == sol.id,
                CotizacionProveedor.aprobada == True,  # noqa: E712
            )
        ).first()

        # Orden de compra
        orden: Optional[OrdenCompra] = None
        if cotizacion:
            orden = oc_db.exec(
                select(OrdenCompra).where(OrdenCompra.solicitud_id == sol.id)
            ).first()

        # Factura en financiero.db
        factura = fin_db.exec(
            select(FacturaProveedor).where(FacturaProveedor.solicitud_id == sol.id)
        ).first()

        resultado.append(
            SolicitudConFacturaRead(
                solicitud_id=sol.id,
                consecutivo_os=sol.consecutivo_os,
                descripcion=sol.descripcion,
                solicitante_nombre=sol.solicitante_nombre,
                area_solicitante=sol.area_solicitante,
                plataforma=sol.plataforma,
                estado=sol.estado,
                fecha_en_plataforma=sol.fecha_en_plataforma,
                fecha_recibido=sol.fecha_recibido,
                cotizacion_id=cotizacion.id if cotizacion else None,
                proveedor_nombre=cotizacion.proveedor_nombre if cotizacion else None,
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
            )
        )

    return resultado


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

    # 7. Auto-validación de valor
    _ejecutar_validacion(factura, cotizacion, fin_db)

    fin_db.refresh(factura)
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
    """Ejecuta la validación campo a campo contra la OC aprobada."""
    factura = fin_db.get(FacturaProveedor, factura_id)
    if not factura:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    cotizacion = oc_db.get(CotizacionProveedor, factura.cotizacion_id)
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cotización aprobada no encontrada en oc.db.",
        )

    _ejecutar_validacion(factura, cotizacion, fin_db)
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
    cotizacion: CotizacionProveedor,
    fin_db: Session,
) -> None:
    """Compara los campos de la factura contra la OC y actualiza ValidacionFactura.

    Campos validados: valor, nit_proveedor, nombre_proveedor.
    Actualiza el estado de la factura a 'validada' o 'con_diferencias'.
    """
    now = datetime.now(timezone.utc)
    checks: list[tuple[str, Optional[str], Optional[str], bool, Optional[str]]] = []

    # Validar valor (tolerancia configurable)
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
        # La OC no tiene valor aprobado — no se puede validar
        cumple_valor = False
        obs_valor = "La OC no tiene valor aprobado registrado"
    else:
        # El motor no extrajo el valor de la factura
        cumple_valor = False
        obs_valor = "Valor de factura no encontrado en el documento"

    checks.append((
        "valor",
        str(val_esperado) if val_esperado is not None else None,
        str(val_encontrado) if val_encontrado is not None else None,
        cumple_valor,
        obs_valor,
    ))

    # Normaliza NITs eliminando espacios, puntos y guiones para comparación
    def _normalizar_nit(s: str) -> str:
        return re.sub(r"[\s.\-]", "", s).upper()

    # Validar NIT proveedor
    nit_esperado = cotizacion.proveedor_nit
    nit_encontrado = factura.nit_proveedor
    if nit_esperado and nit_encontrado:
        cumple_nit = _normalizar_nit(nit_esperado) == _normalizar_nit(nit_encontrado)
        obs_nit = (
            None if cumple_nit
            else f"NIT esperado: {nit_esperado}, encontrado: {nit_encontrado}"
        )
    elif not nit_esperado:
        # La cotización no registra NIT del proveedor — no se puede validar
        cumple_nit = False
        obs_nit = "NIT de proveedor no registrado en la cotización"
    else:
        # El motor no extrajo el NIT de la factura
        cumple_nit = False
        obs_nit = "NIT de proveedor no encontrado en el documento"

    checks.append((
        "nit_proveedor",
        nit_esperado,
        nit_encontrado,
        cumple_nit,
        obs_nit,
    ))

    # Validar nombre proveedor (coincidencia parcial, case-insensitive)
    nombre_esperado = cotizacion.proveedor_nombre
    nombre_encontrado = factura.nombre_proveedor
    if nombre_esperado and nombre_encontrado:
        cumple_nombre = (
            nombre_esperado.lower() in nombre_encontrado.lower()
            or nombre_encontrado.lower() in nombre_esperado.lower()
        )
        obs_nombre = (
            None if cumple_nombre
            else f"Nombre esperado: '{nombre_esperado}', encontrado: '{nombre_encontrado}'"
        )
    elif not nombre_esperado:
        cumple_nombre = False
        obs_nombre = "Nombre de proveedor no registrado en la cotización"
    else:
        cumple_nombre = False
        obs_nombre = "Nombre de proveedor no encontrado en el documento"

    checks.append((
        "nombre_proveedor",
        nombre_esperado,
        nombre_encontrado,
        cumple_nombre,
        obs_nombre,
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
