import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"

const router = Router()

const InstructivoSchema = z.object({
  procedimientoId:  z.number().int().positive(),
  codigo:           z.string().min(1).max(50),
  titulo:           z.string().min(1).max(255),
  descripcion:      z.string().max(1000).optional(),
  contenido:        z.string().min(1),
  contenidoOriginal: z.string().optional(),
  versionDoc:       z.string().default("1.0"),
})

// GET /api/instructivos?procedimientoId=&activo=
router.get("/", async (req: Request, res: Response) => {
  const { procedimientoId, activo } = req.query
  if (!procedimientoId) {
    res.status(400).json({ error: "procedimientoId es requerido" })
    return
  }
  const instructivos = await prisma.sigInstructivo.findMany({
    where: {
      procedimientoId: parseInt(procedimientoId as string),
      ...(activo !== undefined ? { activo: activo === "true" } : {}),
    },
    orderBy: { createdAt: "asc" },
  })
  res.json(instructivos)
})

// GET /api/instructivos/:id
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const inst = await prisma.sigInstructivo.findUnique({ where: { id } })
  if (!inst) {
    res.status(404).json({ error: "Instructivo no encontrado" })
    return
  }
  res.json(inst)
})

// POST /api/instructivos — carga uno o varios (bulk)
router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const isBulk = Array.isArray(req.body)
  const items = isBulk ? req.body : [req.body]

  const autorId = getUserId(req.user!)
  const autorNombre = req.user!.full_name ?? req.user!.email ?? "Desconocido"

  const results = []
  const errors  = []

  for (const item of items) {
    const parsed = InstructivoSchema.safeParse(item)
    if (!parsed.success) {
      errors.push({ item, error: parsed.error.flatten() })
      continue
    }

    const proc = await prisma.sigProcedimiento.findUnique({
      where: { id: parsed.data.procedimientoId },
    })
    if (!proc) {
      errors.push({ item, error: "Procedimiento no encontrado" })
      continue
    }

    const created = await prisma.sigInstructivo.create({
      data: {
        ...parsed.data,
        autorId,
        autorNombre,
      },
    })
    results.push(created)
  }

  const status =
    errors.length === 0 ? 201 :
    errors.length === items.length ? 422 : 207

  res.status(status).json({ created: results, errors })
})

// PATCH /api/instructivos/:id
router.patch("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)

  const UpdateSchema = z.object({
    titulo:            z.string().max(255).optional(),
    descripcion:       z.string().max(1000).optional(),
    contenido:         z.string().optional(),
    contenidoOriginal: z.string().optional(),
    versionDoc:        z.string().optional(),
    activo:            z.boolean().optional(),
  })

  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }

  try {
    const inst = await prisma.sigInstructivo.update({
      where: { id },
      data: parsed.data,
    })
    res.json(inst)
  } catch {
    res.status(404).json({ error: "Instructivo no encontrado" })
  }
})

// DELETE /api/instructivos/:id — soft delete (activo=false) o hard (admin)
router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id   = parseInt(req.params.id)
  const hard = req.query.hard === "true" && req.user?.role === "admin"

  try {
    if (hard) {
      await prisma.sigInstructivo.delete({ where: { id } })
      res.status(204).send()
    } else {
      const inst = await prisma.sigInstructivo.update({
        where: { id },
        data: { activo: false },
      })
      res.json(inst)
    }
  } catch {
    res.status(404).json({ error: "Instructivo no encontrado" })
  }
})

export default router
