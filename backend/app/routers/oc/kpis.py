import uuid
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.deps import get_current_user, require_compras
from app.models.oc import CotizacionProveedor, EstadoOC, HistorialEstado, OrdenCompra, SolicitudOC
from app.models.user import User
from app.oc_database import get_oc_db

router = APIRouter(prefix="", tags=["OC - KPIs"])


def _scalar_from_exec_one(result: object):
    """`Session.exec(...).one()` puede devolver un escalar o una fila de una columna (según versión SQLModel)."""
    if result is None:
        return None
    try:
        return result[0]  # type: ignore[index]
    except (TypeError, KeyError, IndexError):
        return result


def _format_duracion_desde_dias(dias: float) -> str:
    """Presentación legible: min/s (menos de 1 h), h/min (menos de 24 h), d/h (24 h o más)."""
    if dias is None or not isinstance(dias, (int, float)) or dias <= 0:
        return "0 s"
    total_sec = max(0, round(float(dias) * 86400))
    if total_sec < 3600:
        m, s = divmod(total_sec, 60)
        if m == 0:
            return f"{s} s"
        return f"{m} min {s} s"
    if total_sec < 86400:
        h = total_sec // 3600
        rem = total_sec % 3600
        m = rem // 60
        if m == 0:
            return f"{h} h"
        return f"{h} h {m} min"
    d = total_sec // 86400
    rem = total_sec % 86400
    h = rem // 3600
    if h == 0:
        return f"{d} d"
    return f"{d} d {h} h"


def _kpi_filtros_solicitud(
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    plataforma: Optional[str],
    nivel_prioridad: Optional[str],
) -> list:
    """Condiciones extra sobre `SolicitudOC` (además de `archivada == False`)."""
    conds: list = []
    if fecha_desde is not None:
        conds.append(SolicitudOC.fecha_solicitud >= datetime.combine(fecha_desde, time.min))
    if fecha_hasta is not None:
        conds.append(
            SolicitudOC.fecha_solicitud
            <= datetime.combine(fecha_hasta, time.max)
        )
    pl = (plataforma or "").strip()
    if pl:
        conds.append(SolicitudOC.plataforma == pl)
    pr = (nivel_prioridad or "").strip()
    if pr:
        conds.append(SolicitudOC.nivel_prioridad == pr)
    return conds


def _nota_filtros_kpi(
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    plataforma: Optional[str],
    nivel_prioridad: Optional[str],
) -> str:
    if not (fecha_desde or fecha_hasta or (plataforma or "").strip() or (nivel_prioridad or "").strip()):
        return ""
    partes: list[str] = []
    if fecha_desde:
        partes.append(f"desde {fecha_desde.isoformat()}")
    if fecha_hasta:
        partes.append(f"hasta {fecha_hasta.isoformat()}")
    pl = (plataforma or "").strip()
    if pl:
        partes.append(f"plataforma={pl}")
    pr = (nivel_prioridad or "").strip()
    if pr:
        partes.append(f"prioridad={pr}")
    return " KPI filtrado por fecha de solicitud y/o plataforma/prioridad: " + ", ".join(partes) + "."


def _promedio_dias_correccion_solicitante(
    oc_db: Session,
    filtros_solicitud: list,
) -> tuple[float, int]:
    """
    Por cada entrada a `en_correccion` en el historial, tiempo hasta la siguiente transición.
    Solo ciclos ya cerrados (hay línea siguiente). Respeta filtros sobre la solicitud.
    """
    entradas = oc_db.exec(
        select(HistorialEstado)
        .join(SolicitudOC, HistorialEstado.solicitud_id == SolicitudOC.id)
        .where(HistorialEstado.estado_nuevo == EstadoOC.en_correccion.value)
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*filtros_solicitud)
        .order_by(HistorialEstado.solicitud_id, HistorialEstado.fecha.asc())
    ).all()
    if not entradas:
        return 0.0, 0
    ids = {e.solicitud_id for e in entradas}
    historial_completo = oc_db.exec(
        select(HistorialEstado)
        .where(HistorialEstado.solicitud_id.in_(ids))
        .order_by(HistorialEstado.solicitud_id, HistorialEstado.fecha.asc())
    ).all()
    por_sid: dict[uuid.UUID, list[HistorialEstado]] = {}
    for h in historial_completo:
        por_sid.setdefault(h.solicitud_id, []).append(h)
    tiempos: list[float] = []
    for entrada in entradas:
        chain = por_sid.get(entrada.solicitud_id, [])
        siguiente = next((e for e in chain if e.fecha > entrada.fecha), None)
        if siguiente is None:
            continue
        t0 = entrada.fecha.replace(tzinfo=None) if entrada.fecha.tzinfo else entrada.fecha
        t1 = siguiente.fecha.replace(tzinfo=None) if siguiente.fecha.tzinfo else siguiente.fecha
        tiempos.append((t1 - t0).total_seconds() / 86400)
    if not tiempos:
        return 0.0, 0
    return sum(tiempos) / len(tiempos), len(tiempos)


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


