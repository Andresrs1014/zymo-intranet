import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.models.oc import CotizacionProveedor, OrdenCompra, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(tags=["OC - Documentos"])

OC_DOCS_DIR = Path("/app/data/oc_docs")


# ── Schemas ───────────────────────────────────────────────────────────────────

class MarcarEnviadaPayload(BaseModel):
    email_proveedor: Optional[str] = None


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


def _load_platform_config(plataforma: Optional[str]) -> dict:
    """Carga la config de la plataforma desde zymo/platforms/{slug}/config.json."""
    import json
    _SLUG_MAP = {
        "logimat": "logimat",
        "logimat s.a.s.": "logimat",
        "imccargo": "imccargo",
        "imc cargo": "imccargo",
        "imc cargo international": "imccargo",
        "imcdep": "imcdep",
        "imc deposito": "imcdep",
        "imc depósito": "imcdep",
    }
    slug = _SLUG_MAP.get((plataforma or "").lower().strip(), "logimat")
    config_path = Path(__file__).parent.parent.parent.parent.parent / "zymo" / "platforms" / slug / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text(encoding="utf-8"))
    return {
        "nombre": "ZYMO LOGÍSTICA",
        "nit": "",
        "direccion": "",
        "ciudad": "",
        "pbx": "",
        "email_facturacion": "",
        "prefijo_oc": "Z",
    }


def _set_cell_bg(cell, hex_color: str) -> None:
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tcPr.append(shd)


def _set_cell_borders(cell, top=None, bottom=None, left=None, right=None) -> None:
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBdr = OxmlElement("w:tcBdr")
    for side, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        if val:
            el = OxmlElement(f"w:{side}")
            el.set(qn("w:val"), val)
            el.set(qn("w:sz"), "4")
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), "CCCCCC")
            tcBdr.append(el)
    tcPr.append(tcBdr)


