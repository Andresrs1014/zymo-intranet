import { Router } from "express"
import { prisma } from "../../config/prisma"
import { sacAlerts } from "../../services/sacMetrics"

const router = Router()

// GET / — alertas de encuestas/visitas (subset de alerts(), app.js:332-373)
router.get("/", async (req, res, next) => {
  try {
    const { source, search } = req.query as Record<string, string | undefined>
    const [surveys, experienceSurveys, visits] = await Promise.all([
      prisma.zymoClientSurvey.findMany(),
      prisma.zymoExperienceSurvey.findMany(),
      prisma.zymoVisitReport.findMany(),
    ])

    let alerts = sacAlerts(surveys, experienceSurveys, visits)
    if (source && source !== "all") alerts = alerts.filter((a) => a.sourceGroup === source)
    const term = (search || "").trim().toLowerCase()
    if (term) {
      alerts = alerts.filter((a) => [a.title, a.priority, a.detail, a.target, a.source].join(" ").toLowerCase().includes(term))
    }

    res.json(alerts)
  } catch (err) {
    next(err)
  }
})

export default router
