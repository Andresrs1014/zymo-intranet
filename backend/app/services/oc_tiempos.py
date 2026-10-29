"""
KPIs y tiempos por etapa del módulo de compras (OC).
"""
import uuid
from datetime import datetime, timezone

from sqlmodel import Session, func, select

from app.models.oc import (
    CotizacionProveedor,
    EstadoOC,
    HistorialEstado,
    SolicitudOC,
)
from app.oc_database import get_oc_engine

# Tiempo máximo esperado por etapa (en horas) — para detectar alertas
_TIEMPO_LIMITE_HORAS: dict[str, float] = {
    "nueva → en_cotizacion": 4,
    "en_cotizacion → pendiente_aprobacion": 48,
    "pendiente_aprobacion → aprobada": 24,
    "aprobada → oc_enviada": 8,
    "oc_enviada → oc_en_plataforma": 24,
    "oc_en_plataforma → cerrada": 168,   # 7 días — el solicitante confirma y cierra
}


def _session():
    return Session(get_oc_engine())


def ver_kpis_oc() -> dict:
    """
    Resumen ejecutivo del estado actual del módulo OC.
    Útil para la ventana de bienvenida y para que el agente tenga contexto general.
    """
    with _session() as db:
        conteos = {}
        for estado in EstadoOC:
            count = db.exec(
                select(func.count(SolicitudOC.id)).where(SolicitudOC.estado == estado.value)
            ).one()
            conteos[estado.value] = count

        pendientes_aprobacion = db.exec(
            select(func.count(CotizacionProveedor.id))
            .where(CotizacionProveedor.aprobada.is_(None))
        ).one()

        valor_aprobado = db.exec(
            select(func.sum(CotizacionProveedor.valor_aprobado))
            .where(CotizacionProveedor.aprobada == True)  # noqa: E712
        ).one() or 0.0

    return {
        "solicitudes_por_estado": conteos,
        "total_activas": sum(
            conteos.get(e, 0)
            for e in ["nueva", "en_cotizacion", "pendiente_aprobacion", "aprobada", "oc_enviada", "oc_en_plataforma"]
        ),
        "cotizaciones_pendientes_aprobacion": pendientes_aprobacion,
        "valor_total_aprobado_mes": float(valor_aprobado),
        "alertas": _generar_alertas(conteos, pendientes_aprobacion),
    }


def _generar_alertas(conteos: dict, pendientes_aprobacion: int) -> list[str]:
    alertas = []
    if conteos.get("nueva", 0) > 5:
        alertas.append(f"{conteos['nueva']} solicitudes nuevas sin asignar")
    if pendientes_aprobacion > 0:
        alertas.append(f"{pendientes_aprobacion} cotizaciones esperando aprobación")
    if conteos.get("pendiente_aprobacion", 0) > 3:
        alertas.append(f"{conteos['pendiente_aprobacion']} solicitudes en pendiente_aprobacion")
    return alertas


# ── Tiempos de proceso ─────────────────────────────────────────────────────────

