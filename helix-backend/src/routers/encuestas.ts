import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"
import { getUserId } from "../middleware/auth"

const router = Router()

const EncuestaBody = z.object({
  nombre: z.string().min(1).max(150),
  rol: z.enum(["Desarrollador", "Gestor", "Directivo", "Otro"]),
  satisfaccion: z.number().int().min(1).max(5),
  facilidad: z.number().int().min(1).max(5),
  utilidad: z.number().int().min(1).max(5),
  nps: z.number().int().min(0).max(10),
  comentario: z.string().max(1000).optional(),
})

// POST /api/encuestas — submit a satisfaction survey
router.post("/", async (req, res, next) => {
  try {
    const userId = getUserId(req.user!)
    const parsed = EncuestaBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }

    const encuesta = await prisma.helixEncuesta.create({
      data: {
        usuarioId: userId,
        usuarioNombre: parsed.data.nombre,
        rol: parsed.data.rol,
        satisfaccion: parsed.data.satisfaccion,
        facilidad: parsed.data.facilidad,
        utilidad: parsed.data.utilidad,
        nps: parsed.data.nps,
        comentario: parsed.data.comentario,
      },
    })

    res.status(201).json(encuesta)
  } catch (err) {
    next(err)
  }
})

export default router
