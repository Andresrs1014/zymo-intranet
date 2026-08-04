import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

_log = logging.getLogger(__name__)

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, func, select
from jinja2 import Environment, FileSystemLoader

from app.core.deps import get_current_user, require_compras
from app.core.permissions import user_has_permission
from app.database import get_db
from app.models.oc import CotizacionProveedor, OrdenCompra, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db
from app.services.historial import registrar_cambio_estado
from app.services.platform_empresa import SLUG_MAP as _SLUG_MAP

router = APIRouter(tags=["OC - Documentos"])

OC_DOCS_DIR = Path("/app/data/oc_docs")
_PLATFORMS_DIR = Path(__file__).parent.parent.parent / "platforms"
_TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"


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

def _load_platform_config(plataforma: Optional[str]) -> dict:
    import json
    slug = _SLUG_MAP.get((plataforma or "").lower().strip(), "logimat")
    config_path = _PLATFORMS_DIR / slug / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text(encoding="utf-8"))
    return {
        "nombre": "Conexiones Logísticas",
        "nit": "",
        "direccion_entrega": "",
        "email_facturacion": "",
        "logo": "",
        "texto_cumplimiento": "",
    }


def _generar_pdf(
    numero_oc: str,
    solicitud: SolicitudOC,
    cotizacion: CotizacionProveedor,
    output_path: Path,
    auxiliar_nombre: str = "",
    aprobador_nombre: str = "",
) -> None:
    empresa = _load_platform_config(solicitud.plataforma)
    slug = _SLUG_MAP.get((solicitud.plataforma or "").lower().strip(), "logimat")

    logo_url = ""
    if empresa.get("logo"):
        logo_path = _PLATFORMS_DIR / slug / empresa["logo"]
        if logo_path.exists():
            logo_url = f"file://{logo_path.resolve().as_posix()}"

    cantidad = solicitud.cantidad or 1
    valor_unit = cotizacion.valor_unitario or 0
    items = cotizacion.items or [{
        "num": 1,
        "descripcion": solicitud.descripcion or "",
        "referencia": solicitud.placa_ficha or "",
        "cantidad": cantidad,
        "valor_unitario": valor_unit,
        "valor_total": round(valor_unit * cantidad, 2),
    }]

    context = {
        "empresa": empresa,
        "logo_url": logo_url,
        "numero_oc": numero_oc,
        "fecha": datetime.now(ZoneInfo("America/Bogota")).strftime("%d/%m/%Y"),
        "proveedor": {
            "nombre": cotizacion.proveedor_nombre or "",
            "nit": cotizacion.proveedor_nit or "N/A",
        },
        "os_ref": solicitud.consecutivo_os or "",
        "cot_ref": cotizacion.numero_cotizacion_proveedor or "",
        "entregar_a": solicitud.solicitante_nombre or "",
        # Nota impresa al proveedor: solo observaciones del solicitante. Las de cotización
        # son de elaboración/revisión interna y no deben salir en la OC.
        "nota": solicitud.observaciones_solicitante or "",
        "items": items,
        "subtotal": cotizacion.valor_antes_iva,   # None if not provided — template handles display
        "iva": cotizacion.valor_iva,               # None if not applicable
        "total": cotizacion.valor_total or 0,
        "forma_pago": cotizacion.forma_pago or "",
        "anticipo": cotizacion.anticipo or "",
        "pago_saldo": cotizacion.pago_saldo or "",
        "plazo_entrega": cotizacion.plazo_entrega or "",
        "garantia": cotizacion.garantia or "CALIDAD",
        "firmas": {
            "solicita": solicitud.solicitante_nombre or "",
            "area": solicitud.area_solicitante or "",
            "elabora": auxiliar_nombre,
            "aprueba": aprobador_nombre,
        },
    }

    # Import perezoso: WeasyPrint requiere librerías nativas GTK/Pango que no
    # están disponibles en todos los entornos de desarrollo (ej. Windows sin
    # GTK) — cargar aquí evita que falte en el arranque de todo el backend
    # cuando solo se necesitan otros módulos.
    from weasyprint import HTML

    env = Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)))
    html_content = env.get_template("template_oc.html").render(**context)
    # base_url apunta a platforms/ para que WeasyPrint resuelva los logos correctamente
    HTML(string=html_content, base_url=str(_PLATFORMS_DIR)).write_pdf(str(output_path))


