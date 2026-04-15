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


_PLATFORMS_DIR = Path(__file__).parent.parent.parent / "platforms"
_STATIC_DIR = Path(__file__).parent.parent.parent / "static"

_SLUG_MAP = {
    "logimat": "logimat",
    "logimat s.a.s.": "logimat",
    "imccargo": "imccargo",
    "imc cargo": "imccargo",
    "imc cargo international": "imccargo",
    "imc cargo international s.a.s.": "imccargo",
    "imcdep": "imcdep",
    "imc deposito": "imcdep",
    "imc depósito": "imcdep",
    "imc deposito s.a.s.": "imcdep",
    "imc depósito s.a.s.": "imcdep",
}


def _load_platform_config(plataforma: Optional[str]) -> dict:
    """Carga la config de la plataforma desde app/platforms/{slug}/config.json."""
    import json
    slug = _SLUG_MAP.get((plataforma or "").lower().strip(), "logimat")
    config_path = _PLATFORMS_DIR / slug / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text(encoding="utf-8"))
    return {
        "nombre": "LOGIMAT S.A.S.",
        "nit": "830.103.877-6",
        "direccion": "Carrera 106 No. 15A-25 - Manzana 23 LTE 135M",
        "ciudad": "Zona Franca de Bogotá - Colombia",
        "pbx": "(1) 7 44 92 00",
        "email_facturacion": "830103877@factureinbox.co",
        "prefijo_oc": "L",
        "logo": "logimat_logo.png",
    }


def _generar_xlsx(
    numero_oc: str,
    solicitud: SolicitudOC,
    cotizacion: CotizacionProveedor,
    output_path: Path,
    auxiliar_nombre: str = "",
    aprobador_nombre: str = "",
) -> None:
    """Rellena la plantilla Excel de la plataforma con los datos de la OC.

    Las fórmulas del template (totales, IVA) se conservan intactas;
    LibreOffice las recalcula al convertir a PDF.
    """
    import openpyxl
    from zoneinfo import ZoneInfo

    empresa = _load_platform_config(solicitud.plataforma)
    slug = _SLUG_MAP.get((solicitud.plataforma or "").lower().strip(), "logimat")
    template_path = _PLATFORMS_DIR / slug / empresa.get("template", "template.xlsx")

    wb = openpyxl.load_workbook(str(template_path))
    ws = wb.active

    fecha_str = datetime.now(ZoneInfo("America/Bogota")).strftime("%d/%m/%Y")
    cfg = empresa.get("celdas_dinamicas", {})
    items_cfg = empresa.get("items", {})

    # ── Cabecera dinámica ──────────────────────────────────────────────────────
    if cfg.get("numero_oc"):
        ws[cfg["numero_oc"]] = f"ORDEN DE COMPRA No. {numero_oc}"
    if cfg.get("fecha"):
        ws[cfg["fecha"]] = fecha_str
    if cfg.get("proveedor_nombre"):
        ws[cfg["proveedor_nombre"]] = cotizacion.proveedor_nombre or ""
    if cfg.get("proveedor_nit"):
        ws[cfg["proveedor_nit"]] = cotizacion.proveedor_nit or ""
    if cfg.get("os_ref"):
        ws[cfg["os_ref"]] = f"OS: {solicitud.consecutivo_os}" if solicitud.consecutivo_os else ""
    if cfg.get("cot_ref"):
        ws[cfg["cot_ref"]] = cotizacion.numero_cotizacion_proveedor or ""

    # ── Firmas ─────────────────────────────────────────────────────────────────
    if cfg.get("solicita"):
        ws[cfg["solicita"]] = solicitud.solicitante_nombre or ""
    if cfg.get("elabora"):
        ws[cfg["elabora"]] = auxiliar_nombre
    if cfg.get("aprueba"):
        ws[cfg["aprueba"]] = aprobador_nombre

    # ── Ítems ─────────────────────────────────────────────────────────────────
    fila_inicio = items_cfg.get("fila_inicio", 11)
    max_filas = items_cfg.get("max_filas", 20)
    col_num = items_cfg.get("col_item_num", "C")
    col_cant = items_cfg.get("col_cantidad", "D")
    col_desc = items_cfg.get("col_descripcion", "F")
    col_vunit = items_cfg.get("col_valor_unitario", "G")

    # Limpiar todas las filas de ítems (preserva fórmulas en col H)
    for fila in range(fila_inicio, fila_inicio + max_filas):
        ws[f"{col_num}{fila}"] = None
        ws[f"{col_cant}{fila}"] = None
        ws[f"E{fila}"] = None  # referencia
        ws[f"{col_desc}{fila}"] = None
        ws[f"{col_vunit}{fila}"] = None

    # Escribir el único ítem de la OC en la primera fila disponible
    ws[f"{col_num}{fila_inicio}"] = 1
    ws[f"{col_cant}{fila_inicio}"] = solicitud.cantidad
    ws[f"{col_desc}{fila_inicio}"] = solicitud.descripcion or ""
    ws[f"{col_vunit}{fila_inicio}"] = cotizacion.valor_unitario or 0

    # ── IVA manual (solo en plantillas sin fórmula de IVA) ────────────────────
    if cfg.get("iva_manual"):
        ws[cfg["iva_manual"]] = cotizacion.valor_iva or 0

    # ── Configuración de página: ajustar a 1 hoja ancha para PDF correcto ─────
    from openpyxl.worksheet.page import PageMargins

    # Área de impresión desde config — limita las columnas que LibreOffice convierte
    print_area = empresa.get("print_area")
    if print_area:
        ws.print_area = print_area

    # Eliminar anchos de columna espurios fuera del área de impresión (p.ej. columna IW=257)
    from openpyxl.utils import column_index_from_string
    max_content_col = 10  # columna J — más allá no hay contenido real
    cols_to_remove = [
        c for c in list(ws.column_dimensions.keys())
        if column_index_from_string(c) > max_content_col
    ]
    for col in cols_to_remove:
        del ws.column_dimensions[col]

    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0  # sin límite alto (crece si hay muchos ítems)
    ws.page_setup.orientation = "landscape" if empresa.get("orientacion_paisaje") else "portrait"
    ws.page_setup.paperSize = 9  # A4
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.5, right=0.5, top=0.75, bottom=0.75, header=0.3, footer=0.3)

    wb.save(str(output_path))


def _intentar_conversion_pdf(source_path: Path, output_dir: Path) -> Optional[Path]:
    """Convierte un XLSX (o DOCX) a PDF con LibreOffice. Retorna la ruta del PDF si tiene éxito."""
    try:
        result = subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(source_path),
            ],
            timeout=60,
            capture_output=True,
        )
        if result.returncode == 0:
            pdf_path = output_dir / (source_path.stem + ".pdf")
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
    xlsx_path = OC_DOCS_DIR / f"{numero_oc}.xlsx"

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

    # Generar XLSX desde plantilla
    _generar_xlsx(numero_oc, solicitud, cotizacion, xlsx_path, auxiliar_nombre, aprobador_nombre)

    # Intentar conversión a PDF (LibreOffice recalcula fórmulas)
    pdf_path_obj = _intentar_conversion_pdf(xlsx_path, OC_DOCS_DIR)
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

    # Fallback: servir XLSX si el PDF no está disponible
    xlsx_path = OC_DOCS_DIR / f"{orden.numero_oc}.xlsx"
    if xlsx_path.exists():
        return FileResponse(
            path=str(xlsx_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{orden.numero_oc}.xlsx",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No se encontró el archivo de la orden de compra.",
    )
