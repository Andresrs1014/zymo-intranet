import { Router } from "express"
import { z } from "zod"
import { prisma } from "../../config/prisma"

const router = Router()

const MetaBody = z.object({
  metaMensual: z.number().int().nonnegative().optional(),
  metaAnual: z.number().int().nonnegative().optional(),
  metaCierres: z.number().int().nonnegative().optional(),
  metaCitas: z.number().int().nonnegative().optional(),
})

// Lectura y edición para el socio externo (Skandia) — decisión del gerente
// (2026-07-28, revierte la anterior de "solo lectura"): cualquier persona
// con cuenta de socio puede ver Y editar la meta comercial, igual que el
// staff en /api/meta.
router.get("/", async (_req, res, next) => {
  try {
    const meta = await prisma.libertadoraMeta.findUnique({ where: { id: 1 } })
    res.json(meta ?? { id: 1, metaMensual: null, metaAnual: null, metaCierres: null, metaCitas: null })
  } catch (err) {
    next(err)
  }
})

router.put("/", async (req, res, next) => {
  try {
    const parsed = MetaBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const meta = await prisma.libertadoraMeta.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data },
      update: parsed.data,
    })
    res.json(meta)
  } catch (err) {
    next(err)
  }
})

export default router