def regenerar_pdf_orden_por_solicitud(
    oc_db: Session,
    db,
    solicitud_id: uuid.UUID,
) -> Optional[tuple[OrdenCompra, CotizacionProveedor]]:
    """Regenera el PDF de la orden existente con la cotización aprobada más reciente."""
    orden = oc_db.exec(select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)).first()
    if not orden:
        return None

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    cotizacion = oc_db.exec(
        select(CotizacionProveedor)
        .where(
            CotizacionProveedor.solicitud_id == solicitud_id,
            CotizacionProveedor.aprobada == True,  # noqa: E712
        )
        .order_by(CotizacionProveedor.created_at.desc())
    ).first()
    if not solicitud or not cotizacion:
        return None

    numero_oc = orden.numero_oc
    old_pdf = OC_DOCS_DIR / f"{numero_oc}.pdf"
    if old_pdf.exists():
        old_pdf.unlink(missing_ok=True)

    pdf_path = OC_DOCS_DIR / f"{numero_oc}.pdf"

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

    _generar_pdf(numero_oc, solicitud, cotizacion, pdf_path, auxiliar_nombre, aprobador_nombre)

    orden.cotizacion_id = cotizacion.id
    orden.pdf_path = str(pdf_path)
    if cotizacion.proveedor_email:
        orden.email_proveedor = cotizacion.proveedor_email
    oc_db.add(orden)
    oc_db.commit()
    oc_db.refresh(orden)
    oc_db.refresh(cotizacion)
    return orden, cotizacion


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/solicitudes/{solicitud_id}/generar-oc",
    response_model=OrdenCompraRead,
    status_code=status.HTTP_201_CREATED,
)
def generar_orden_compra(
    solicitud_id: uuid.UUID,
    forzar: bool = False,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
    db: Session = Depends(get_db),
):
    orden_existente = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()

    if orden_existente and not forzar:
        return orden_existente

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

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

    if orden_existente and forzar:
        numero_oc = orden_existente.numero_oc
        old_pdf = OC_DOCS_DIR / f"{numero_oc}.pdf"
        if old_pdf.exists():
            old_pdf.unlink(missing_ok=True)
    else:
        anio_actual = datetime.now(timezone.utc).year
        prefijo = f"OC-{anio_actual}-"
        count = oc_db.exec(
            select(func.count(OrdenCompra.id)).where(OrdenCompra.numero_oc.startswith(prefijo))
        ).one()
        numero_oc = f"{prefijo}{(count + 1):04d}"

    OC_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = OC_DOCS_DIR / f"{numero_oc}.pdf"

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

    _generar_pdf(numero_oc, solicitud, cotizacion, pdf_path, auxiliar_nombre, aprobador_nombre)

    if orden_existente and forzar:
        orden_existente.cotizacion_id = cotizacion.id
        orden_existente.pdf_path = str(pdf_path)
        oc_db.add(orden_existente)
        oc_db.commit()
        oc_db.refresh(orden_existente)
        return orden_existente

    orden = OrdenCompra(
        solicitud_id=solicitud_id,
        cotizacion_id=cotizacion.id,
        numero_oc=numero_oc,
        pdf_path=str(pdf_path),
        email_proveedor=cotizacion.proveedor_email,
        created_at=datetime.now(timezone.utc),
    )
    oc_db.add(orden)
    oc_db.commit()
    oc_db.refresh(orden)
    return orden


