import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_compras
from app.models.oc import CotizacionProveedor, OrdenCompra, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(tags=["OC - Documentos"])

OC_DOCS_DIR = Path("/app/data/oc_docs")


# ── Schemas ───────────────────────────────────────────────────────────────────

class OrdenCompraRead(BaseModel):
    id: uuid.UUID
    solicitud_id: uuid.UUID
    cotizacion_id: uuid.UUID
    numero_oc: str
    pdf_path: Optional[str]
    enviada_proveedor: bool
    enviada_coordinador: bool
    email_proveedor: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_cop(value: Optional[float]) -> str:
    if value is None:
        return "N/A"
    return f"${value:,.0f} COP"


def _generar_docx(
    numero_oc: str,
    solicitud: SolicitudOC,
    cotizacion: CotizacionProveedor,
    output_path: Path,
) -> None:
    from docx import Document
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    ZYMO_BLUE = RGBColor(0, 48, 135)

    doc = Document()

    # ── Márgenes ──────────────────────────────────────────────────────────────
    for section in doc.sections:
        section.top_margin = section.bottom_margin = section.left_margin = section.right_margin = Pt(48)

    # ── Encabezado ────────────────────────────────────────────────────────────
    titulo_zymo = doc.add_paragraph()
    titulo_zymo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = titulo_zymo.add_run("ZYMO")
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = ZYMO_BLUE

    titulo_oc = doc.add_paragraph()
    titulo_oc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = titulo_oc.add_run("ORDEN DE COMPRA")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = ZYMO_BLUE

    doc.add_paragraph()

    # Número y fecha
    info_p = doc.add_paragraph()
    info_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = info_p.add_run(f"No. {numero_oc}    |    Fecha de emisión: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    run.font.size = Pt(11)
    run.font.color.rgb = ZYMO_BLUE

    doc.add_paragraph()

    # Línea separadora
    sep = doc.add_paragraph()
    pPr = sep._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "003087")
    pBdr.append(bottom)
    pPr.append(pBdr)

    doc.add_paragraph()

    # ── Sección Proveedor ─────────────────────────────────────────────────────
    def add_section_title(doc, text):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(12)
        run.font.color.rgb = ZYMO_BLUE
        return p

    def add_field(doc, label, value):
        p = doc.add_paragraph()
        run_label = p.add_run(f"{label}: ")
        run_label.bold = True
        run_label.font.size = Pt(10)
        run_value = p.add_run(str(value) if value is not None else "N/A")
        run_value.font.size = Pt(10)
        p.paragraph_format.space_after = Pt(2)
        return p

    add_section_title(doc, "PROVEEDOR")
    add_field(doc, "Nombre", cotizacion.proveedor_nombre)
    add_field(doc, "Email", cotizacion.proveedor_email)

    doc.add_paragraph()

    # ── Sección Ítem Solicitado ───────────────────────────────────────────────
    add_section_title(doc, "ÍTEM SOLICITADO")
    add_field(doc, "Consecutivo OS", solicitud.consecutivo_os)
    add_field(doc, "Descripción", solicitud.descripcion)
    add_field(doc, "Cantidad", solicitud.cantidad)
    add_field(doc, "Categoría", solicitud.categoria)
    add_field(doc, "Grupo de Artículos", solicitud.grupo_articulos)
    add_field(doc, "Sede", solicitud.sede)
    add_field(doc, "Cliente", solicitud.cliente)

    doc.add_paragraph()

    # ── Tabla de valores ──────────────────────────────────────────────────────
    add_section_title(doc, "DETALLE DE VALORES")
    doc.add_paragraph()

    table = doc.add_table(rows=2, cols=4)
    table.style = "Table Grid"

    # Encabezados
    headers = ["Descripción", "Cantidad", "Valor Unitario", "Valor Total"]
    header_row = table.rows[0]
    for i, header in enumerate(headers):
        cell = header_row.cells[i]
        cell.text = header
        run = cell.paragraphs[0].runs[0]
        run.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        run.font.size = Pt(10)
        # Fondo azul en encabezados
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), "003087")
        tcPr.append(shd)

    # Datos
    data_row = table.rows[1]
    values = [
        solicitud.descripcion,
        str(solicitud.cantidad),
        _format_cop(cotizacion.valor_unitario),
        _format_cop(cotizacion.valor_total),
    ]
    for i, val in enumerate(values):
        cell = data_row.cells[i]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(10)

    doc.add_paragraph()

    # ── Sección Aprobación ────────────────────────────────────────────────────
    add_section_title(doc, "APROBACIÓN")
    add_field(doc, "Valor Aprobado", _format_cop(cotizacion.valor_aprobado))
    add_field(doc, "Observaciones de Aprobación", cotizacion.observaciones_aprobacion)

    doc.add_paragraph()
    doc.add_paragraph()

    # ── Pie ───────────────────────────────────────────────────────────────────
    pie = doc.add_paragraph()
    pie.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = pie.add_run("Documento generado automáticamente por ZYMO Intranet")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(128, 128, 128)
    run.italic = True

    doc.save(str(output_path))


