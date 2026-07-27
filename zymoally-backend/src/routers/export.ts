import { Router } from "express"
import { prisma } from "../config/prisma"
import { csvEscape, currentDateValue, daysOpen } from "../utils/formatters"
import { sacAiSummary, sacAlerts, sacStrategies } from "../services/sacMetrics"

function sendCsv(res: import("express").Response, rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  res.send(csv)
}

// ─── Tickets export (patrón exportPqrCsv, app.js:1222-1252) ────────────────
export const ticketsExportRouter = Router()

ticketsExportRouter.get("/csv", async (_req, res, next) => {
  try {
    const tickets = await prisma.zymoPqrTicket.findMany({
      include: { actions: { orderBy: { createdAt: "asc" } }, evidence: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    })
    const headers = ["codigo", "area", "prefijo", "mes", "fecha", "fecha_compromiso", "fecha_cierre", "dias_gestion", "criterio_gestion", "cliente", "plataforma_logistica", "supervisor", "analista_asignado", "coordinador", "telefono", "correo", "quien_genera_ticket", "tipo", "estado", "prioridad", "impacto", "canal", "descripcion", "evidencias", "acciones_efectuadas"]
    const rows = tickets.map((t) => [
      t.code,
      t.area,
      t.areaPrefix,
      `${t.monthKey.slice(0, 4)}-${t.monthKey.slice(4)}`,
      t.date,
      t.dueDate || "",
      t.closedDate || "",
      String(daysOpen(t)),
      t.managementCriteria || "",
      t.client || "",
      t.platform || "",
      t.supervisor || "",
      t.analysts.join(", "),
      t.coordinator || "",
      t.phone || "",
      t.email || "",
      t.owner || "",
      t.type,
      t.status,
      t.priority,
      t.impact || "",
      t.channel || "",
      t.description || "",
      t.evidence.map((e) => e.filename).join(" | "),
      t.actions.map((a) => a.texto).join(" | "),
    ])
    sendCsv(res, [headers, ...rows], `tickets_pqr_zymoally_${currentDateValue()}.csv`)
  } catch (err) {
    next(err)
  }
})

// ─── SAC export (patrón exportCsv/exportJson, app.js:1190-1220) ────────────
export const sacExportRouter = Router()

sacExportRouter.get("/csv", async (_req, res, next) => {
  try {
    const [surveys, experienceSurveys, visits] = await Promise.all([
      prisma.zymoClientSurvey.findMany(),
      prisma.zymoExperienceSurvey.findMany(),
      prisma.zymoVisitReport.findMany(),
    ])
    const records = [
      ...surveys.map((i) => ({ ...i, recordType: "Fidelización de clientes ZYMOALLY" })),
      ...experienceSurveys.map((i) => ({ ...i, recordType: "Diseñando la Experiencia ZYMOALLY" })),
      ...visits.map((i) => ({ ...i, recordType: "Reporte de diseño de experiencia ZYMOALLY" })),
    ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))

    const headers = ["tipo", "fecha", "cliente", "contacto_responsable", "resultado", "satisfaccion", "nps", "valor_experiencia", "calidad_experiencia", "urgencia", "observaciones", "proximo_paso"]
    const rows = records.map((item: Record<string, unknown>) => [
      item.recordType,
      item.date || "",
      item.company || item.client || "",
      item.contact || item.commercial || "",
      item.outcome || item.fit || "",
      item.satisfaction || "",
      item.nps || "",
      item.futureValue || "",
      item.quality || item.meeting || "",
      item.urgency || "",
      item.comment || item.observations || item.actionToday || item.leadershipComment || "",
      item.nextStep || item.actionPlan || item.nextDate || item.actionToday || "",
    ])
    sendCsv(res, [headers, ...(rows as string[][])], `resultados_zymoally_${currentDateValue()}.csv`)
  } catch (err) {
    next(err)
  }
})

sacExportRouter.get("/json", async (_req, res, next) => {
  try {
    const [surveys, experienceSurveys, visits] = await Promise.all([
      prisma.zymoClientSurvey.findMany(),
      prisma.zymoExperienceSurvey.findMany(),
      prisma.zymoVisitReport.findMany(),
    ])
    res.setHeader("Content-Disposition", `attachment; filename="analisis_zymoally_${currentDateValue()}.json"`)
    res.json({
      exportedAt: new Date().toISOString(),
      surveys,
      experienceSurveys,
      visits,
      aiAnalysis: sacAiSummary(surveys, experienceSurveys, visits),
      strategies: sacStrategies(surveys, experienceSurveys, visits),
      alerts: sacAlerts(surveys, experienceSurveys, visits),
    })
  } catch (err) {
    next(err)
  }
})
