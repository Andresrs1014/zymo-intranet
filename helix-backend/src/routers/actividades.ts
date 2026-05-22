import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"

const router = Router()

const ActividadBody = z.object({
  subproyectoId: z.number().int().positive(),
  responsableId: z.number().int().positive(),
  responsableNombre: z.string().min(1),
  responsableInitials: z.string().min(1).max(3),
  responsableColor: z.string().default("#5461c8"),
  nombre: z.string().min(1).max(100),
  estado: z
    .enum(["Backlog", "Planificado", "En curso", "Revision", "Terminado"])
    .default("Backlog"),
  prioridad: z.enum(["Alta", "Media", "Baja"]).default("Media"),
  fechaInicio: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  fechaFin: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  avance: z.number().int().min(0).max(100).default(0),
  puntos: z.number().int().min(1).max(21).default(3),
  costoInversion: z.number().min(0).default(0),
  costoOptimizacion: z.number().min(0).default(0),
  costoEjecucion: z.number().min(0).default(0),
  bloqueada: z.boolean().default(false),
  dependenciaId: z.number().int().positive().nullable().optional(),
})

const EstadoBody = z.object({
  estado: z.enum(["Backlog", "Planificado", "En curso", "Revision", "Terminado"]),
})

const AvanceBody = z.object({
  avance: z.number().int().min(0).max(100),
})

// GET / — list actividades with optional filters
router.get("/", async (req, res, next) => {
  try {
    const { subproyectoId, estado, responsableId, bloqueada } = req.query

    // Build filter dynamically
    const where: Record<string, unknown> = {}
    if (subproyectoId !== undefined) {
      const parsed = parseInt(subproyectoId as string, 10)
      if (!isNaN(parsed)) where.subproyectoId = parsed
    }
    if (estado !== undefined) {
      where.estado = estado as string
    }
    if (responsableId !== undefined) {
      const parsed = parseInt(responsableId as string, 10)
      if (!isNaN(parsed)) where.responsableId = parsed
    }
    if (bloqueada !== undefined) {
      where.bloqueada = bloqueada === "true"
    }

    const items = await prisma.helixActividad.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST / — create actividad
router.post("/", async (req, res, next) => {
  try {
    const parsed = ActividadBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }

    const { fechaInicio, fechaFin, ...rest } = parsed.data
    const item = await prisma.helixActividad.create({
      data: {
        ...rest,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
      },
    })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// GET /:id — get single actividad with comentarios and evidencias
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const item = await prisma.helixActividad.findUnique({
      where: { id },
      include: {
        comentarios: { orderBy: { createdAt: "asc" } },
        evidencias: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!item) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// PUT /:id — full update of actividad
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = ActividadBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const { fechaInicio, fechaFin, ...rest } = parsed.data
    // Auto-set completadaEn if transitioning to Terminado
    const completadaEn =
      rest.estado === "Terminado" && existing.estado !== "Terminado"
        ? new Date()
        : existing.completadaEn ?? undefined

    const item = await prisma.helixActividad.update({
      where: { id },
      data: {
        ...rest,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        completadaEn,
      },
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// DELETE /:id — delete actividad
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    await prisma.helixActividad.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/estado — update only estado field
router.patch("/:id/estado", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = EstadoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const updateData: { estado: string; completadaEn?: Date } = {
      estado: parsed.data.estado,
    }
    if (parsed.data.estado === "Terminado") {
      updateData.completadaEn = new Date()
    }

    const item = await prisma.helixActividad.update({
      where: { id },
      data: updateData,
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/avance — update only avance field
router.patch("/:id/avance", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = AvanceBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const item = await prisma.helixActividad.update({
      where: { id },
      data: { avance: parsed.data.avance },
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

export default router