def _intentar_conversion_pdf(docx_path: Path, output_dir: Path) -> Optional[Path]:
    """Intenta convertir el DOCX a PDF con LibreOffice. Retorna la ruta del PDF si tiene éxito."""
    try:
        result = subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(docx_path),
            ],
            timeout=30,
            capture_output=True,
        )
        if result.returncode == 0:
            pdf_path = output_dir / (docx_path.stem + ".pdf")
            if pdf_path.exists():
                return pdf_path
    except FileNotFoundError:
        pass
    except subprocess.TimeoutExpired:
        pass
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/solicitudes/{solicitud_id}/generar-oc",
    response_model=OrdenCompraRead,
    status_code=status.HTTP_201_CREATED,
)
def generar_orden_compra(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    # Verificar si ya existe una OC para esta solicitud
    orden_existente = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()
    if orden_existente:
        return orden_existente

    # Buscar la solicitud
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada.",
        )

    # Buscar cotización aprobada más reciente
    cotizacion = oc_db.exec(
        select(CotizacionProveedor)
        .where(
            CotizacionProveedor.solicitud_id == solicitud_id,
            CotizacionProveedor.aprobada == True,  # noqa: E712
        )
        .order_by(CotizacionProveedor.created_at.desc())
    ).first()
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No existe una cotización aprobada para esta solicitud.",
        )

    # Generar número de OC: OC-{año}-{secuencial 4 dígitos}
    anio_actual = datetime.now(timezone.utc).year
    prefijo = f"OC-{anio_actual}-"
    count = oc_db.exec(
        select(func.count(OrdenCompra.id)).where(
            OrdenCompra.numero_oc.startswith(prefijo)
        )
    ).one()
    numero_oc = f"{prefijo}{(count + 1):04d}"

    # Preparar directorio de salida
    OC_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    docx_path = OC_DOCS_DIR / f"{numero_oc}.docx"

    # Generar DOCX
    _generar_docx(numero_oc, solicitud, cotizacion, docx_path)

    # Intentar conversión a PDF
    pdf_path_obj = _intentar_conversion_pdf(docx_path, OC_DOCS_DIR)
    pdf_path_str = str(pdf_path_obj) if pdf_path_obj else None

    # Crear registro OrdenCompra
    orden = OrdenCompra(
        solicitud_id=solicitud_id,
        cotizacion_id=cotizacion.id,
        numero_oc=numero_oc,
        pdf_path=pdf_path_str,
        email_proveedor=cotizacion.proveedor_email,
        created_at=datetime.now(timezone.utc),
    )
    oc_db.add(orden)
    oc_db.commit()
    oc_db.refresh(orden)
    return orden


@router.get(
    "/solicitudes/{solicitud_id}/orden",
    response_model=OrdenCompraRead,
)
def obtener_orden_por_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe orden de compra para esta solicitud.",
        )
    return orden


@router.get("/ordenes/{orden_id}/descargar")
def descargar_orden(
    orden_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    orden = oc_db.get(OrdenCompra, orden_id)
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de compra no encontrada.",
        )

    # Intentar servir PDF si existe
    if orden.pdf_path:
        pdf_path = Path(orden.pdf_path)
        if pdf_path.exists():
            return FileResponse(
                path=str(pdf_path),
                media_type="application/pdf",
                filename=f"{orden.numero_oc}.pdf",
            )

    # Fallback: servir DOCX
    docx_path = OC_DOCS_DIR / f"{orden.numero_oc}.docx"
    if docx_path.exists():
        return FileResponse(
            path=str(docx_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{orden.numero_oc}.docx",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No se encontró el archivo de la orden de compra.",
    )
