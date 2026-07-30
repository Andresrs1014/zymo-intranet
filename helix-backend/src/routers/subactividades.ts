import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"
import { COLUMNS } from "../utils/constants"

const router = Router()

const SubactividadBody = z.object({
  nombre: z.string().min(1).max(150),
  responsableId: z.number().int().positive().nullable().optional(),
  responsableNombre: z.string().max(100).nullable().optional(),
  estado: z.enum(COLUMNS).default("Planificado"),
})

// GET /actividades/:actividadId/subactividades — list
router.get("/actividades/:actividadId/subactividades", async (req, res, next) => {
  try {
    const actividadId = parseInt(req.params.actividadId, 10)
    if (isNaN(actividadId)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const actividad = await prisma.helixActividad.findUnique({ where: { id: actividadId } })
    if (!actividad) {
      res.status(404).json({ error: "Actividad no encontrada" })
      return
    }
    const items = await prisma.helixSubactividad.findMany({
      where: { actividadId },
      orderBy: { createdAt: "asc" },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST /actividades/:actividadId/subactividades — create
router.post("/actividades/:actividadId/subactividades", async (req, res, next) => {
  try {
    const actividadId = parseInt(req.params.actividadId, 10)
    if (isNaN(actividadId)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = SubactividadBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const actividad = await prisma.helixActividad.findUnique({ where: { id: actividadId } })
    if (!actividad) {
      res.status(404).json({ error: "Actividad no encontrada" })
      return
    }
    const item = await prisma.helixSubactividad.create({
      data: { ...parsed.data, actividadId },
    })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// PUT /subactividades/:id — update
router.put("/subactividades/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = SubactividadBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixSubactividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    const item = await prisma.helixSubactividad.update({ where: { id }, data: parsed.data })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// DELETE /subactividades/:id
router.delete("/subactividades/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const existing = await prisma.helixSubactividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    await prisma.helixSubactividad.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