def ver_tiempos_proceso_oc(limite_solicitudes: int = 50) -> dict:
    """
    Calcula el tiempo promedio que tarda cada transición de estado.
    Usa HistorialEstado que ya existe — sin nueva tabla.
    Solo analiza las últimas N solicitudes para no ser costoso.
    """
    with _session() as db:
        # Solicitudes recientes con historial
        solicitudes_recientes = db.exec(
            select(SolicitudOC)
            .order_by(SolicitudOC.updated_at.desc())
            .limit(limite_solicitudes)
        ).all()

        solicitud_ids = [s.id for s in solicitudes_recientes]
        if not solicitud_ids:
            return {"promedios_horas": {}, "solicitudes_analizadas": 0, "alertas_tiempo": []}

        historiales = db.exec(
            select(HistorialEstado)
            .where(HistorialEstado.solicitud_id.in_(solicitud_ids))
            .order_by(HistorialEstado.fecha.asc())
        ).all()

    # Agrupar por solicitud
    por_solicitud: dict[uuid.UUID, list[HistorialEstado]] = {}
    for h in historiales:
        por_solicitud.setdefault(h.solicitud_id, []).append(h)

    # Calcular tiempos por transición
    tiempos_por_etapa: dict[str, list[float]] = {}
    for sid, entradas in por_solicitud.items():
        for i in range(len(entradas) - 1):
            desde = entradas[i]
            hasta = entradas[i + 1]
            etapa = f"{desde.estado_nuevo} → {hasta.estado_nuevo}"

            t_desde = desde.fecha if desde.fecha.tzinfo else desde.fecha.replace(tzinfo=timezone.utc)
            t_hasta = hasta.fecha if hasta.fecha.tzinfo else hasta.fecha.replace(tzinfo=timezone.utc)
            horas = (t_hasta - t_desde).total_seconds() / 3600

            tiempos_por_etapa.setdefault(etapa, []).append(horas)

    promedios = {
        etapa: round(sum(vals) / len(vals), 1)
        for etapa, vals in tiempos_por_etapa.items()
        if vals
    }

    # Detectar etapas que superan el límite esperado
    alertas_tiempo = []
    for etapa, promedio in promedios.items():
        limite = _TIEMPO_LIMITE_HORAS.get(etapa)
        if limite and promedio > limite:
            alertas_tiempo.append(
                f"Etapa '{etapa}': promedio {promedio}h (límite esperado {limite}h)"
            )

    return {
        "promedios_horas": promedios,
        "solicitudes_analizadas": len(por_solicitud),
        "alertas_tiempo": alertas_tiempo,
        "limites_esperados_horas": _TIEMPO_LIMITE_HORAS,
    }


def ver_timeline_solicitud(solicitud_id: str) -> dict:
    """
    Timeline completo de estados de una solicitud específica.
    Incluye duración en cada estado.
    """
    try:
        sid = uuid.UUID(solicitud_id)
    except ValueError:
        return {"error": f"ID inválido: {solicitud_id}"}

    with _session() as db:
        solicitud = db.get(SolicitudOC, sid)
        if not solicitud:
            return {"error": f"Solicitud {solicitud_id} no encontrada"}

        historial = db.exec(
            select(HistorialEstado)
            .where(HistorialEstado.solicitud_id == sid)
            .order_by(HistorialEstado.fecha.asc())
        ).all()

    ahora = datetime.now(timezone.utc)
    timeline = []
    for i, entrada in enumerate(historial):
        t_inicio = entrada.fecha if entrada.fecha.tzinfo else entrada.fecha.replace(tzinfo=timezone.utc)

        if i + 1 < len(historial):
            t_fin = historial[i + 1].fecha
            if t_fin.tzinfo is None:
                t_fin = t_fin.replace(tzinfo=timezone.utc)
            duracion_horas = (t_fin - t_inicio).total_seconds() / 3600
        else:
            # Estado actual — calcular tiempo transcurrido
            duracion_horas = (ahora - t_inicio).total_seconds() / 3600

        etapa = f"{entrada.estado_anterior} → {entrada.estado_nuevo}" if entrada.estado_anterior else f"inicio → {entrada.estado_nuevo}"
        limite = _TIEMPO_LIMITE_HORAS.get(etapa)

        timeline.append({
            "etapa": etapa,
            "estado_nuevo": entrada.estado_nuevo,
            "fecha": entrada.fecha.isoformat(),
            "duracion_horas": round(duracion_horas, 1),
            "usuario": entrada.usuario_nombre,
            "supera_limite": bool(limite and duracion_horas > limite),
        })

    total_horas = sum(e["duracion_horas"] for e in timeline)

    return {
        "solicitud_id": solicitud_id,
        "consecutivo_os": solicitud.consecutivo_os,
        "descripcion": solicitud.descripcion,
        "estado_actual": solicitud.estado,
        "timeline": timeline,
        "total_horas_proceso": round(total_horas, 1),
    }
