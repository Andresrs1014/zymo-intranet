import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"
import { getUserId } from "../middleware/auth"

const router = Router()

const ComentarioBody = z.object({
  texto: z.string().min(1),
  canal: z.enum(["web", "whatsapp"]).default("web"),
})

// GET /actividades/:actividadId/comentarios — list comments for an actividad
router.get("/actividades/:actividadId/comentarios", async (req, res, next) => {
  try {
    const actividadId = parseInt(req.params.actividadId, 10)
    if (isNaN(actividadId)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const actividad = await prisma.helixActividad.findUnique({
      where: { id: actividadId },
    })
    if (!actividad) {
      res.status(404).json({ error: "Actividad no encontrada" })
      return
    }
    const comentarios = await prisma.helixComentario.findMany({
      where: { actividadId },
      orderBy: { createdAt: "asc" },
    })
    res.json(comentarios)
  } catch (err) {
    next(err)
  }
})

// POST /actividades/:actividadId/comentarios — create comment
router.post("/actividades/:actividadId/comentarios", async (req, res, next) => {
  try {
    const actividadId = parseInt(req.params.actividadId, 10)
    if (isNaN(actividadId)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = ComentarioBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const actividad = await prisma.helixActividad.findUnique({
      where: { id: actividadId },
    })
    if (!actividad) {
      res.status(404).json({ error: "Actividad no encontrada" })
      return
    }

    const autorId = getUserId(req.user!)
    const autorNombre =
      req.user!.full_name ?? req.user!.email ?? "Usuario"

    const comentario = await prisma.helixComentario.create({
      data: {
        actividadId,
        autorId,
        autorNombre,
        texto: parsed.data.texto,
        canal: parsed.data.canal,
      },
    })
    res.status(201).json(comentario)
  } catch (err) {
    next(err)
  }
})

export default router
