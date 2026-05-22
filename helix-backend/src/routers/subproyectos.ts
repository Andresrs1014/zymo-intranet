import { Router } from "express"
import { z } from "zod"
import { prisma } from "../config/prisma"

const router = Router()

const SubproyectoBody = z.object({
  nombre: z.string().min(1).max(100),
  objetivo: z.string().optional(),
  cliente: z.string().optional(),
  inversionEst: z.number().min(0).max(9_999_999_999).default(0),
  retornoEsp: z.number().min(0).max(9_999_999_999).default(0),
})

// GET / — list all active subproyectos
router.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.helixSubproyecto.findMany({
      where: { activo: true },
      orderBy: { createdAt: "desc" },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST / — create subproyecto
router.post("/", async (req, res, next) => {
  try {
    const parsed = SubproyectoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const item = await prisma.helixSubproyecto.create({ data: parsed.data })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

// PUT /:id — update subproyecto
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = SubproyectoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixSubproyecto.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    const item = await prisma.helixSubproyecto.update({
      where: { id },
      data: parsed.data,
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// DELETE /:id — soft delete (set activo=false)
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const existing = await prisma.helixSubproyecto.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    await prisma.helixSubproyecto.update({ where: { id }, data: { activo: false } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// GET /:id/roi — ROI calculation
router.get("/:id/roi", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const subproyecto = await prisma.helixSubproyecto.findUnique({ where: { id } })
    if (!subproyecto) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const actividades = await prisma.helixActividad.findMany({
      where: { subproyectoId: id },
      select: { avance: true, estado: true },
    })

    const inv = subproyecto.inversionEst
    const ret = subproyecto.retornoEsp
    const roi = inv === 0 ? 0 : ((ret - inv) / inv) * 100
    const margen = ret - inv

    // Ensure no Infinity/NaN in response
    const safeRoi = Number.isFinite(roi) ? roi : 0

    // Keep local aliases for response fields
    const inversionEst = inv
    const retornoEsp = ret

    let clasificacion: string
    if (safeRoi >= 80) clasificacion = "Alto potencial"
    else if (safeRoi >= 40) clasificacion = "Potencial favorable"
    else if (safeRoi >= 0) clasificacion = "Retorno controlado"
    else clasificacion = "Revisar alcance"

    const totalActividades = actividades.length
    const avancePromedio =
      totalActividades === 0
        ? 0
        : actividades.reduce((sum, a) => sum + a.avance, 0) / totalActividades
    const actividadesTerminadas = actividades.filter(
      (a) => a.estado === "Terminado"
    ).length

    res.json({
      id: subproyecto.id,
      nombre: subproyecto.nombre,
      inversionEst,
      retornoEsp,
      roi: safeRoi,
      margen,
      clasificacion,
      totalActividades,
      avancePromedio,
      actividadesTerminadas,
    })
  } catch (err) {
    next(err)
  }
})

export default router
