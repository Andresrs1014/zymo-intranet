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
    valor_unitario: float = 0
    valor_antes_iva: Optional[float] = None
    valor_iva: Optional[float] = None
    valor_total: float
    fecha_vigencia: Optional[date] = None
    forma_pago: Optional[str] = None
    plazo_entrega: Optional[str] = None
    garantia: Optional[str] = None
    anticipo: Optional[str] = None
    pago_saldo: Optional[str] = None
    observaciones: Optional[str] = None
    # Lista de ítems; None o vacía = cotización de un solo producto
    items: Optional[list[dict]] = None


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
    garantia: Optional[str]
    anticipo: Optional[str]
    pago_saldo: Optional[str]
    observaciones: Optional[str]
    items: Optional[list] = None
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


class ItemCotizacion(BaseModel):
    num: Optional[int] = None
    descripcion: str
    referencia: Optional[str] = None
    cantidad: Optional[float] = None
    valor_unitario: Optional[float] = None
    valor_total: Optional[float] = None


class ExtraccionResult(BaseModel):
    # Campos escalares del encabezado de la cotización
    proveedor_nit: Optional[str] = None
    valor_unitario: Optional[float] = None
    valor_antes_iva: Optional[float] = None
    valor_iva: Optional[float] = None
    valor_total: Optional[float] = None
    forma_pago: Optional[str] = None
    plazo_entrega: Optional[str] = None
    garantia: Optional[str] = None
    anticipo: Optional[str] = None
    pago_saldo: Optional[str] = None
    # Tabla de ítems (vacía si el documento tiene un solo producto)
    items: list[ItemCotizacion] = []
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