def _cell_text(cell, text: str, bold=False, size=9, color=None, align=None) -> None:
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    cell.text = ""
    para = cell.paragraphs[0]
    if align:
        para.alignment = {
            "center": WD_ALIGN_PARAGRAPH.CENTER,
            "right": WD_ALIGN_PARAGRAPH.RIGHT,
        }.get(align, WD_ALIGN_PARAGRAPH.LEFT)
    run = para.add_run(str(text) if text is not None else "")
    run.bold = bold
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def _generar_docx(
    numero_oc: str,
    solicitud: SolicitudOC,
    cotizacion: CotizacionProveedor,
    output_path: Path,
    auxiliar_nombre: str = "",
    aprobador_nombre: str = "",
) -> None:
    from docx import Document
    from docx.shared import Pt, RGBColor, Cm, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    empresa = _load_platform_config(solicitud.plataforma)
    RED = "C8102E"
    DARK = "1A1A1A"
    GRAY_BG = "F5F5F5"
    fecha_str = datetime.now(timezone.utc).strftime("%d/%m/%Y")

    # Calcular subtotal e IVA
    subtotal = cotizacion.valor_antes_iva if cotizacion.valor_antes_iva else cotizacion.valor_total
    iva = cotizacion.valor_iva if cotizacion.valor_iva else None
    total = cotizacion.valor_total

    doc = Document()

    # ── Márgenes ──────────────────────────────────────────────────────────────
    for section in doc.sections:
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(2)
        section.right_margin = Cm(2)

    # ── ENCABEZADO: tabla 2 col (empresa izq | OC info der) ───────────────────
    hdr = doc.add_table(rows=3, cols=2)
    hdr.style = "Table Grid"

    # Fila 0 — Nombre empresa + "ORDEN DE COMPRA No."
    _cell_text(hdr.rows[0].cells[0], empresa["nombre"], bold=True, size=14, color=RED)
    _cell_text(hdr.rows[0].cells[1], f"ORDEN DE COMPRA No. {numero_oc}", bold=True, size=12, color=RED, align="right")
    _set_cell_bg(hdr.rows[0].cells[0], "FFFFFF")
    _set_cell_bg(hdr.rows[0].cells[1], "FFFFFF")

    # Fila 1 — NIT empresa + Fecha
    _cell_text(hdr.rows[1].cells[0], f"NIT: {empresa['nit']}", size=9, color=DARK)
    _cell_text(hdr.rows[1].cells[1], f"FECHA: {fecha_str}", size=9, color=DARK, align="right")
    _set_cell_bg(hdr.rows[1].cells[0], GRAY_BG)
    _set_cell_bg(hdr.rows[1].cells[1], GRAY_BG)

    # Fila 2 — Dirección empresa + ciudad
    dir_text = f"{empresa['direccion']}\n{empresa['ciudad']}"
    _cell_text(hdr.rows[2].cells[0], dir_text, size=8, color="666666")
    _cell_text(hdr.rows[2].cells[1], f"PBX: {empresa['pbx']}", size=8, color="666666", align="right")
    _set_cell_bg(hdr.rows[2].cells[0], "FFFFFF")
    _set_cell_bg(hdr.rows[2].cells[1], "FFFFFF")

    doc.add_paragraph()

    # ── DATOS DEL PROVEEDOR ───────────────────────────────────────────────────
    prov = doc.add_table(rows=4, cols=2)
    prov.style = "Table Grid"

    # Título fila — encabezado rojo
    prov.rows[0].cells[0].merge(prov.rows[0].cells[1])
    _cell_text(prov.rows[0].cells[0], "SEÑORES:", bold=True, size=9, color="FFFFFF")
    _set_cell_bg(prov.rows[0].cells[0], RED)

    _cell_text(prov.rows[1].cells[0], "Proveedor:", bold=True, size=9)
    _cell_text(prov.rows[1].cells[1], cotizacion.proveedor_nombre or "", size=9)
    _set_cell_bg(prov.rows[1].cells[0], GRAY_BG)

    _cell_text(prov.rows[2].cells[0], "NIT:", bold=True, size=9)
    _cell_text(prov.rows[2].cells[1], cotizacion.proveedor_nit or "", size=9)
    _set_cell_bg(prov.rows[2].cells[0], GRAY_BG)

    cot_ref = cotizacion.numero_cotizacion_proveedor or ""
    os_ref = solicitud.consecutivo_os or ""
    _cell_text(prov.rows[3].cells[0], "ORDEN DE COMPRA SEGÚN:", bold=True, size=9)
    _cell_text(prov.rows[3].cells[1], f"OS: {os_ref}     COT: {cot_ref}", size=9)
    _set_cell_bg(prov.rows[3].cells[0], GRAY_BG)

    doc.add_paragraph()

    # ── TABLA DE ÍTEMS ────────────────────────────────────────────────────────
    items = doc.add_table(rows=2, cols=4)
    items.style = "Table Grid"

    # Encabezado rojo
    for i, (txt, al) in enumerate([("ÍTEM", "center"), ("CANT.", "center"), ("REFERENCIA / DESCRIPCIÓN", None), ("VALOR UNITARIO", "right")]):
        _cell_text(items.rows[0].cells[i], txt, bold=True, size=9, color="FFFFFF", align=al)
        _set_cell_bg(items.rows[0].cells[i], RED)

    # Datos del ítem
    _cell_text(items.rows[1].cells[0], "1", size=9, align="center")
    _cell_text(items.rows[1].cells[1], str(solicitud.cantidad), size=9, align="center")
    _cell_text(items.rows[1].cells[2], solicitud.descripcion or "", size=9)
    _cell_text(items.rows[1].cells[3], _format_cop(cotizacion.valor_unitario), size=9, align="right")

    doc.add_paragraph()

    # ── TOTALES ───────────────────────────────────────────────────────────────
    tot = doc.add_table(rows=3 if iva else 2, cols=2)
    tot.style = "Table Grid"

    row_idx = 0
    _cell_text(tot.rows[row_idx].cells[0], "SUB TOTAL", bold=True, size=9, align="right")
    _cell_text(tot.rows[row_idx].cells[1], _format_cop(subtotal), size=9, align="right")
    _set_cell_bg(tot.rows[row_idx].cells[0], GRAY_BG)
    row_idx += 1

    if iva:
        _cell_text(tot.rows[row_idx].cells[0], "IVA", bold=True, size=9, align="right")
        _cell_text(tot.rows[row_idx].cells[1], _format_cop(iva), size=9, align="right")
        _set_cell_bg(tot.rows[row_idx].cells[0], GRAY_BG)
        row_idx += 1

    _cell_text(tot.rows[row_idx].cells[0], "VALOR TOTAL", bold=True, size=10, color="FFFFFF", align="right")
    _cell_text(tot.rows[row_idx].cells[1], _format_cop(total), bold=True, size=10, color="FFFFFF", align="right")
    _set_cell_bg(tot.rows[row_idx].cells[0], RED)
    _set_cell_bg(tot.rows[row_idx].cells[1], RED)

    doc.add_paragraph()

    # ── CONDICIONES ───────────────────────────────────────────────────────────
    cond = doc.add_table(rows=3, cols=2)
    cond.style = "Table Grid"

    # Buzón facturación
    _cell_text(cond.rows[0].cells[0], "Buzón Facturación:", bold=True, size=9)
    _cell_text(cond.rows[0].cells[1], empresa.get("email_facturacion", ""), size=9)
    _set_cell_bg(cond.rows[0].cells[0], GRAY_BG)

    _cell_text(cond.rows[1].cells[0], "Forma de Pago:", bold=True, size=9)
    _cell_text(cond.rows[1].cells[1], cotizacion.forma_pago or cotizacion.observaciones or "", size=9)
    _set_cell_bg(cond.rows[1].cells[0], GRAY_BG)

    _cell_text(cond.rows[2].cells[0], "Plazo de Entrega:", bold=True, size=9)
    _cell_text(cond.rows[2].cells[1], cotizacion.plazo_entrega or "", size=9)
    _set_cell_bg(cond.rows[2].cells[0], GRAY_BG)

    doc.add_paragraph()

    # ── FIRMAS ────────────────────────────────────────────────────────────────
    firmas = doc.add_table(rows=2, cols=3)
    firmas.style = "Table Grid"

    for i, titulo in enumerate(["SOLICITA", "ELABORA", "APRUEBA"]):
        _cell_text(firmas.rows[0].cells[i], titulo, bold=True, size=9, color="FFFFFF", align="center")
        _set_cell_bg(firmas.rows[0].cells[i], RED)

    nombres = [
        solicitud.solicitante_nombre or "",
        auxiliar_nombre,
        aprobador_nombre,
    ]
    for i, nombre in enumerate(nombres):
        _cell_text(firmas.rows[1].cells[i], nombre, size=9, align="center")

    doc.add_paragraph()

    # ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
    pie = doc.add_paragraph()
    pie.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = pie.add_run(f"{empresa['nombre']}  |  {empresa['direccion']}  |  PBX: {empresa['pbx']}")
    run.font.size = Pt(7)
    run.font.color.rgb = RGBColor(150, 150, 150)
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
    db: Session = Depends(get_db),
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

    # Resolver nombres para firmas
    auxiliar_nombre = ""
    aprobador_nombre = ""
    if solicitud.auxiliar_id:
        aux = db.get(User, solicitud.auxiliar_id)
        if aux:
            auxiliar_nombre = aux.full_name
    if cotizacion.aprobado_por_id:
        aprobador = db.get(User, cotizacion.aprobado_por_id)
        if aprobador:
            aprobador_nombre = aprobador.full_name

    # Generar DOCX
    _generar_docx(numero_oc, solicitud, cotizacion, docx_path, auxiliar_nombre, aprobador_nombre)

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


