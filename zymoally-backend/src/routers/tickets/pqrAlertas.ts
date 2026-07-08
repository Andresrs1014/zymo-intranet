import { Router } from "express"
import { prisma } from "../../config/prisma"
import { pqrAlerts } from "../../services/pqrMetrics"

const router = Router()

// GET / — alertas de PQR (subset de alerts(), app.js:374-388)
router.get("/", async (req, res, next) => {
  try {
    const { priority, search } = req.query as Record<string, string | undefined>
    const tickets = await prisma.zymoPqrTicket.findMany()
    let alerts = pqrAlerts(tickets)

    if (priority && priority !== "all") alerts = alerts.filter((a) => a.priority === priority)
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
