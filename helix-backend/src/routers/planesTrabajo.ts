import { Router } from "express"
import { z } from "zod"
import { crearPlanDeTrabajo, PlanTrabajoValidationError } from "../services/planTrabajoService"
import { COLUMNS } from "../utils/constants"

const router = Router()

const PlanTrabajoBody = z.object({
  nombre: z.string().min(1).max(100),
  objetivo: z.string().max(500).optional(),
  liderResponsableId: z.number().int().positive(),
  liderResponsableNombre: z.string().min(1),
  liderResponsableInitials: z.string().min(1).max(3),
  liderResponsableColor: z.string().optional(),
  fechaInicio: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  fechaFin: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  actividades: z.array(z.string()).min(1, "Se necesita al menos una actividad"),
  subactividadesBase: z
    .array(
      z.object({
        nombre: z.string().min(1).max(150),
        responsableId: z.number().int().positive().nullable().optional(),
        responsableNombre: z.string().max(100).nullable().optional(),
        estado: z.enum(COLUMNS).default("Planificado"),
      })
    )
    .optional(),
})

// POST / — crear plan de trabajo (Subproyecto tipo=PlanDeTrabajo + N actividades repartidas)
router.post("/", async (req, res, next) => {
  try {
    const parsed = PlanTrabajoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const resultado = await crearPlanDeTrabajo(parsed.data)
    res.status(201).json(resultado)
  } catch (err) {
    if (err instanceof PlanTrabajoValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    next(err)
  }
})

export default router
