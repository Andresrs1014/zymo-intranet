import { Router } from "express"
import { z } from "zod"
import { prisma } from "../../config/prisma"
import { currentDateValue } from "../../utils/formatters"

const router = Router()

const VisitBody = z.object({
  date: z.string().optional(),
  commercial: z.string().optional(),
  client: z.string().min(1),
  contact: z.string().optional(),
  outcome: z.string().optional(),
  nextDate: z.string().optional(),
  quality: z.number().int().min(0).max(5),
  clientMood: z.number().int().min(0).max(5),
  opportunity: z.number().int().min(0).max(5),
  urgency: z.number().int().min(0).max(5),
  observations: z.string().optional(),
  actionPlan: z.string().optional(),
})

// GET / — Reporte de diseño de experiencia (patrón visits array, app.js)
router.get("/", async (req, res, next) => {
  try {
    const { limit } = req.query as Record<string, string | undefined>
    const visits = await prisma.zymoVisitReport.findMany({
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : undefined,
    })
    res.json(visits)
  } catch (err) {
    next(err)
  }
})

// POST / — registrar visita (patrón visitReportForm submit, app.js:1947-1970)
router.post("/", async (req, res, next) => {
  try {
    const parsed = VisitBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const body = parsed.data
    const visit = await prisma.zymoVisitReport.create({
      data: { ...body, date: body.date || currentDateValue() },
    })
    res.status(201).json(visit)
  } catch (err) {
    next(err)
  }
})

export default router
