import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess } from "../middleware/auth"

const router = Router()

const AreaSchema = z.object({
  nombre: z.string().min(1).max(100),
  descripcion: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// GET /api/areas — lista todas las áreas con conteo de procedimientos
router.get("/", async (_req: Request, res: Response) => {
  const areas = await prisma.sigArea.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { procedimientos: true } },
    },
  })
  res.json(areas)
})

// GET /api/areas/:id
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const area = await prisma.sigArea.findUnique({
    where: { id },
    include: {
      procedimientos: {
        orderBy: { codigo: "asc" },
        select: { id: true, codigo: true, titulo: true, estado: true, updatedAt: true },
      },
    },
  })
  if (!area) { res.status(404).json({ error: "Área no encontrada" }); return }
  res.json(area)
})

// POST /api/areas — solo admin
router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin") { res.status(403).json({ error: "Solo admin puede crear áreas" }); return }

  const parsed = AreaSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const area = await prisma.sigArea.create({ data: parsed.data })
  res.status(201).json(area)
})

// PATCH /api/areas/:id — solo admin
router.patch("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin") { res.status(403).json({ error: "Solo admin puede editar áreas" }); return }

  const id = parseInt(req.params.id)
  const parsed = AreaSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const area = await prisma.sigArea.update({ where: { id }, data: parsed.data })
  res.json(area)
})

// DELETE /api/areas/:id — solo admin, solo si no tiene procedimientos
router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin") { res.status(403).json({ error: "Solo admin puede eliminar áreas" }); return }

  const id = parseInt(req.params.id)
  const count = await prisma.sigProcedimiento.count({ where: { areaId: id } })
  if (count > 0) {
    res.status(409).json({ error: "No se puede eliminar un área con procedimientos. Mueve o elimina los procedimientos primero." })
    return
  }
  await prisma.sigArea.delete({ where: { id } })
  res.status(204).send()
})

export default router
