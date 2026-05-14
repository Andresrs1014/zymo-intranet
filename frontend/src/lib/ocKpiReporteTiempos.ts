import type { KPIData } from "@/types/oc"
import { formatDuracionDesdeDias } from "@/lib/durationFromDays"

/** Misma forma que `reporte_tiempos` en GET /api/oc/kpis (cuando viene del backend o es sintetizada aquí). */
export type ReporteTiemposOCData = NonNullable<KPIData["reporte_tiempos"]>

const METODOLOGIA_TIEMPOS_LEGIBLE =
  "Cálculo interno como fracción de día (SQLite/agregados); en pantalla y en este informe: minutos y segundos si es " +
  "menor a 1 h; a partir de 1 h en horas y minutos; a partir de 24 h en días y horas. Datos: oc_solicitudes " +
  "(cotización) y oc_historial_estados (reprocesos). Excluye archivadas."

/** Texto del informe con duraciones legibles (alineado al backend). */
export function buildTextoParaInformeTiemposDesdeKpis(kpis: KPIData): string {
  const tiempo_promedio_cotizacion_dias = kpis.tiempo_promedio_cotizacion_dias
  const reprocesos_total = kpis.reprocesos_total
  const tiempo_promedio_reproceso_dias = kpis.tiempo_promedio_reproceso_dias
  const pendientes_aprobacion =
    kpis.por_estado.find((e) => e.label === "pendiente_aprobacion")?.count ?? 0
  const total_solicitudes = kpis.total_solicitudes

  const fr_cot =
    tiempo_promedio_cotizacion_dias > 0
      ? `La demora media del proceso hasta dejar registrada la cotización es de ${formatDuracionDesdeDias(tiempo_promedio_cotizacion_dias)} (desde la solicitud hasta fecha_cotizacion).`
      : "Aún no hay datos suficientes para la demora media hasta cotización (se requiere fecha_cotizacion en solicitudes no archivadas)."

  const fr_rep =
    reprocesos_total > 0
      ? `En calidad del proceso: ${reprocesos_total} evento(s) de reproceso; la demora media para resolver cada devolución es de ${formatDuracionDesdeDias(tiempo_promedio_reproceso_dias)}.`
      : "No hay reprocesos registrados en el historial en este momento."

  const fr_pend = `Cola actual: ${pendientes_aprobacion} solicitud(es) en pendiente de aprobación sobre ${total_solicitudes} solicitudes activas en KPIs.`

  return [fr_cot, fr_rep, fr_pend].join(" ")
}

function buildReporteTiemposDesdeCamposLegacy(kpis: KPIData): ReporteTiemposOCData {
  const tiempo_promedio_cotizacion_dias = kpis.tiempo_promedio_cotizacion_dias
  const reprocesos_total = kpis.reprocesos_total
  const tiempo_promedio_reproceso_dias = kpis.tiempo_promedio_reproceso_dias

  const metricas: ReporteTiemposOCData["metricas"] = [
    {
      clave: "hasta_cotizacion",
      etiqueta: "Tiempo de proceso",
      subtitulo: "Demora media hasta registrar la cotización",
      valor: Math.round(tiempo_promedio_cotizacion_dias * 100) / 100,
      unidad: "días",
      ayuda:
        "Promedio entre la fecha de solicitud y la fecha en que quedó registrada la cotización " +
        "(solo solicitudes con fecha_cotizacion; excluye archivadas). El valor interno está en días; " +
        "en pantalla se muestra en minutos/segundos, horas o días según la magnitud.",
    },
    {
      clave: "resolucion_reproceso",
      etiqueta: "Tiempo de proceso",
      subtitulo: "Demora media para salir de un reproceso",
      valor:
        reprocesos_total > 0 ? Math.round(tiempo_promedio_reproceso_dias * 100) / 100 : 0,
      unidad: "días",
      ayuda:
        "Tras un evento marcado como reproceso en el historial, tiempo promedio hasta la siguiente transición " +
        "que no es reproceso. Solo aplica si hay reprocesos registrados. Misma regla de presentación legible que arriba.",
    },
  ]

  return {
    texto_para_informe: buildTextoParaInformeTiemposDesdeKpis(kpis),
    metricas,
    generado_en_utc: new Date().toISOString(),
    nota_metodologia:
      METODOLOGIA_TIEMPOS_LEGIBLE +
      " Este bloque se generó en el cliente porque la respuesta del API no incluye reporte_tiempos (backend antiguo).",
    sugerencia_agentes:
      "Para detalle por etapa del flujo (horas entre estados, umbrales y alertas), usar GET /api/oc/kpis/tiempos.",
  }
}

/**
 * Usa `reporte_tiempos` del API si existe; si no, reconstruye el mismo contrato con `tiempo_promedio_*` y conteos.
 */
export function resolverReporteTiemposKpis(kpis: KPIData): ReporteTiemposOCData {
  const base = kpis.reporte_tiempos ?? buildReporteTiemposDesdeCamposLegacy(kpis)
  const notaCliente =
    kpis.reporte_tiempos === undefined
      ? " Este bloque se generó en el cliente porque la respuesta del API no incluye reporte_tiempos (backend antiguo)."
      : ""
  return {
    ...base,
    texto_para_informe: buildTextoParaInformeTiemposDesdeKpis(kpis),
    nota_metodologia: METODOLOGIA_TIEMPOS_LEGIBLE + notaCliente,
  }
}