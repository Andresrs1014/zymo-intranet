import { Router } from "express"
import { z } from "zod"
import { prisma } from "../../config/prisma"
import { currentDateValue } from "../../utils/formatters"

const router = Router()

export const ExperienceBody = z.object({
  date: z.string().optional(),
  company: z.string().optional(),
  contact: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  fit: z.string().optional(),
  futureValue: z.number().int().min(0).max(5),
  clarity: z.string().optional(),
  exceededExpectations: z.string().optional(),
  actionToday: z.string().optional(),
  professionalSatisfaction: z.number().int().min(0).max(5),
  meetingFit: z.number().int().min(0).max(5),
  leadershipComment: z.string().optional(),
})

// Compartido entre el router staff (POST /) y el router público (POST /public/survey/experience)
export function createExperienceSurvey(body: z.infer<typeof ExperienceBody>) {
  return prisma.zymoExperienceSurvey.create({
    data: {
      date: body.date || currentDateValue(),
      company: body.company,
      contact: body.contact,
      email: body.email,
      phone: body.phone,
      fit: body.fit,
      futureValue: body.futureValue,
      clarity: body.clarity,
      exceededExpectations: body.exceededExpectations,
      actionToday: body.actionToday,
      professionalSatisfaction: body.professionalSatisfaction,
      meetingFit: body.meetingFit,
      leadershipComment: body.leadershipComment,
      satisfaction: body.professionalSatisfaction,
      solution: body.futureValue,
      nextStep: body.actionToday || "Definir siguiente accion de experiencia",
    },
  })
}

// GET / — Diseñando la Experiencia (patrón commercialSurveys array, app.js)
router.get("/", async (req, res, next) => {
  try {
    const { limit } = req.query as Record<string, string | undefined>
    const surveys = await prisma.zymoExperienceSurvey.findMany({
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : undefined,
    })
    res.json(surveys)
  } catch (err) {
    next(err)
  }
})

// POST / — registrar respuesta (patrón submitCommercialSurvey, app.js:1558-1593)
router.post("/", async (req, res, next) => {
  try {
    const parsed = ExperienceBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const survey = await createExperienceSurvey(parsed.data)
    res.status(201).json(survey)
  } catch (err) {
    next(err)
  }
})

export default router
