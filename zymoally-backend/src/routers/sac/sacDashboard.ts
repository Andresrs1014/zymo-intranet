import { Router } from "express"
import { prisma } from "../../config/prisma"
import { average } from "../../utils/formatters"
import { npsScoreFor, sacAiSummary, sacStrategies } from "../../services/sacMetrics"

const router = Router()

type RecordGroup = "client" | "commercial" | "visit"
type UnifiedRecord = Record<string, unknown> & { recordType: string; recordGroup: RecordGroup; date: string }

// Ported from recordMatchesStatus() (app.js:291-304)
function matchesStatus(item: UnifiedRecord, status?: string): boolean {
  if (!status || status === "all") return true
  const isClientRisk = item.recordGroup === "client" && (Number(item.satisfaction || 0) <= 3 || Number(item.nps || 0) <= 6)
  const isCommercialRisk = item.recordGroup === "commercial" && (Number(item.futureValue || 0) <= 3 || Number(item.professionalSatisfaction || 0) <= 3 || /No fueron|No se adaptan|Requieren/i.test(`${item.fit} ${item.clarity}`))
  const isVisitRisk = item.recordGroup === "visit" && (Number(item.urgency || 0) >= 4 || /riesgo/i.test(String(item.outcome || "")))
  const isClientPositive = item.recordGroup === "client" && Number(item.satisfaction || 0) >= 4 && Number(item.nps || 0) >= 9
  const isCommercialPositive = item.recordGroup === "commercial" && Number(item.futureValue || 0) >= 4 && Number(item.professionalSatisfaction || 0) >= 4
  const isVisitPositive = item.recordGroup === "visit" && Number(item.quality || 0) >= 4 && Number(item.urgency || 0) <= 2
  const needsFollowup = Boolean(item.nextDate || item.actionPlan || item.actionToday || (item.issue && item.issue !== "Ninguno"))
  if (status === "risk") return isClientRisk || isCommercialRisk || isVisitRisk
  if (status === "positive") return isClientPositive || isCommercialPositive || isVisitPositive
  if (status === "followup") return needsFollowup
  return true
}

// GET / — dashboard consolidado CX (patrón renderDashboard, app.js:1050-1085)
router.get("/", async (req, res, next) => {
  try {
    const { type, status, from, to, search } = req.query as Record<string, string | undefined>
    const [surveys, experienceSurveys, visits] = await Promise.all([
      prisma.zymoClientSurvey.findMany(),
      prisma.zymoExperienceSurvey.findMany(),
      prisma.zymoVisitReport.findMany(),
    ])

    // Ported from allRecords() (app.js:283-289)
    const allRecords: UnifiedRecord[] = [
      ...surveys.map((item) => ({ ...item, recordType: "Fidelización de clientes ZYMOALLY", recordGroup: "client" as const })),
      ...experienceSurveys.map((item) => ({ ...item, recordType: "Diseñando la Experiencia ZYMOALLY", recordGroup: "commercial" as const })),
      ...visits.map((item) => ({ ...item, recordType: "Reporte de diseño de experiencia ZYMOALLY", recordGroup: "visit" as const })),
    ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))

    const term = (search || "").trim().toLowerCase()
    const records = allRecords.filter((item) => {
      if (type && type !== "all" && item.recordGroup !== type) return false
      if (!matchesStatus(item, status)) return false
      if (from && item.date < from) return false
      if (to && item.date > to) return false
      if (!term) return true
      const haystack = [item.company, (item as Record<string, unknown>).client, item.contact, (item as Record<string, unknown>).commercial, item.role, item.outcome, item.fit, item.comment, item.observations, item.actionToday, item.leadershipComment]
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })

    const groups = {
      client: records.filter((r) => r.recordGroup === "client"),
      commercial: records.filter((r) => r.recordGroup === "commercial"),
      visit: records.filter((r) => r.recordGroup === "visit"),
    }

    // Ported from clientMetricItems/commercialMetricItems (app.js:1055-1070)
    const clientMetrics = {
      respuestas: groups.client.length,
      satisfaccion: average(groups.client, "satisfaction"),
      nps: npsScoreFor(groups.client as unknown as { nps: number }[]),
      entregas: average(groups.client, "delivery"),
      atencion: average(groups.client, "attention"),
      riesgos: groups.client.filter((item) => Number(item.satisfaction || 0) <= 3 || Number(item.nps || 0) <= 6).length,
    }
    const commercialMetrics = {
      respuestas: groups.commercial.length,
      valorReunion: average(groups.commercial, "futureValue"),
      atencion: average(groups.commercial, "professionalSatisfaction"),
      reunion: average(groups.commercial, "meetingFit"),
      claridadCritica: groups.commercial.filter((item) => /No fueron|Requieren/i.test(String(item.clarity || ""))).length,
      seguimientos: groups.commercial.filter((item) => Number(item.futureValue || 0) <= 3 || Number(item.professionalSatisfaction || 0) <= 3).length,
    }

    // Ported from renderCharts() (app.js:1018-1047)
    const promoters = groups.client.filter((item) => Number(item.nps || 0) >= 9).length
    const neutrals = groups.client.filter((item) => Number(item.nps || 0) >= 7 && Number(item.nps || 0) <= 8).length
    const detractors = groups.client.filter((item) => Number(item.nps || 0) <= 6).length
    const highValue = groups.commercial.filter((item) => Number(item.futureValue || 0) >= 4 && Number(item.professionalSatisfaction || 0) >= 4).length
    const followup = groups.commercial.filter((item) => Number(item.futureValue || 0) === 3 || Number(item.professionalSatisfaction || 0) === 3).length
    const risk = groups.commercial.filter((item) => Number(item.futureValue || 0) <= 2 || Number(item.professionalSatisfaction || 0) <= 2 || /No fueron|No se adaptan|Requieren/i.test(`${item.fit} ${item.clarity}`)).length

    res.json({
      records,
      clientMetrics,
      commercialMetrics,
      charts: {
        clientBar: [
          { label: "Satisfaccion", value: average(groups.client, "satisfaction") },
          { label: "Entregas", value: average(groups.client, "delivery") },
          { label: "Atencion", value: average(groups.client, "attention") },
        ],
        commercialBar: [
          { label: "Valor reunion", value: average(groups.commercial, "futureValue") },
          { label: "Atencion", value: average(groups.commercial, "professionalSatisfaction") },
          { label: "Contenido", value: average(groups.commercial, "meetingFit") },
        ],
        clientPie: [
          { label: "Promotores", value: promoters },
          { label: "Neutrales", value: neutrals },
          { label: "Detractores", value: detractors },
        ],
        commercialPie: [
          { label: "Alto valor", value: highValue },
          { label: "Seguimiento", value: followup },
          { label: "Riesgo", value: risk },
        ],
      },
      aiAnalysis: sacAiSummary(surveys, experienceSurveys, visits),
      strategies: sacStrategies(surveys, experienceSurveys, visits),
    })
  } catch (err) {
    next(err)
  }
})

export default router
