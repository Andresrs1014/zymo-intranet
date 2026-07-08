import { Router } from "express"
import { prisma } from "../../config/prisma"
import { requireSurveyScope } from "../../middleware/auth"
import { SAC_LIST_TYPES } from "../../utils/constants"
import { SurveyBody, createClientSurvey } from "../sac/surveys"
import { ExperienceBody, createExperienceSurvey } from "../sac/experience"

const router = Router()

const PUBLIC_LIST_TYPES = ["surveyValueChoices", "surveyIssues", "experienceFitChoices", "experienceClarityChoices"] as const

// GET /config — opciones de los choice-lists visibles al cliente final, sin autenticación
router.get("/config", async (_req, res, next) => {
  try {
    const items = await prisma.zymoConfigList.findMany({
      where: { isActive: true, listType: { in: [...PUBLIC_LIST_TYPES] } },
      orderBy: [{ listType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    })
    const grouped = Object.fromEntries(
      SAC_LIST_TYPES.filter((t) => (PUBLIC_LIST_TYPES as readonly string[]).includes(t)).map((type) => [
        type,
        items.filter((i) => i.listType === type).map((i) => ({ value: i.value, label: i.label })),
      ])
    )
    res.json(grouped)
  } catch (err) {
    next(err)
  }
})

// POST /client — encuesta de Fidelización, solo accesible con el magic-link del cliente
router.post("/client", requireSurveyScope("client"), async (req, res, next) => {
  try {
    const parsed = SurveyBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const survey = await createClientSurvey(parsed.data)
    res.status(201).json({ npsCategory: survey.npsCategory })
  } catch (err) {
    next(err)
  }
})

// POST /experience — Diseñando la Experiencia, solo accesible con el magic-link del cliente
router.post("/experience", requireSurveyScope("experience"), async (req, res, next) => {
  try {
    const parsed = ExperienceBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    await createExperienceSurvey(parsed.data)
    res.status(201).json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