class MetricaTiempoProceso(BaseModel):
    clave: str
    etiqueta: str
    subtitulo: str
    valor: float
    unidad: str
    ayuda: str


class ReporteTiemposOC(BaseModel):
    """Resumen de tiempos de proceso para KPIs e informes (humanos o agentes)."""

    texto_para_informe: str
    metricas: list[MetricaTiempoProceso]
    generado_en_utc: datetime
    nota_metodologia: str
    sugerencia_agentes: str


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
    tiempo_promedio_asignacion_dias: float
    muestras_asignacion: int
    tiempo_promedio_correccion_solicitante_dias: float
    ciclos_correccion_resueltos: int
    tiempo_promedio_cotizacion_dias: float
    solicitudes_recientes: list[SolicitudResumenKPI]
    por_mes: list[MesItem]
    # Indicadores de rechazo y reprocesos
    reprocesos_total: int
    tiempo_promedio_reproceso_dias: float
    correcciones_directivo: int
    rechazos_solicitud: int
    rechazos_cotizacion: int
    reporte_tiempos: ReporteTiemposOC


def _build_reporte_tiempos_oc(
    *,
    tiempo_promedio_asignacion_dias: float,
    muestras_asignacion: int,
    tiempo_promedio_correccion_dias: float,
    ciclos_correccion_resueltos: int,
    tiempo_promedio_cotizacion_dias: float,
    reprocesos_total: int,
    tiempo_promedio_reproceso_dias: float,
    pendientes_aprobacion: int,
    total_solicitudes: int,
    nota_filtros: str = "",
) -> ReporteTiemposOC:
    generado = datetime.now(timezone.utc)
    metricas: list[MetricaTiempoProceso] = [
        MetricaTiempoProceso(
            clave="hasta_asignacion",
            etiqueta="Tiempo de proceso",
            subtitulo="Demora media hasta asignar la solicitud (compras)",
            valor=round(tiempo_promedio_asignacion_dias, 2) if muestras_asignacion > 0 else 0.0,
            unidad="días",
            ayuda=(
                "Promedio entre fecha_solicitud y fecha_asignacion del auxiliar de compras "
                "(solo solicitudes con asignación registrada en el conjunto filtrado)."
            ),
        ),
        MetricaTiempoProceso(
            clave="hasta_cotizacion",
            etiqueta="Tiempo de proceso",
            subtitulo="Demora media hasta registrar la cotización",
            valor=round(tiempo_promedio_cotizacion_dias, 2),
            unidad="días",
            ayuda=(
                "Promedio entre la fecha de solicitud y la fecha en que quedó registrada la cotización "
                "(solo solicitudes con fecha_cotizacion; excluye archivadas). El valor numérico interno está en días; "
                "en pantalla se muestra en minutos/segundos, horas o días según la magnitud."
            ),
        ),
        MetricaTiempoProceso(
            clave="resolucion_correccion",
            etiqueta="Tiempo de proceso",
            subtitulo="Demora media en corrección del solicitante",
            valor=round(tiempo_promedio_correccion_dias, 2) if ciclos_correccion_resueltos > 0 else 0.0,
            unidad="días",
            ayuda=(
                "Desde la transición a en_correccion en el historial hasta la siguiente movida del flujo "
                "(p. ej. vuelta a cotización). Solo ciclos ya cerrados."
            ),
        ),
        MetricaTiempoProceso(
            clave="resolucion_reproceso",
            etiqueta="Tiempo de proceso",
            subtitulo="Demora media para salir de un reproceso",
            valor=round(tiempo_promedio_reproceso_dias, 2) if reprocesos_total > 0 else 0.0,
            unidad="días",
            ayuda=(
                "Tras un evento marcado como reproceso en el historial, tiempo promedio hasta la siguiente transición "
                "que no es reproceso. Solo aplica si hay reprocesos registrados. Presentación en unidades legibles "
                "(min/s, h/min o d/h) a partir del valor en días."
            ),
        ),
    ]

    if muestras_asignacion > 0 and tiempo_promedio_asignacion_dias > 0:
        human_a = _format_duracion_desde_dias(tiempo_promedio_asignacion_dias)
        fr_asig = (
            f"La demora media hasta que compras asigna un auxiliar es de {human_a} "
            f"(fecha_solicitud → fecha_asignacion), sobre {muestras_asignacion} solicitud(es) con asignación."
        )
    elif muestras_asignacion > 0:
        fr_asig = (
            f"Hay {muestras_asignacion} solicitud(es) con asignación en el filtro; el promedio de demora es menor a un segundo registrable."
        )
    else:
        fr_asig = "No hay solicitudes con fecha_asignacion en el conjunto filtrado."

    if ciclos_correccion_resueltos > 0 and tiempo_promedio_correccion_dias > 0:
        human_corr = _format_duracion_desde_dias(tiempo_promedio_correccion_dias)
        fr_corr = (
            f"En devoluciones a corrección del solicitante, la demora media hasta la siguiente movida en el flujo "
            f"es de {human_corr} ({ciclos_correccion_resueltos} ciclo(s) cerrado(s))."
        )
    elif ciclos_correccion_resueltos > 0:
        fr_corr = (
            f"Hay {ciclos_correccion_resueltos} ciclo(s) de corrección cerrado(s); el promedio es menor a un segundo registrable."
        )
    else:
        fr_corr = (
            "No hay ciclos completos de corrección (salida de en_correccion con transición siguiente) en el conjunto filtrado."
        )

    if tiempo_promedio_cotizacion_dias > 0:
        human_cot = _format_duracion_desde_dias(tiempo_promedio_cotizacion_dias)
        fr_cot = (
            f"La demora media del proceso hasta dejar registrada la cotización es de "
            f"{human_cot} (desde la solicitud hasta fecha_cotizacion)."
        )
    else:
        fr_cot = (
            "Aún no hay datos suficientes para la demora media hasta cotización "
            "(se requiere fecha_cotizacion en solicitudes no archivadas)."
        )

    if reprocesos_total > 0:
        human_rep = _format_duracion_desde_dias(tiempo_promedio_reproceso_dias)
        fr_rep = (
            f"En calidad del proceso: {reprocesos_total} evento(s) de reproceso; "
            f"la demora media para resolver cada devolución es de {human_rep}."
        )
    else:
        fr_rep = "No hay reprocesos registrados en el historial en este momento."

    fr_pend = (
        f"Cola actual: {pendientes_aprobacion} solicitud(es) en pendiente de aprobación "
        f"sobre {total_solicitudes} solicitudes activas en KPIs."
    )
    texto = " ".join([fr_asig, fr_corr, fr_cot, fr_rep, fr_pend])

    metodologia = (
        "Cálculo interno como fracción de día (SQLite/agregados); la vista y el informe muestran minutos y segundos "
        "si es menor a 1 h; a partir de 1 h en horas y minutos; a partir de 24 h en días y horas. "
        "Datos: oc_solicitudes (asignación, cotización), oc_historial_estados (corrección al solicitante, reprocesos). "
        "Excluye archivadas."
        + nota_filtros
    )
    sugerencia = (
        "Para detalle por etapa del flujo (horas entre estados, umbrales y alertas), usar GET /api/oc/kpis/tiempos."
    )

    return ReporteTiemposOC(
        texto_para_informe=texto,
        metricas=metricas,
        generado_en_utc=generado,
        nota_metodologia=metodologia,
        sugerencia_agentes=sugerencia,
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/kpis", response_model=KPIResponse)
def get_kpis(
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
    fecha_desde: Optional[date] = Query(
        None,
        description="Solo solicitudes con fecha_solicitud ≥ inicio de este día.",
    ),
    fecha_hasta: Optional[date] = Query(
        None,
        description="Solo solicitudes con fecha_solicitud ≤ fin de este día.",
    ),
    plataforma: Optional[str] = Query(None, description="Filtrar por plataforma (coincidencia exacta)."),
    nivel_prioridad: Optional[str] = Query(
        None,
        description="Filtrar por prioridad (coincidencia exacta, p. ej. Alta).",
    ),
):
    fx = _kpi_filtros_solicitud(fecha_desde, fecha_hasta, plataforma, nivel_prioridad)
    nota_fx = _nota_filtros_kpi(fecha_desde, fecha_hasta, plataforma, nivel_prioridad)
    # 1. Conteo por estado — excluye solicitudes archivadas
    estado_rows = oc_db.exec(
        select(SolicitudOC.estado, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
        .group_by(SolicitudOC.estado)
    ).all()
    conteo_por_estado: dict[str, int] = {r[0]: r[1] for r in estado_rows}
    por_estado: list[ConteoItem] = [
        ConteoItem(label=estado.value, count=conteo_por_estado.get(estado.value, 0))
        for estado in EstadoOC
    ]
    total_solicitudes = sum(conteo_por_estado.values())

    # 3. Por plataforma (top 6)
    plataforma_rows = oc_db.exec(
        select(SolicitudOC.plataforma, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
        .where(SolicitudOC.plataforma.is_not(None))
        .group_by(SolicitudOC.plataforma)
        .order_by(func.count(SolicitudOC.id).desc())
        .limit(6)
    ).all()
    por_plataforma = [ConteoItem(label=r[0], count=r[1]) for r in plataforma_rows]

    # 4. Por prioridad
    prioridad_rows = oc_db.exec(
        select(SolicitudOC.nivel_prioridad, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
        .group_by(SolicitudOC.nivel_prioridad)
        .order_by(func.count(SolicitudOC.id).desc())
    ).all()
    por_prioridad = [ConteoItem(label=r[0], count=r[1]) for r in prioridad_rows]

    # 5. Por área solicitante (top 5)
    area_rows = oc_db.exec(
        select(SolicitudOC.area_solicitante, func.count(SolicitudOC.id).label("cnt"))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
        .where(SolicitudOC.area_solicitante.is_not(None))
        .group_by(SolicitudOC.area_solicitante)
        .order_by(func.count(SolicitudOC.id).desc())
        .limit(5)
    ).all()
    por_area = [ConteoItem(label=r[0], count=r[1]) for r in area_rows]

    # 6. Valores monetarios aprobados (excluye solicitudes archivadas)
    valor_total_aprobado = oc_db.exec(
        select(func.sum(CotizacionProveedor.valor_aprobado))
        .join(SolicitudOC, CotizacionProveedor.solicitud_id == SolicitudOC.id)
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).one() or 0.0

    cotizaciones_aprobadas = oc_db.exec(
        select(CotizacionProveedor)
        .join(SolicitudOC, CotizacionProveedor.solicitud_id == SolicitudOC.id)
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).all()
    valor_total_sin_iva = 0.0
    valor_iva_acumulado = 0.0
    for cot in cotizaciones_aprobadas:
        base = cot.valor_antes_iva if cot.valor_antes_iva is not None else (cot.valor_aprobado or 0.0)
        iva = cot.valor_iva if cot.valor_iva is not None else 0.0
        valor_total_sin_iva += base
        valor_iva_acumulado += iva

    # 7. Número de OCs generadas (excluye solicitudes archivadas)
    total_ordenes_generadas = oc_db.exec(
        select(func.count(OrdenCompra.id))
        .join(SolicitudOC, OrdenCompra.solicitud_id == SolicitudOC.id)
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).one()

    # 8. Top proveedores aprobados — top 5, excluye solicitudes archivadas
    proveedor_rows = oc_db.exec(
        select(CotizacionProveedor.proveedor_nombre, func.count(CotizacionProveedor.id).label("cnt"))
        .join(SolicitudOC, CotizacionProveedor.solicitud_id == SolicitudOC.id)
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
        .group_by(CotizacionProveedor.proveedor_nombre)
        .order_by(func.count(CotizacionProveedor.id).desc())
        .limit(5)
    ).all()
    top_proveedores = [ConteoItem(label=r[0], count=r[1]) for r in proveedor_rows]

    # 9. Tiempos en días (SQLite julianday vía SQLAlchemy)
    _jd_asig = func.julianday(SolicitudOC.fecha_asignacion) - func.julianday(SolicitudOC.fecha_solicitud)
    _asig_row = oc_db.exec(
        select(func.avg(_jd_asig))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(SolicitudOC.fecha_asignacion.isnot(None))
        .where(*fx)
    ).one()
    _asig_val = _scalar_from_exec_one(_asig_row)
    tiempo_promedio_asignacion_dias = float(_asig_val) if _asig_val is not None else 0.0

    _m_asig = oc_db.exec(
        select(func.count(SolicitudOC.id))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(SolicitudOC.fecha_asignacion.isnot(None))
        .where(*fx)
    ).one()
    _m_asig_val = _scalar_from_exec_one(_m_asig)
    muestras_asignacion = int(_m_asig_val) if _m_asig_val is not None else 0

    _jd_cot = func.julianday(SolicitudOC.fecha_cotizacion) - func.julianday(SolicitudOC.fecha_solicitud)
    _cot_row = oc_db.exec(
        select(func.avg(_jd_cot))
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(SolicitudOC.fecha_cotizacion.isnot(None))
        .where(*fx)
    ).one()
    _cot_val = _scalar_from_exec_one(_cot_row)
    tiempo_promedio_cotizacion_dias = float(_cot_val) if _cot_val is not None else 0.0

    tiempo_promedio_correccion_solicitante_dias, ciclos_correccion_resueltos = _promedio_dias_correccion_solicitante(
        oc_db, fx
    )

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
        select(SolicitudOC)
        .where(SolicitudOC.fecha_solicitud >= inicio_ventana)
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).all()

    cotizaciones_ventana = oc_db.exec(
        select(CotizacionProveedor)
        .join(SolicitudOC, CotizacionProveedor.solicitud_id == SolicitudOC.id)
        .where(CotizacionProveedor.aprobada == True)  # noqa: E712
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
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

    # 11. Solicitudes recientes (últimas 10, excluye archivadas)
    recientes_raw = oc_db.exec(
        select(SolicitudOC)
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
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

    # 12. Indicadores de rechazo y reprocesos (excluye solicitudes archivadas)
    correcciones_directivo_raw = oc_db.exec(
        select(func.count(HistorialEstado.id))
        .join(SolicitudOC, HistorialEstado.solicitud_id == SolicitudOC.id)
        .where(HistorialEstado.tipo_accion == "correccion_directivo")
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).one()
    correcciones_directivo = correcciones_directivo_raw or 0

    reprocesos_entradas = oc_db.exec(
        select(HistorialEstado)
        .join(SolicitudOC, HistorialEstado.solicitud_id == SolicitudOC.id)
        .where(HistorialEstado.es_reproceso == True)  # noqa: E712
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).all()
    reprocesos_total = len(reprocesos_entradas)

    # Tiempo promedio de reproceso — precargar historial en dict para evitar N queries
    tiempo_promedio_reproceso_dias = 0.0
    if reprocesos_entradas:
        # 1 query para traer todo el historial de las solicitudes con reprocesos
        solicitud_ids_reproceso = {e.solicitud_id for e in reprocesos_entradas}
        historial_completo = oc_db.exec(
            select(HistorialEstado)
            .where(HistorialEstado.solicitud_id.in_(solicitud_ids_reproceso))
            .order_by(HistorialEstado.solicitud_id, HistorialEstado.fecha.asc())
        ).all()

        # Indexar en dict por solicitud_id — O(n) una sola vez
        historial_por_solicitud: dict[str, list[HistorialEstado]] = {}
        for h in historial_completo:
            key = str(h.solicitud_id)
            historial_por_solicitud.setdefault(key, []).append(h)

        # Buscar siguiente entrada en memoria — sin roundtrips adicionales a BD
        tiempos_reproceso: list[float] = []
        for entrada in reprocesos_entradas:
            entradas_solicitud = historial_por_solicitud.get(str(entrada.solicitud_id), [])
            siguiente = next(
                (e for e in entradas_solicitud
                 if e.fecha > entrada.fecha and not e.es_reproceso),
                None,
            )
            if siguiente:
                fecha_inicio = entrada.fecha.replace(tzinfo=None) if entrada.fecha.tzinfo else entrada.fecha
                fecha_fin = siguiente.fecha.replace(tzinfo=None) if siguiente.fecha.tzinfo else siguiente.fecha
                dias = (fecha_fin - fecha_inicio).total_seconds() / 86400
                tiempos_reproceso.append(dias)
        if tiempos_reproceso:
            tiempo_promedio_reproceso_dias = sum(tiempos_reproceso) / len(tiempos_reproceso)

    rechazos_solicitud = oc_db.exec(
        select(func.count(HistorialEstado.id))
        .join(SolicitudOC, HistorialEstado.solicitud_id == SolicitudOC.id)
        .where(HistorialEstado.tipo_accion == "cancelacion_solicitud")
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).one()

    rechazos_cotizacion = oc_db.exec(
        select(func.count(HistorialEstado.id))
        .join(SolicitudOC, HistorialEstado.solicitud_id == SolicitudOC.id)
        .where(HistorialEstado.tipo_accion == "cancelacion_cotizacion")
        .where(SolicitudOC.archivada == False)  # noqa: E712
        .where(*fx)
    ).one()

    pendientes_aprobacion = conteo_por_estado.get("pendiente_aprobacion", 0)
    reporte_tiempos = _build_reporte_tiempos_oc(
        tiempo_promedio_asignacion_dias=round(tiempo_promedio_asignacion_dias, 2),
        muestras_asignacion=muestras_asignacion,
        tiempo_promedio_correccion_dias=round(tiempo_promedio_correccion_solicitante_dias, 2),
        ciclos_correccion_resueltos=ciclos_correccion_resueltos,
        tiempo_promedio_cotizacion_dias=round(tiempo_promedio_cotizacion_dias, 2),
        reprocesos_total=reprocesos_total,
        tiempo_promedio_reproceso_dias=round(tiempo_promedio_reproceso_dias, 2),
        pendientes_aprobacion=pendientes_aprobacion,
        total_solicitudes=total_solicitudes,
        nota_filtros=nota_fx,
    )

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
        tiempo_promedio_asignacion_dias=round(tiempo_promedio_asignacion_dias, 2),
        muestras_asignacion=muestras_asignacion,
        tiempo_promedio_correccion_solicitante_dias=round(tiempo_promedio_correccion_solicitante_dias, 2),
        ciclos_correccion_resueltos=ciclos_correccion_resueltos,
        tiempo_promedio_cotizacion_dias=round(tiempo_promedio_cotizacion_dias, 2),
        solicitudes_recientes=solicitudes_recientes,
        por_mes=por_mes,
        reprocesos_total=reprocesos_total,
        tiempo_promedio_reproceso_dias=round(tiempo_promedio_reproceso_dias, 2),
        correcciones_directivo=int(correcciones_directivo),
        rechazos_solicitud=rechazos_solicitud or 0,
        rechazos_cotizacion=rechazos_cotizacion or 0,
        reporte_tiempos=reporte_tiempos,
    )


@router.get("/kpis/tiempos")
def get_kpis_tiempos(
    current_user: User = Depends(require_compras),
):
    """
    Tiempos de proceso por transición de estado (últimas solicitudes, horas).
    Umbrales y alertas para seguimiento operativo. Complementa `GET /api/oc/kpis`
    Complementa `GET /api/oc/kpis` (campo `reporte_tiempos.texto_para_informe`; las métricas llevan
    `valor` en días y texto legible min/s · h/min · d/h en UI e informe).
    """
    from app.agents.tools.oc_tools import ver_tiempos_proceso_oc
    return ver_tiempos_proceso_oc(limite_solicitudes=100)