@router.post(
    "/solicitudes/{solicitud_id}/marcar-enviada",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
async def marcar_oc_enviada(
    solicitud_id: uuid.UUID,
    payload: MarcarEnviadaPayload,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    from app.models.oc import EstadoOC
    from app.services import email_service

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado != EstadoOC.aprobada:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede marcar como enviada desde estado 'aprobada'. Estado actual: {solicitud.estado}",
        )

    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()

    solicitud.estado = EstadoOC.oc_enviada
    solicitud.fecha_envio_oc = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    if orden and payload.email_proveedor:
        orden.email_proveedor = payload.email_proveedor
        orden.enviada_proveedor = True
        oc_db.add(orden)

    oc_db.commit()
    oc_db.refresh(solicitud)

    background_tasks.add_task(email_service.send_oc_enviada, solicitud)

    if orden and payload.email_proveedor:
        background_tasks.add_task(
            email_service.send_oc_a_proveedor,
            solicitud,
            orden.numero_oc,
            orden.pdf_path,
            payload.email_proveedor,
        )

    return {"ok": True}


@router.post(
    "/solicitudes/{solicitud_id}/marcar-entregada",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def marcar_entregada(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    from app.models.oc import EstadoOC

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado != EstadoOC.oc_enviada:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede marcar como entregada desde estado 'oc_enviada'. Estado actual: {solicitud.estado}",
        )

    solicitud.estado = EstadoOC.entregada
    solicitud.fecha_recibido = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()

    return {"ok": True}


@router.post(
    "/solicitudes/{solicitud_id}/cerrar",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def cerrar_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    from app.models.oc import EstadoOC

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado != EstadoOC.entregada:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede cerrar desde estado 'entregada'. Estado actual: {solicitud.estado}",
        )

    solicitud.estado = EstadoOC.cerrada
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()

    return {"ok": True}


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
