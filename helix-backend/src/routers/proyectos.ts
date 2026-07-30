import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"

const router = Router()

const ProyectoBody = z.object({
  nombre: z.string().min(1).max(100),
})

// GET / — list proyectos principales
router.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.helixProyecto.findMany({
      orderBy: { createdAt: "desc" },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST / — create proyecto principal
router.post("/", async (req, res, next) => {
  try {
    const parsed = ProyectoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const item = await prisma.helixProyecto.create({ data: parsed.data })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// PUT /:id — update proyecto principal
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = ProyectoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixProyecto.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    const item = await prisma.helixProyecto.update({ where: { id }, data: parsed.data })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// DELETE /:id — delete proyecto principal (blocked if it still has subproyectos)
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const existing = await prisma.helixProyecto.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    const subproyectosCount = await prisma.helixSubproyecto.count({ where: { proyectoId: id } })
    if (subproyectosCount > 0) {
      res.status(409).json({ error: "No se puede eliminar: tiene subproyectos asociados" })
      return
    }
    await prisma.helixProyecto.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