@router.get("/solicitudes/{solicitud_id}/orden", response_model=OrdenCompraRead)
def obtener_orden_por_solicitud(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    oc_db: Session = Depends(get_oc_db),
):
    orden = oc_db.exec(
        select(OrdenCompra).where(OrdenCompra.solicitud_id == solicitud_id)
    ).first()
    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe orden de compra para esta solicitud.")
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
    db: Session = Depends(get_db),
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

    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.oc_enviada
    solicitud.fecha_envio_oc = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.oc_enviada,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
    )

    if orden and payload.email_proveedor:
        orden.email_proveedor = payload.email_proveedor
        orden.enviada_proveedor = True
        orden.enviada_coordinador = True
        oc_db.add(orden)

    oc_db.commit()
    oc_db.refresh(solicitud)

    if orden and payload.email_proveedor:
        # El email OC al proveedor ya incluye al solicitante y al auxiliar en CC —
        # no enviar notificación separada para evitar que el solicitante reciba dos correos.
        cotizacion = oc_db.exec(
            select(CotizacionProveedor)
            .where(
                CotizacionProveedor.solicitud_id == solicitud_id,
                CotizacionProveedor.aprobada == True,  # noqa: E712
            )
            .order_by(CotizacionProveedor.created_at.desc())
        ).first()
        auxiliar_email: Optional[str] = None
        if solicitud.auxiliar_id:
            auxiliar = db.get(User, solicitud.auxiliar_id)
            if auxiliar:
                auxiliar_email = auxiliar.email
        background_tasks.add_task(
            email_service.send_oc_a_proveedor,
            solicitud,
            orden.numero_oc,
            orden.pdf_path,
            payload.email_proveedor,
            cotizacion.items if cotizacion else None,
            auxiliar_email,
        )
    else:
        # Si no hay email de proveedor, notificar al solicitante directamente.
        background_tasks.add_task(email_service.send_oc_enviada, solicitud)

    return {"ok": True}


@router.post(
    "/solicitudes/{solicitud_id}/marcar-en-plataforma",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def marcar_en_plataforma(
    solicitud_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    from app.models.oc import EstadoOC
    from app.services import email_service

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado != EstadoOC.oc_enviada:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede marcar en plataforma desde estado 'oc_enviada'. Estado actual: {solicitud.estado}",
        )

    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.oc_en_plataforma
    solicitud.fecha_en_plataforma = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.oc_en_plataforma,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
    )
    oc_db.commit()
    oc_db.refresh(solicitud)

    cotizacion = oc_db.exec(
        select(CotizacionProveedor)
        .where(
            CotizacionProveedor.solicitud_id == solicitud_id,
            CotizacionProveedor.aprobada == True,  # noqa: E712
        )
        .order_by(CotizacionProveedor.created_at.desc())
    ).first()
    background_tasks.add_task(email_service.send_en_plataforma_financiero, solicitud, cotizacion)
    background_tasks.add_task(email_service.send_en_plataforma_solicitante, solicitud)

    return {"ok": True}


@router.post(
    "/solicitudes/{solicitud_id}/marcar-entregada",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
def marcar_entregada(
    solicitud_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    oc_db: Session = Depends(get_oc_db),
):
    from app.models.oc import EstadoOC
    from app.services import email_service

    es_compras = user_has_permission(db, current_user, "mod_oc_ver")

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

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

    now = datetime.now(timezone.utc)
    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.cerrada
    solicitud.fecha_recibido = now
    solicitud.fecha_cerrado = now
    solicitud.updated_at = now
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.cerrada,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
    )
    oc_db.commit()
    oc_db.refresh(solicitud)
    background_tasks.add_task(email_service.send_entrega_confirmada, solicitud)
    return {"ok": True}


# LEGADO: Este endpoint solo existe para cerrar manualmente solicitudes históricas
# que quedaron en estado 'entregada' antes del cambio al flujo automático de cierre.
# En el flujo actual, oc_en_plataforma → cerrada ocurre directamente en marcar_entregada.
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

    estado_anterior = solicitud.estado
    solicitud.estado = EstadoOC.cerrada
    solicitud.fecha_cerrado = datetime.now(timezone.utc)
    solicitud.updated_at = datetime.now(timezone.utc)
    oc_db.add(solicitud)

    registrar_cambio_estado(
        oc_db,
        solicitud.id,
        estado_anterior,
        EstadoOC.cerrada,
        usuario_id=current_user.id,
        usuario_nombre=current_user.full_name,
    )
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden de compra no encontrada.")

    if orden.pdf_path:
        pdf_path = Path(orden.pdf_path)
        if pdf_path.exists():
            return FileResponse(
                path=str(pdf_path),
                media_type="application/pdf",
                filename=f"{orden.numero_oc}.pdf",
            )
        _log.warning("[descarga] pdf_path en DB pero archivo no existe: %s", orden.pdf_path)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No se encontró el archivo PDF de la orden de compra.",
    )
