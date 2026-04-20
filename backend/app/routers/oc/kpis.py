import uuid
from datetime import datetime, timezone
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

_MESES_ES = {
    1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr",
    5: "May", 6: "Jun", 7: "Jul", 8: "Ago",
    9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
}


class MesItem(BaseModel):
    mes: str          # "2026-04"
    label: str        # "Abr 2026"
    solicitudes: int
    valor_aprobado: float


class ConteoItem(BaseModel):
    label: str
    count: int


class SolicitudResumenKPI(BaseModel):
    id: uuid.UUID
    consecutivo_os: str
    descripcion: str
    estado: str
    nivel_prioridad: str
    plataforma: Optional[str]
    fecha_solicitud: datetime


class KPIResponse(BaseModel):
    total_solicitudes: int
    por_estado: list[ConteoItem]
    por_plataforma: list[ConteoItem]
    por_prioridad: list[ConteoItem]
    por_area: list[ConteoItem]
    valor_total_aprobado: float
    valor_total_sin_iva: float
    valor_iva_acumulado: float
    total_ordenes_generadas: int
    top_proveedores: list[ConteoItem]
    tiempo_promedio_cotizacion_dias: float
    solicitudes_recientes: list[SolicitudResumenKPI]
    por_mes: list[MesItem]


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

    # 3. Por plataforma (top 6)
    plataforma_rows = oc_db.exec(
        select(SolicitudOC.plataforma, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.plataforma.is_not(None))
        .group_by(SolicitudOC.plataforma)
        .order_by(func.count(SolicitudOC.id).desc())
        .limit(6)
    ).all()
    por_plataforma = [ConteoItem(label=r[0], count=r[1]) for r in plataforma_rows]

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

    # 6. Valores monetarios aprobados
    valor_total_aprobado = oc_db.exec(
        select(func.sum(CotizacionProveedor.valor_aprobado))
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
    ).one() or 0.0

    # Suma de valor_antes_iva donde existe; si no existe, se usa valor_aprobado (sin IVA desconocido)
    cotizaciones_aprobadas = oc_db.exec(
        select(CotizacionProveedor).where(CotizacionProveedor.aprobada == True)  # noqa: E712
    ).all()
    valor_total_sin_iva = 0.0
    valor_iva_acumulado = 0.0
    for cot in cotizaciones_aprobadas:
        base = cot.valor_antes_iva if cot.valor_antes_iva is not None else (cot.valor_aprobado or 0.0)
        iva = cot.valor_iva if cot.valor_iva is not None else 0.0
        valor_total_sin_iva += base
        valor_iva_acumulado += iva

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

    # 10. Tendencia mensual — últimos 6 meses (calculado en Python)
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    # Generar los 6 puntos (año, mes) en orden cronológico sin dateutil
    _puntos: list[tuple[int, int]] = []
    _y, _m = now_utc.year, now_utc.month
    for _ in range(6):
        _puntos.append((_y, _m))
        _m -= 1
        if _m == 0:
            _m = 12
            _y -= 1
    _puntos.reverse()  # orden cronológico: más antiguo → más reciente

    # Fecha de inicio de la ventana (primer día del mes más antiguo)
    inicio_anio, inicio_mes = _puntos[0]
    inicio_ventana = datetime(inicio_anio, inicio_mes, 1, 0, 0, 0)

    solicitudes_ventana = oc_db.exec(
        select(SolicitudOC).where(SolicitudOC.fecha_solicitud >= inicio_ventana)
    ).all()

    cotizaciones_ventana = oc_db.exec(
        select(CotizacionProveedor).where(
            CotizacionProveedor.aprobada == True  # noqa: E712
        )
    ).all()

    # Indexar cotizaciones aprobadas por solicitud_id → valor_aprobado total
    valor_por_solicitud: dict[uuid.UUID, float] = {}
    for cot in cotizaciones_ventana:
        if cot.solicitud_id is not None:
            valor_por_solicitud[cot.solicitud_id] = (
                valor_por_solicitud.get(cot.solicitud_id, 0.0) + (cot.valor_aprobado or 0.0)
            )

    # Construir diccionario mes_key → {solicitudes, valor_aprobado}
    mes_data: dict[str, dict] = {}
    for s in solicitudes_ventana:
        fecha = s.fecha_solicitud.replace(tzinfo=None) if s.fecha_solicitud.tzinfo else s.fecha_solicitud
        mes_key = fecha.strftime("%Y-%m")
        if mes_key not in mes_data:
            mes_data[mes_key] = {"solicitudes": 0, "valor_aprobado": 0.0}
        mes_data[mes_key]["solicitudes"] += 1
        mes_data[mes_key]["valor_aprobado"] += valor_por_solicitud.get(s.id, 0.0)

    # Rellenar los 6 meses en orden cronológico, incluyendo meses sin datos
    por_mes: list[MesItem] = []
    for anio_p, mes_p in _puntos:
        mes_key = f"{anio_p:04d}-{mes_p:02d}"
        label = f"{_MESES_ES[mes_p]} {anio_p}"
        datos = mes_data.get(mes_key, {"solicitudes": 0, "valor_aprobado": 0.0})
        por_mes.append(
            MesItem(
                mes=mes_key,
                label=label,
                solicitudes=datos["solicitudes"],
                valor_aprobado=round(datos["valor_aprobado"], 2),
            )
        )

    # 11. Solicitudes recientes (últimas 10)
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
            plataforma=s.plataforma,
            fecha_solicitud=s.fecha_solicitud,
        )
        for s in recientes_raw
    ]

    return KPIResponse(
        total_solicitudes=total_solicitudes,
        por_estado=por_estado,
        por_plataforma=por_plataforma,
        por_prioridad=por_prioridad,
        por_area=por_area,
        valor_total_aprobado=float(valor_total_aprobado),
        valor_total_sin_iva=round(valor_total_sin_iva, 2),
        valor_iva_acumulado=round(valor_iva_acumulado, 2),
        total_ordenes_generadas=total_ordenes_generadas,
        top_proveedores=top_proveedores,
        tiempo_promedio_cotizacion_dias=round(tiempo_promedio_cotizacion_dias, 2),
        solicitudes_recientes=solicitudes_recientes,
        por_mes=por_mes,
    )
