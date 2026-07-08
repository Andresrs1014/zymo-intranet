import { Router } from "express"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { prisma } from "../../config/prisma"
import { env } from "../../config/env"
import { currentDateValue } from "../../utils/formatters"
import type { SurveyLinkPayload } from "../../middleware/auth"

const router = Router()

const MAGIC_LINK_TTL = "30d"

const MagicLinkBody = z.object({
  surveyType: z.enum(["client", "experience"]),
  label: z.string().optional(),
})

// POST /magic-link — genera el link público de encuesta (mismo patrón que /magic-link de Mantenimiento)
router.post("/magic-link", (req, res, next) => {
  try {
    const body = MagicLinkBody.parse(req.body)
    const payload: SurveyLinkPayload = { scope: "survey_client", surveyType: body.surveyType }
    const token = jwt.sign(payload, env.JWT_SECRET, { algorithm: "HS256", expiresIn: MAGIC_LINK_TTL })
    const url = `${env.PUBLIC_APP_URL}/e/${body.surveyType}?t=${token}`
    res.status(201).json({ token, url })
  } catch (err) {
    next(err)
  }
})

// Ported from surveyCategory() (app.js:1324-1328)
function surveyCategory(score: number): string {
  if (score >= 9) return "Promotor"
  if (score >= 7) return "Neutral"
  return "Detractor"
}

export const SurveyBody = z.object({
  date: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  nps: z.number().int().min(0).max(10),
  satisfaction: z.number().int().min(0).max(5),
  delivery: z.number().int().min(0).max(5),
  attention: z.number().int().min(0).max(5),
  meeting: z.number().int().min(0).max(5).optional(),
  solution: z.number().int().min(0).max(5).optional(),
  valuedAspect: z.string().optional(),
  issue: z.string().optional(),
  comment: z.string().max(1000).optional(),
})

// Compartido entre el router staff (POST /) y el router público (POST /public/survey/client)
export function createClientSurvey(body: z.infer<typeof SurveyBody>) {
  return prisma.zymoClientSurvey.create({
    data: {
      date: body.date || currentDateValue(),
      company: body.company,
      role: body.role,
      email: body.email,
      phone: body.phone,
      nps: body.nps,
      npsCategory: surveyCategory(body.nps),
      satisfaction: body.satisfaction,
      delivery: body.delivery,
      attention: body.attention,
      meeting: body.meeting ?? body.delivery,
      solution: body.solution ?? body.attention,
      valuedAspect: body.valuedAspect,
      issue: body.issue,
      comment: body.comment,
      nextStep: body.issue && body.issue !== "Ninguno" ? "Revisar inconveniente reportado" : "Mantener seguimiento preventivo",
    },
  })
}

// GET / — Fidelización de clientes (patrón surveys array, app.js)
router.get("/", async (req, res, next) => {
  try {
    const { limit } = req.query as Record<string, string | undefined>
    const surveys = await prisma.zymoClientSurvey.findMany({
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : undefined,
    })
    res.json(surveys)
  } catch (err) {
    next(err)
  }
})

// POST / — registrar encuesta (patrón submitClientSurvey, app.js:1427-1461)
router.post("/", async (req, res, next) => {
  try {
    const parsed = SurveyBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const survey = await createClientSurvey(parsed.data)
    res.status(201).json(survey)
  } catch (err) {
    next(err)
  }
})

export default router
