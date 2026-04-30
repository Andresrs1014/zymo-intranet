"""Reglas de negocio para anticipo/proforma en el flujo OC (compras)."""

from __future__ import annotations

import uuid

from sqlmodel import Session, func, select

from app.core.permissions import user_has_permission
from app.models.oc import CotizacionProveedor, EstadoOC, SolicitudOC
from app.models.user import User

# Tras enviar la OC al proveedor o cerrar/cancelar: no se gestiona ni descarga proforma desde rutas OC;
# el módulo Financiero expone GET /facturas/{id}/proforma.
PROFORMA_OC_READONLY_ESTADOS: frozenset[str] = frozenset(
    {
        EstadoOC.oc_enviada.value,
        EstadoOC.oc_en_plataforma.value,
        EstadoOC.entregada.value,
        EstadoOC.cerrada.value,
        EstadoOC.cancelada.value,
    }
)

DETALLE_PROFORMA_NO_GESTIONABLE = (
    "La proforma solo puede gestionarse después de cargar al menos una cotización "
    "y antes de enviar la OC al proveedor. Para verla en etapas posteriores, use el módulo Financiero."
)

DETALLE_PROFORMA_DESCARGA_OC_CERRADA = (
    "La descarga de proforma desde OC no está disponible en esta etapa. "
    "Use el módulo Financiero."
)


def cotizaciones_count(oc_db: Session, solicitud_id: uuid.UUID) -> int:
    return oc_db.exec(
        select(func.count(CotizacionProveedor.id)).where(
            CotizacionProveedor.solicitud_id == solicitud_id
        )
    ).one()


def proforma_es_gestionable_desde_oc(oc_db: Session, solicitud: SolicitudOC) -> bool:
    if solicitud.estado in PROFORMA_OC_READONLY_ESTADOS:
        return False
    return cotizaciones_count(oc_db, solicitud.id) > 0


def usuario_puede_ver_solicitud_oc(db: Session, user: User, solicitud: SolicitudOC) -> bool:
    """Misma política que GET /api/oc/solicitudes/{id}."""
    is_compras = user_has_permission(db, user, "mod_oc_ver")
    is_solicitante = user.email == solicitud.solicitante_email
    return is_compras or is_solicitante
