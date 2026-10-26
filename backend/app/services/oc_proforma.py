"""Reglas de negocio para anticipo/proforma en el flujo OC (compras)."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
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

# Mientras está en cotización (aún sin la primera cargada): el auxiliar puede
# marcar anticipo/proforma y subir archivo desde «Cargar cotización», antes del envío.
PROFORMA_SIN_COTIZACION_ESTADOS: frozenset[str] = frozenset({EstadoOC.en_cotizacion.value})

DETALLE_PROFORMA_NO_GESTIONABLE = (
    "La proforma solo puede gestionarse mientras está en cotización (incluye la primera carga desde "
    "«Cargar cotización») y antes de enviar la OC al proveedor. En etapas posteriores, "
    "use el módulo Financiero."
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
    if cotizaciones_count(oc_db, solicitud.id) > 0:
        return True
    return solicitud.estado in PROFORMA_SIN_COTIZACION_ESTADOS


def usuario_puede_ver_solicitud_oc(db: Session, user: User, solicitud: SolicitudOC) -> bool:
    """Misma política que GET /api/oc/solicitudes/{id}."""
    is_compras = user_has_permission(db, user, "mod_oc_ver")
    is_solicitante = user.email == solicitud.solicitante_email
    return is_compras or is_solicitante


_ESTADOS_ADJUNTOS_CERRADOS: frozenset[str] = frozenset(
    {EstadoOC.cerrada.value, EstadoOC.cancelada.value}
)


def obtener_solicitud_con_acceso(
    solicitud_id: uuid.UUID, user: User, db: Session, oc_db: Session, *, modifica: bool = False
) -> SolicitudOC:
    """Solicitud si existe y el usuario puede verla (solicitante, compras o admin).
    Con modifica=True además exige que no esté cerrada ni cancelada."""
    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if not usuario_puede_ver_solicitud_oc(db, user, solicitud):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a esta solicitud.")
    if modifica and solicitud.estado in _ESTADOS_ADJUNTOS_CERRADOS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La solicitud está cerrada o cancelada; no se pueden modificar sus archivos.",
        )
    return solicitud
