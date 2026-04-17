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


def _escribir_plazo_entrega(ws, cfg: dict, plazo_entrega: str) -> None:
    """Detecta el tipo de plazo y escribe en la celda correspondiente del template."""
    import re

    valor = plazo_entrega.strip().upper()

    # INMEDIATA / INMEDIATO
    if "INMEDIATA" in valor or "INMEDIATO" in valor or valor in ("INMEDIATA", "INMEDIATO"):
        if cfg.get("plazo_inmediata_x"):
            ws[cfg["plazo_inmediata_x"]] = "X"
        return

    # Número de días — extraer primer entero del texto
    numeros = re.findall(r"\d+", plazo_entrega)
    if numeros:
        if cfg.get("plazo_dias"):
            ws[cfg["plazo_dias"]] = int(numeros[0])
        return

    # Si llega algo parecido a fecha, escribir en plazo_fecha
    if cfg.get("plazo_fecha"):
        ws[cfg["plazo_fecha"]] = plazo_entrega


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

    # ── Logo de la empresa ─────────────────────────────────────────────────────
    logo_filename = empresa.get("logo")
    if logo_filename:
        logo_path = _PLATFORMS_DIR / slug / logo_filename
        if logo_path.exists():
            from openpyxl.drawing.image import Image as XLImage
            # Eliminar logos embebidos en la plantilla para evitar duplicados
            ws._images = []
            anchor = empresa.get("logo_anchor", "C3")
            width = empresa.get("logo_width", 150)
            height = empresa.get("logo_height", 55)
            img = XLImage(str(logo_path))
            img.width = width
            img.height = height
            img.anchor = anchor
            ws.add_image(img)

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
    # solicita apunta a ENTREGAR A (p.ej. E48 en Logimat). La celda SOLICITA del
    # template tiene fórmula =ENTREGAR_A, por lo que se auto-rellena.
    if cfg.get("solicita"):
        ws[cfg["solicita"]] = solicitud.solicitante_nombre or ""
    if cfg.get("area_firma"):
        ws[cfg["area_firma"]] = solicitud.area_solicitante or ""
    if cfg.get("elabora"):
        ws[cfg["elabora"]] = auxiliar_nombre
    if cfg.get("aprueba"):
        ws[cfg["aprueba"]] = aprobador_nombre

    # ── Campos operativos de la cotización ────────────────────────────────────
    if cfg.get("nota"):
        nota = cotizacion.observaciones or solicitud.observaciones_solicitante or ""
        ws[cfg["nota"]] = nota

    # Limpiar checkboxes de forma_pago que el template trae pre-marcados
    for _cell_key in ("forma_pago_x",):
        if cfg.get(_cell_key):
            ws[cfg[_cell_key]] = None

    if cfg.get("forma_pago") and cotizacion.forma_pago:
        ws[cfg["forma_pago"]] = cotizacion.forma_pago
        if cfg.get("forma_pago_x"):
            ws[cfg["forma_pago_x"]] = "X"

    # Limpiar todos los checkboxes de plazo (el template los trae pre-marcados)
    for _cell_key in ("plazo_inmediata_x", "plazo_dias", "plazo_fecha"):
        if cfg.get(_cell_key):
            ws[cfg[_cell_key]] = None

    # Plazo de entrega: detectar tipo y marcar celda correspondiente
    if cotizacion.plazo_entrega:
        _escribir_plazo_entrega(ws, cfg, cotizacion.plazo_entrega)

    # ── Condiciones adicionales ───────────────────────────────────────────────
    if cfg.get("garantia") and cotizacion.garantia:
        ws[cfg["garantia"]] = cotizacion.garantia
    if cfg.get("anticipo") and cotizacion.anticipo:
        ws[cfg["anticipo"]] = cotizacion.anticipo
    if cfg.get("pago_saldo") and cotizacion.pago_saldo:
        ws[cfg["pago_saldo"]] = cotizacion.pago_saldo

    # ── Ítems ─────────────────────────────────────────────────────────────────
    fila_inicio = items_cfg.get("fila_inicio", 11)
    max_filas = items_cfg.get("max_filas", 20)
    col_num = items_cfg.get("col_item_num", "C")
    col_cant = items_cfg.get("col_cantidad", "D")
    col_ref = items_cfg.get("col_referencia")
    col_desc = items_cfg.get("col_descripcion", "F")
    col_vunit = items_cfg.get("col_valor_unitario", "G")

    # Limpiar todas las filas de ítems (preserva fórmulas en col H)
    for fila in range(fila_inicio, fila_inicio + max_filas):
        ws[f"{col_num}{fila}"] = None
        ws[f"{col_cant}{fila}"] = None
        if col_ref:
            ws[f"{col_ref}{fila}"] = None
        ws[f"{col_desc}{fila}"] = None
        ws[f"{col_vunit}{fila}"] = None

    # Construir la lista de ítems a escribir:
    # Si la cotización tiene ítems múltiples, usarlos; si no, crear uno con los campos de la solicitud.
    items_a_escribir: list[dict] = cotizacion.items or [{
        "num": 1,
        "descripcion": solicitud.descripcion or "",
        "referencia": solicitud.placa_ficha or "",
        "cantidad": solicitud.cantidad,
        "valor_unitario": cotizacion.valor_unitario or 0,
    }]

    for i, item in enumerate(items_a_escribir[:max_filas]):
        fila = fila_inicio + i
        ws[f"{col_num}{fila}"] = item.get("num") or (i + 1)
        ws[f"{col_cant}{fila}"] = item.get("cantidad") or ""
        if col_ref:
            ws[f"{col_ref}{fila}"] = item.get("referencia") or ""
        ws[f"{col_desc}{fila}"] = item.get("descripcion") or ""
        ws[f"{col_vunit}{fila}"] = item.get("valor_unitario") or 0

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
        # Buscar ítems de la cotización aprobada para enviarlos al proveedor
        cotizacion = oc_db.exec(
            select(CotizacionProveedor)
            .where(
                CotizacionProveedor.solicitud_id == solicitud_id,
                CotizacionProveedor.aprobada == True,  # noqa: E712
            )
            .order_by(CotizacionProveedor.created_at.desc())
        ).first()
        items_cot = cotizacion.items if cotizacion else None

        background_tasks.add_task(
            email_service.send_oc_a_proveedor,
            solicitud,
            orden.numero_oc,
            orden.pdf_path,
            payload.email_proveedor,
            items_cot,
        )

    return {"ok": True}


