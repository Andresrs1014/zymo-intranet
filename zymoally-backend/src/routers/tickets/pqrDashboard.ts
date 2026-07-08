import { Router } from "express"
import { prisma } from "../../config/prisma"
import { pqrAiSummary, pqrDashboardMetrics } from "../../services/pqrMetrics"
import { normalizePrefix } from "../../utils/formatters"

const router = Router()

// GET / — métricas + IA (patrón renderPqrDashboard, app.js:760-805)
router.get("/", async (req, res, next) => {
  try {
    const { status, type, impact, area, client, supervisor } = req.query as Record<string, string | undefined>
    const where: Record<string, unknown> = {}
    if (status && status !== "all") where.status = status
    if (type && type !== "all") where.type = type
    if (impact && impact !== "all") where.impact = impact
    if (area && area !== "all") where.area = area
    if (client && client !== "all") where.client = client
    if (supervisor && supervisor !== "all") where.supervisor = supervisor

    const tickets = await prisma.zymoPqrTicket.findMany({ where, include: { evidence: true } })
    res.json({
      metrics: pqrDashboardMetrics(tickets),
      aiAnalysis: pqrAiSummary(tickets),
    })
  } catch (err) {
    next(err)
  }
})

// GET /historico — agrupado por mes/área/prefijo (patrón pqrHistoryRows, app.js:687-731)
router.get("/historico", async (req, res, next) => {
  try {
    const { month, prefix, status, search } = req.query as Record<string, string | undefined>
    const tickets = await prisma.zymoPqrTicket.findMany({ orderBy: [{ monthKey: "desc" }, { areaPrefix: "asc" }, { code: "desc" }] })

    const term = (search || "").trim().toLowerCase()
    const rows = tickets
      .map((ticket) => ({
        ticket,
        month: `${ticket.monthKey.slice(0, 4)}-${ticket.monthKey.slice(4)}`,
        area: ticket.area,
        prefix: normalizePrefix(ticket.areaPrefix),
        code: ticket.code,
        client: ticket.client,
        status: ticket.status,
      }))
      .filter((row) => {
        if (month && row.month !== month) return false
        if (prefix && prefix !== "all" && row.prefix !== prefix) return false
        if (status && status !== "all" && row.status !== status) return false
        if (!term) return true
        return [row.code, row.month, row.area, row.prefix, row.client, row.status].join(" ").toLowerCase().includes(term)
      })

    const grouped = new Map<string, { month: string; area: string; prefix: string; total: number; open: number; closed: number; firstCode: string; lastCode: string }>()
    rows.forEach((row) => {
      const key = `${row.month}|${row.area}|${row.prefix}`
      const current = grouped.get(key) || { month: row.month, area: row.area, prefix: row.prefix, total: 0, open: 0, closed: 0, firstCode: row.code, lastCode: row.code }
      current.total += 1
      const isClosed = /cerrado/i.test(row.status)
      current.open += isClosed ? 0 : 1
      current.closed += isClosed ? 1 : 0
      current.firstCode = [current.firstCode, row.code].sort()[0]
      current.lastCode = [current.lastCode, row.code].sort().reverse()[0]
      grouped.set(key, current)
    })

    res.json(Array.from(grouped.values()))
  } catch (err) {
    next(err)
  }
})

export default router
