import type { ZymoClientSurvey, ZymoExperienceSurvey, ZymoVisitReport } from "@prisma/client"
import { average, currentDateValue } from "../utils/formatters"

// Ported from ZymoAlly app.js npsScore()/npsScoreFor() (líneas 269-281)
export function npsScoreFor(items: { nps: number }[]): number {
  if (!items.length) return 0
  const promoters = items.filter((item) => Number(item.nps || 0) >= 9).length
  const detractors = items.filter((item) => Number(item.nps || 0) <= 6).length
  return Math.round(((promoters - detractors) / items.length) * 100)
}

// Ported from alerts() — subset de encuestas/visitas (app.js líneas 332-373)
export function sacAlerts(surveys: ZymoClientSurvey[], experienceSurveys: ZymoExperienceSurvey[], visits: ZymoVisitReport[]) {
  const today = new Date(`${currentDateValue()}T12:00:00`)

  const surveyAlerts = surveys
    .filter((item) => Number(item.satisfaction || 0) <= 3 || Number(item.nps || 0) <= 6)
    .map((item) => ({
      title: `Riesgo de satisfaccion - ${item.company || "Cliente"}`,
      priority: "Alta",
      detail: `Satisfaccion ${item.satisfaction}/5 y NPS ${item.nps}/10. Requiere plan de accion y contacto de cierre.`,
      target: item.email || item.role || "Responsable CX",
      source: "Fidelización de clientes",
      sourceGroup: "survey" as const,
    }))

  const experienceAlerts = experienceSurveys
    .filter((item) => Number(item.futureValue || 0) <= 3 || Number(item.professionalSatisfaction || 0) <= 3 || /No fueron|No se adaptan|Requieren/i.test(`${item.fit} ${item.clarity}`))
    .map((item) => ({
      title: `Oportunidad de experiencia - ${item.company || "Cliente"}`,
      priority: "Seguimiento",
      detail: `Valor futuro ${item.futureValue || 0}/5, satisfaccion profesional ${item.professionalSatisfaction || 0}/5. Accion solicitada: ${item.actionToday || "Definir accion especifica"}.`,
      target: item.contact || "Responsable de experiencia",
      source: "Diseñando la Experiencia",
      sourceGroup: "survey" as const,
    }))

  const visitAlerts = visits
    .filter((item) => Number(item.urgency || 0) >= 4 || /riesgo/i.test(item.outcome || ""))
    .map((item) => ({
      title: `Alerta de diseño de experiencia - ${item.client || "Cliente"}`,
      priority: Number(item.urgency || 0) >= 5 ? "Critica" : "Alta",
      detail: `${item.outcome}. Urgencia ${item.urgency}/5. Responsable: ${item.commercial || "Sin asignar"}.`,
      target: item.commercial || item.contact || "Responsable de experiencia",
      source: "Reporte de diseño de experiencia",
      sourceGroup: "visit" as const,
    }))

  const followups = visits
    .filter((item) => item.nextDate && new Date(`${item.nextDate}T12:00:00`) >= today)
    .map((item) => ({
      title: `Nueva visita agendada - ${item.client || "Cliente"}`,
      priority: "Seguimiento",
      detail: `${item.nextDate} con ${item.contact || "contacto pendiente"}.`,
      target: item.contact || item.commercial || "Responsable de seguimiento",
      source: "Agenda de experiencia",
      sourceGroup: "visit" as const,
    }))

  return [...surveyAlerts, ...experienceAlerts, ...visitAlerts, ...followups].slice(0, 50)
}

// Ported from aiSummary() (app.js líneas 407-432) — sin alertas de PQR (dominio separado)
export function sacAiSummary(surveys: ZymoClientSurvey[], experienceSurveys: ZymoExperienceSurvey[], visits: ZymoVisitReport[]): string[] {
  const recordCount = surveys.length + experienceSurveys.length + visits.length
  if (!recordCount) {
    return [
      "Aun no hay datos registrados. Comparte el enlace de Fidelización de clientes, Diseñando la Experiencia y el enlace de reporte de diseño de experiencia para activar el analisis.",
      "Prioridad inicial: capturar satisfaccion, calidad de reunion, resultado de experiencia y fecha de seguimiento.",
    ]
  }
  const satisfaction = average(surveys as unknown as Record<string, unknown>[], "satisfaction")
  const solution = average(surveys as unknown as Record<string, unknown>[], "solution")
  const commercialValue = average(experienceSurveys as unknown as Record<string, unknown>[], "futureValue")
  const quality = average(visits as unknown as Record<string, unknown>[], "quality")
  const urgency = average(visits as unknown as Record<string, unknown>[], "urgency")
  const activeAlerts = sacAlerts(surveys, experienceSurveys, visits).length
  const lines = [
    `Lectura ejecutiva: ${surveys.length} encuesta(s) cliente, ${experienceSurveys.length} respuesta(s) de experiencia, ${visits.length} reporte(s), ${activeAlerts} alerta(s).`,
    `Satisfaccion promedio ${satisfaction || 0}/5, claridad de soluciones ${solution || 0}/5, valor futuro de experiencia ${commercialValue || 0}/5, calidad de experiencia ${quality || 0}/5.`,
    `Urgencia promedio ${urgency || 0}/5 y NPS consolidado ${npsScoreFor(surveys)}.`,
  ]
  if (satisfaction && satisfaction < 4) lines.push("Accion IA: cerrar observaciones con responsable, fecha y evidencia en menos de 48 horas.")
  if (solution && solution < 4) lines.push("Accion IA: traducir soluciones tecnicas en beneficios de trazabilidad, cumplimiento, costo y experiencia.")
  if (commercialValue && commercialValue < 4) lines.push("Accion IA: ajustar la experiencia propuesta a necesidades logisticas actuales y preparar evidencia tecnica para la proxima interaccion.")
  if (urgency >= 4) lines.push("Accion IA: escalar reportes de urgencia alta a seguimiento gerencial y confirmar nueva agenda.")
  if (!activeAlerts) lines.push("Estado IA: sin alertas criticas. Mantener cadencia de medicion posterior a cada reunion clave.")
  return lines
}

// Ported from strategies() (app.js líneas 434-461)
export function sacStrategies(surveys: ZymoClientSurvey[], experienceSurveys: ZymoExperienceSurvey[], visits: ZymoVisitReport[]) {
  const satisfaction = average(surveys as unknown as Record<string, unknown>[], "satisfaction")
  const solution = average(surveys as unknown as Record<string, unknown>[], "solution")
  const commercialValue = average(experienceSurveys as unknown as Record<string, unknown>[], "futureValue")
  const urgency = average(visits as unknown as Record<string, unknown>[], "urgency")
  return [
    {
      title: "Cierre de hallazgos",
      detail: satisfaction && satisfaction < 4
        ? "Activar plan 48 horas con causa, responsable, fecha y evidencia de cierre."
        : "Conservar registro de observaciones y validar cierre en la siguiente reunion.",
    },
    {
      title: "Valor para cliente",
      detail: solution && solution < 4
        ? "Reformular mensajes tecnicos como beneficios operativos, financieros y de cumplimiento."
        : "Mantener comunicacion ejecutiva orientada a resultado y trazabilidad.",
    },
    {
      title: "Seguimiento de experiencia",
      detail: commercialValue && commercialValue < 4
        ? "Reformular alcance, tiempos de respuesta y beneficios esperados antes del siguiente contacto."
        : urgency >= 4
          ? "Agendar visita de recuperacion y enviar resumen por WhatsApp o correo al responsable."
          : "Programar seguimiento preventivo con clientes sin nueva fecha registrada.",
    },
  ]
}