@router.post(
    "/solicitudes/{solicitud_id}/marcar-en-plataforma",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def marcar_en_plataforma(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Auxiliar confirma que el pedido ya fue ingresado en la plataforma (ERP/sistema)."""
    from app.models.oc import EstadoOC

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado != EstadoOC.oc_enviada:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede marcar en plataforma desde estado 'oc_enviada'. Estado actual: {solicitud.estado}",
        )

    solicitud.estado = EstadoOC.oc_en_plataforma
    solicitud.fecha_en_plataforma = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)
    oc_db.commit()

    return {"ok": True}


@router.post(
    "/solicitudes/{solicitud_id}/marcar-entregada",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def marcar_entregada(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    """Coordinador/solicitante confirma que recibió físicamente el pedido.
    Accesible para cualquier usuario autenticado cuyo email coincida con el solicitante,
    o para usuarios del módulo de compras (require_compras)."""
    from app.models.oc import EstadoOC

    OC_ROLES = {"admin", "administrativo", "directivo", "compras"}
    es_compras = current_user.role in OC_ROLES or current_user.area == "Compras"

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    # Validar que sea el solicitante o alguien de compras
    if not es_compras and solicitud.solicitante_email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el solicitante o el equipo de compras puede confirmar la recepción.",
        )

    if solicitud.estado != EstadoOC.oc_en_plataforma:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede confirmar recepción desde estado 'oc_en_plataforma'. Estado actual: {solicitud.estado}",
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