def _extraer_campos_estructurado(contenido: bytes, ext: str) -> dict[str, str]:
    """Extrae pares etiqueta→valor de documentos estructurados (Excel, Word).

    Usa field_synonyms para normalizar los encabezados a nombres canónicos.
    Retorna un dict {campo_canonico: valor_str} con los campos reconocidos.
    """
    from app.services.field_synonyms import resolve_field, fuzzy_resolve

    resultado: dict[str, str] = {}

    if ext in ("xlsx", "xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    cells = [c for c in row if c is not None]
                    if len(cells) < 2:
                        continue
                    label = str(cells[0]).strip()
                    value = str(cells[1]).strip()
                    if not label or not value or value.lower() == "none":
                        continue
                    canonical = resolve_field(label)
                    if not canonical:
                        canonical, _ = fuzzy_resolve(label)
                    if canonical and canonical not in resultado:
                        resultado[canonical] = value
        except Exception:
            pass

    elif ext == "docx":
        try:
            from docx import Document
            doc = Document(io.BytesIO(contenido))
            # Tablas: primera columna = etiqueta, segunda columna = valor
            for table in doc.tables:
                for row in table.rows:
                    raw_cells = [c.text.strip() for c in row.cells]
                    # Deduplicar celdas combinadas (python-docx las repite)
                    deduped: list[str] = []
                    for c in raw_cells:
                        if not deduped or c != deduped[-1]:
                            deduped.append(c)
                    cells = [c for c in deduped if c]
                    if len(cells) < 2:
                        continue
                    label, value = cells[0], cells[1]
                    canonical = resolve_field(label)
                    if not canonical:
                        canonical, _ = fuzzy_resolve(label)
                    if canonical and canonical not in resultado:
                        resultado[canonical] = value
            # Párrafos con formato "Etiqueta: valor"
            for para in doc.paragraphs:
                text = para.text.strip()
                if ":" not in text:
                    continue
                label, _, value = text.partition(":")
                label = label.strip()
                value = value.strip()
                if not value:
                    continue
                canonical = resolve_field(label)
                if not canonical:
                    canonical, _ = fuzzy_resolve(label)
                if canonical and canonical not in resultado:
                    resultado[canonical] = value
        except Exception:
            pass

    return resultado


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


def _parsear_campos(texto: str, extra: Optional[dict[str, str]] = None) -> ExtraccionResult:
    """Extrae campos de texto libre con regex.

    extra: dict de campos pre-resueltos vía extracción estructurada (Excel/Word).
    Se usan como complemento cuando el regex no encuentra el campo en el texto.
    """
    _extra = extra or {}

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

    def money_or_extra(field: str, patterns: list[str]) -> Optional[float]:
        return find_money(patterns) or _to_float(_extra.get(field, ""))

    def text_or_extra(field: str, patterns: list[str]) -> Optional[str]:
        return find_text(patterns) or (_extra.get(field) or None)

    nit = find_text([
        r"N\.?I\.?T\.?[:\s#]*(\d[\d.\-]+[-]\d)",
        r"NIT[:\s#]*(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-]?\d)",
    ]) or (_extra.get("proveedor_nit") or None)

    total = money_or_extra("valor_total", [
        r"TOTAL\s+A\s+PAGAR[:\s]*\$?\s*([\d.,]+)",
        r"VALOR\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
        r"GRAN\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
        r"\bTOTAL\b[:\s]*\$?\s*([\d.,]+)",
    ])

    _subtotal_regex = find_money([
        r"SUBTOTAL[:\s]*\$?\s*([\d.,]+)",
        r"SUB\s+TOTAL[:\s]*\$?\s*([\d.,]+)",
        r"VALOR\s+ANTES\s+DE\s+IVA[:\s]*\$?\s*([\d.,]+)",
        r"BASE\s+(?:IVA|GRAVABLE)[:\s]*\$?\s*([\d.,]+)",
    ])
    _subtotal_extra = _to_float(_extra.get("valor_antes_iva", ""))
    # Usar extra solo si es distinto al total para evitar que ambos queden iguales
    subtotal = _subtotal_regex or (_subtotal_extra if _subtotal_extra != total else None)

    iva = money_or_extra("valor_iva", [
        r"IVA\s+19%?[:\s]*\$?\s*([\d.,]+)",
        r"IVA\s+\d+%[:\s]*\$?\s*([\d.,]+)",
        r"\bIVA\b[:\s]*\$?\s*([\d.,]+)",
    ])

    unitario = money_or_extra("valor_unitario", [
        r"VALOR\s+UNITARIO[:\s]*\$?\s*([\d.,]+)",
        r"V\.?\s*UNITARIO[:\s]*\$?\s*([\d.,]+)",
        r"PRECIO\s+UNITARIO[:\s]*\$?\s*([\d.,]+)",
        r"P\.?\s*UNITARIO[:\s]*\$?\s*([\d.,]+)",
    ])

    forma_pago = text_or_extra("forma_pago", [
        r"FORMA\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
        r"CONDICI[OÓ]N(?:ES)?\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
        r"MODALIDAD\s+DE\s+PAGO[:\s]+(.{4,100}?)(?:\n|$)",
    ])

    plazo = text_or_extra("plazo_entrega", [
        r"PLAZO\s+DE\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
        r"TIEMPO\s+DE\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
        r"FECHA\s+(?:DE\s+)?ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
    ])

    garantia = text_or_extra("garantia", [
        r"GARANT[IÍ]A[:\s]+(.{3,200}?)(?:\n|$)",
        r"WARRANTY[:\s]+(.{3,200}?)(?:\n|$)",
    ])

    anticipo = text_or_extra("anticipo", [
        r"ANTICIPO[:\s]+(.{3,100}?)(?:\n|$)",
        r"PAGO\s+ANTICIPADO[:\s]+(.{3,100}?)(?:\n|$)",
        r"ABONO\s+INICIAL[:\s]+(.{3,100}?)(?:\n|$)",
    ])

    pago_saldo = text_or_extra("pago_saldo", [
        r"PAGO\s+(?:DEL\s+)?SALDO[:\s]+(.{3,100}?)(?:\n|$)",
        r"SALDO\s+A\s+PAGAR[:\s]+(.{3,100}?)(?:\n|$)",
        r"CONTRA\s+ENTREGA[:\s]+(.{3,100}?)(?:\n|$)",
    ])

    campos = sum(
        1 for v in [nit, total, subtotal, iva, unitario, forma_pago, plazo, garantia, anticipo, pago_saldo]
        if v is not None
    )

    return ExtraccionResult(
        proveedor_nit=nit,
        valor_unitario=unitario,
        valor_antes_iva=subtotal,
        valor_iva=iva,
        valor_total=total,
        forma_pago=forma_pago,
        plazo_entrega=plazo,
        garantia=garantia,
        anticipo=anticipo,
        pago_saldo=pago_saldo,
        campos_encontrados=campos,
    )


# ── Motor de extracción de tabla de ítems ─────────────────────────────────────
#
# Detecta la tabla de productos en cualquier cotización buscando una fila de
# encabezado cuyos títulos resuelvan a campos canónicos conocidos (descripcion,
# cantidad, valor_unitario, valor_total, referencia) usando field_synonyms.
#
# Soporta: Excel (.xlsx/.xls), PDF (via pdfplumber.extract_tables), Word (.docx)
#
# El motor regex existente (_parsear_campos) sigue activo para los campos
# escalares del encabezado (NIT, forma de pago, totales, etc.).

_CAMPOS_TABLA = {"descripcion", "cantidad", "valor_unitario", "valor_total", "referencia"}


def _fila_a_item(col_map: dict[int, str], celda_valores: list[str]) -> Optional[dict]:
    """Convierte una fila de datos a un dict de ítem usando el mapa de columnas.

    Retorna None si la fila no tiene descripción (fila vacía o de totales).
    """
    item: dict = {}
    for col_idx, canonical in col_map.items():
        if col_idx >= len(celda_valores):
            continue
        val = celda_valores[col_idx].strip()
        if not val or val.lower() in ("none", "n/a", "-", "—"):
            continue
        # Convertir campos numéricos
        if canonical in ("cantidad", "valor_unitario", "valor_total"):
            parsed = _to_float(val)
            item[canonical] = parsed if parsed is not None else val
        else:
            item[canonical] = val

    return item if item.get("descripcion") else None


def _detectar_encabezado(filas_celdas: list[list[str]]) -> Optional[tuple[int, dict[int, str]]]:
    """Busca la primera fila que sea un encabezado de tabla de ítems.

    Criterio: la fila debe resolver al menos 'descripcion' + uno de
    ('cantidad', 'valor_unitario', 'valor_total') usando field_synonyms.

    Retorna (índice_fila, {col_idx: campo_canónico}) o None.
    """
    from app.services.field_synonyms import resolve_field, fuzzy_resolve

    for row_idx, celdas in enumerate(filas_celdas):
        col_map: dict[int, str] = {}
        for col_idx, celda in enumerate(celdas):
            if not celda:
                continue
            canonical = resolve_field(celda)
            if not canonical:
                canonical, score = fuzzy_resolve(celda, threshold=0.72)
            if canonical and canonical in _CAMPOS_TABLA:
                col_map[col_idx] = canonical

        tiene_desc = "descripcion" in col_map.values()
        tiene_valor = any(f in col_map.values() for f in ("cantidad", "valor_unitario", "valor_total"))

        if tiene_desc and tiene_valor:
            return row_idx, col_map

    return None


def _items_desde_excel(contenido: bytes) -> list[dict]:
    """Extrae tabla de ítems de un Excel buscando la fila de encabezado."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
        for ws in wb.worksheets:
            filas = [
                [str(c).strip() if c is not None else "" for c in row]
                for row in ws.iter_rows(values_only=True)
            ]
            resultado = _detectar_encabezado(filas)
            if resultado is None:
                continue
            header_idx, col_map = resultado
            items = []
            for fila in filas[header_idx + 1:]:
                if not any(fila):
                    continue
                item = _fila_a_item(col_map, fila)
                if item:
                    items.append(item)
            if items:
                return items
    except Exception:
        pass
    return []


def _items_desde_pdf(contenido: bytes) -> list[dict]:
    """Extrae tabla de ítems de un PDF usando pdfplumber.extract_tables()."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(contenido)) as pdf:
            for page in pdf.pages:
                for tabla in (page.extract_tables() or []):
                    if not tabla or len(tabla) < 2:
                        continue
                    # Normalizar: cada celda como string limpio
                    filas = [
                        [str(c).strip() if c else "" for c in fila]
                        for fila in tabla
                    ]
                    resultado = _detectar_encabezado(filas)
                    if resultado is None:
                        continue
                    header_idx, col_map = resultado
                    items = []
                    for fila in filas[header_idx + 1:]:
                        if not any(fila):
                            continue
                        item = _fila_a_item(col_map, fila)
                        if item:
                            items.append(item)
                    if items:
                        return items
    except Exception:
        pass
    return []


def _items_desde_docx(contenido: bytes) -> list[dict]:
    """Extrae tabla de ítems de un Word buscando la tabla con encabezado de productos."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(contenido))
        for tabla in doc.tables:
            if len(tabla.rows) < 2:
                continue
            # Convertir cada fila a lista de strings, deduplicando celdas combinadas
            filas: list[list[str]] = []
            for row in tabla.rows:
                celdas_raw = [c.text.strip() for c in row.cells]
                deduped: list[str] = []
                for c in celdas_raw:
                    if not deduped or c != deduped[-1]:
                        deduped.append(c)
                filas.append(deduped)

            resultado = _detectar_encabezado(filas)
            if resultado is None:
                continue
            header_idx, col_map = resultado
            items = []
            for fila in filas[header_idx + 1:]:
                if not any(fila):
                    continue
                item = _fila_a_item(col_map, fila)
                if item:
                    items.append(item)
            if items:
                return items
    except Exception:
        pass
    return []


def _extraer_tabla_items(contenido: bytes, ext: str) -> list[dict]:
    """Punto de entrada del motor de extracción de ítems.

    Intenta detectar y extraer la tabla de productos de una cotización.
    Retorna lista vacía si el documento tiene formato de un solo producto.
    """
    if ext in ("xlsx", "xls"):
        return _items_desde_excel(contenido)
    if ext == "pdf":
        return _items_desde_pdf(contenido)
    if ext == "docx":
        return _items_desde_docx(contenido)
    return []


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

    # 1. Extraer tabla de ítems (motor de detección de encabezados)
    items_tabla = _extraer_tabla_items(contenido, ext)

    # 2. Extraer campos escalares del encabezado (NIT, totales, condiciones, etc.)
    extra: dict[str, str] = {}
    if ext in ("xlsx", "xls", "docx"):
        extra = _extraer_campos_estructurado(contenido, ext)
    texto = _extraer_texto(contenido, ext)
    resultado = _parsear_campos(texto, extra)

    # 3. Si la tabla de ítems tiene datos, agregar al resultado y recalcular totales
    if items_tabla:
        resultado.items = [ItemCotizacion(**item) for item in items_tabla]
        # Derivar valor_total como suma de filas si el regex no lo encontró
        if resultado.valor_total is None:
            totales = [
                i.get("valor_total") for i in items_tabla
                if isinstance(i.get("valor_total"), (int, float))
            ]
            if totales:
                resultado.valor_total = sum(totales)
        # Contabilizar ítems en campos_encontrados
        resultado.campos_encontrados += len(items_tabla)

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

    # Normalizar ítems: asignar número secuencial si no viene en el payload
    items_normalizados: Optional[list[dict]] = None
    if payload.items:
        items_normalizados = [
            {**item, "num": item.get("num") or (i + 1)}
            for i, item in enumerate(payload.items)
        ]

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
        garantia=payload.garantia,
        anticipo=payload.anticipo,
        pago_saldo=payload.pago_saldo,
        observaciones=payload.observaciones,
        items=items_normalizados,
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
