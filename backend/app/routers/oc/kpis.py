import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_compras
from app.models.oc import CotizacionProveedor, EstadoOC, OrdenCompra, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(prefix="", tags=["OC - KPIs"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ConteoItem(BaseModel):
    label: str
    count: int


class SolicitudResumenKPI(BaseModel):
    id: uuid.UUID
    consecutivo_os: str
    descripcion: str
    estado: str
    nivel_prioridad: str
    sede: Optional[str]
    fecha_solicitud: datetime


class KPIResponse(BaseModel):
    total_solicitudes: int
    por_estado: list[ConteoItem]
    por_sede: list[ConteoItem]
    por_prioridad: list[ConteoItem]
    por_area: list[ConteoItem]
    valor_total_aprobado: float
    total_ordenes_generadas: int
    top_proveedores: list[ConteoItem]
    tiempo_promedio_cotizacion_dias: float
    solicitudes_recientes: list[SolicitudResumenKPI]


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/kpis", response_model=KPIResponse)
def get_kpis(
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    # 1. Conteo por estado
    por_estado: list[ConteoItem] = []
    total_solicitudes = 0
    for estado in EstadoOC:
        count = oc_db.exec(
            select(func.count(SolicitudOC.id)).where(SolicitudOC.estado == estado.value)
        ).one()
        por_estado.append(ConteoItem(label=estado.value, count=count))
        total_solicitudes += count

    # 3. Por sede (top 6)
    sede_rows = oc_db.exec(
        select(SolicitudOC.sede, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.sede.is_not(None))
        .group_by(SolicitudOC.sede)
        .order_by(func.count(SolicitudOC.id).desc())
        .limit(6)
    ).all()
    por_sede = [ConteoItem(label=r[0], count=r[1]) for r in sede_rows]

    # 4. Por prioridad
    prioridad_rows = oc_db.exec(
        select(SolicitudOC.nivel_prioridad, func.count(SolicitudOC.id).label("cnt"))
        .group_by(SolicitudOC.nivel_prioridad)
        .order_by(func.count(SolicitudOC.id).desc())
    ).all()
    por_prioridad = [ConteoItem(label=r[0], count=r[1]) for r in prioridad_rows]

    # 5. Por área solicitante (top 5)
    area_rows = oc_db.exec(
        select(SolicitudOC.area_solicitante, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.area_solicitante.is_not(None))
        .group_by(SolicitudOC.area_solicitante)
        .order_by(func.count(SolicitudOC.id).desc())
        .limit(5)
    ).all()
    por_area = [ConteoItem(label=r[0], count=r[1]) for r in area_rows]

    # 6. Valor total aprobado
    valor_total_aprobado = oc_db.exec(
        select(func.sum(CotizacionProveedor.valor_aprobado))
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
    ).one() or 0.0

    # 7. Número de OCs generadas
    total_ordenes_generadas = oc_db.exec(
        select(func.count(OrdenCompra.id))
    ).one()

    # 8. Top proveedores aprobados (top 5)
    proveedor_rows = oc_db.exec(
        select(CotizacionProveedor.proveedor_nombre, func.count(CotizacionProveedor.id).label("cnt"))
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
        .group_by(CotizacionProveedor.proveedor_nombre)
        .order_by(func.count(CotizacionProveedor.id).desc())
        .limit(5)
    ).all()
    top_proveedores = [ConteoItem(label=r[0], count=r[1]) for r in proveedor_rows]

    # 9. Tiempo promedio de cotización en días (calculado en Python)
    solicitudes_con_cotizacion = oc_db.exec(
        select(SolicitudOC).where(SolicitudOC.fecha_cotizacion.is_not(None))
    ).all()

    tiempo_promedio_cotizacion_dias = 0.0
    if solicitudes_con_cotizacion:
        deltas = []
        for s in solicitudes_con_cotizacion:
            fecha_cot = s.fecha_cotizacion.replace(tzinfo=None) if s.fecha_cotizacion.tzinfo else s.fecha_cotizacion
            fecha_sol = s.fecha_solicitud.replace(tzinfo=None) if s.fecha_solicitud.tzinfo else s.fecha_solicitud
            delta_days = (fecha_cot - fecha_sol).total_seconds() / 86400
            deltas.append(delta_days)
        tiempo_promedio_cotizacion_dias = sum(deltas) / len(deltas)

    # 10. Solicitudes recientes (últimas 10)
    recientes_raw = oc_db.exec(
        select(SolicitudOC)
        .order_by(SolicitudOC.fecha_solicitud.desc())
        .limit(10)
    ).all()
    solicitudes_recientes = [
        SolicitudResumenKPI(
            id=s.id,
            consecutivo_os=s.consecutivo_os,
            descripcion=s.descripcion,
            estado=s.estado,
            nivel_prioridad=s.nivel_prioridad,
            sede=s.sede,
            fecha_solicitud=s.fecha_solicitud,
        )
        for s in recientes_raw
    ]

    return KPIResponse(
        total_solicitudes=total_solicitudes,
        por_estado=por_estado,
        por_sede=por_sede,
        por_prioridad=por_prioridad,
        por_area=por_area,
        valor_total_aprobado=float(valor_total_aprobado),
        total_ordenes_generadas=total_ordenes_generadas,
        top_proveedores=top_proveedores,
        tiempo_promedio_cotizacion_dias=round(tiempo_promedio_cotizacion_dias, 2),
        solicitudes_recientes=solicitudes_recientes,
    )
