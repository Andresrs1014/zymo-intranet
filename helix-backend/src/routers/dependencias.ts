import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"

const router = Router()

const TIPOS = ["Interna", "Externa", "Cliente", "Tecnologia", "Proveedor"] as const

const DependenciaBody = z.object({
  nombre: z.string().min(1).max(100),
  tipo: z.enum(TIPOS).default("Interna"),
  responsableArea: z.string().max(100).optional(),
})

// GET / — list dependencias (catálogo)
router.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.helixDependencia.findMany({
      orderBy: { createdAt: "desc" },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST / — create dependencia
router.post("/", async (req, res, next) => {
  try {
    const parsed = DependenciaBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const item = await prisma.helixDependencia.create({ data: parsed.data })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// PUT /:id — update dependencia
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = DependenciaBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixDependencia.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    const item = await prisma.helixDependencia.update({ where: { id }, data: parsed.data })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// DELETE /:id — delete dependencia (blocked if actividades still reference it)
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const existing = await prisma.helixDependencia.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    const actividadesCount = await prisma.helixActividad.count({ where: { dependenciaId: id } })
    if (actividadesCount > 0) {
      res.status(409).json({ error: "No se puede eliminar: hay actividades vinculadas a esta dependencia" })
      return
    }
    await prisma.helixDependencia.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
