import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"

const router = Router()

// ── POST /api/analisis/coherencia ─────────────────────────────────────────────
router.post("/coherencia", requireSigAccess, async (req: Request, res: Response) => {
  const Schema = z.object({
    procedimientoId:       z.number().int().positive(),
    coherente:             z.boolean(),
    puntaje:               z.number().min(0).max(1).optional(),
    resumen:               z.string(),
    issues:                z.array(z.object({
      tipo:        z.string(),
      descripcion: z.string(),
      severidad:   z.enum(["critica", "alta", "media", "baja"]),
    })).default([]),
    flujogramaConsistente: z.boolean().optional(),
    flujogramaDiff:        z.string().optional(),
    tokensUsados:          z.number().optional(),
    modeloUsado:           z.string().optional(),
  })

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }

  const autorId     = getUserId(req.user!)
  const autorNombre = req.user!.full_name ?? req.user!.email ?? "Desconocido"

  const result = await prisma.sigAnalisisCoherencia.create({
    data: { ...parsed.data, autorId, autorNombre },
  })
  res.status(201).json(result)
})

// ── GET /api/analisis/coherencia?procedimientoId=&limit= ─────────────────────
router.get("/coherencia", async (req: Request, res: Response) => {
  const { procedimientoId, limit } = req.query
  const analisis = await prisma.sigAnalisisCoherencia.findMany({
    where: procedimientoId
      ? { procedimientoId: parseInt(procedimientoId as string) }
      : {},
    orderBy: { createdAt: "desc" },
    take: limit ? parseInt(limit as string) : 10,
  })
  res.json(analisis)
})

// ── POST /api/analisis/mejoras ────────────────────────────────────────────────
router.post("/mejoras", requireSigAccess, async (req: Request, res: Response) => {
  const Schema = z.object({
    procedimientoId:  z.number().int().positive(),
    findings:         z.array(z.any()).default([]),
    proposals:        z.array(z.any()).default([]),
    markdownMejorado: z.string().optional(),
    resumen:          z.string(),
    tokensUsados:     z.number().optional(),
    modeloUsado:      z.string().optional(),
  })

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }

  const autorId     = getUserId(req.user!)
  const autorNombre = req.user!.full_name ?? req.user!.email ?? "Desconocido"

  const result = await prisma.sigAnalisisMejoras.create({
    data: { ...parsed.data, autorId, autorNombre },
  })
  res.status(201).json(result)
})

// ── GET /api/analisis/mejoras?procedimientoId= ────────────────────────────────
router.get("/mejoras", async (req: Request, res: Response) => {
  const { procedimientoId } = req.query
  const analisis = await prisma.sigAnalisisMejoras.findMany({
    where: procedimientoId
      ? { procedimientoId: parseInt(procedimientoId as string) }
      : {},
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  res.json(analisis)
})

// ── POST /api/analisis/proc-vs-inst ──────────────────────────────────────────
router.post("/proc-vs-inst", requireSigAccess, async (req: Request, res: Response) => {
  const Schema = z.object({
    procedimientoId: z.number().int().positive(),
    instructivoIds:  z.array(z.number()).default([]),
    coherente:       z.boolean(),
    resumen:         z.string(),
    conflictos:      z.array(z.object({
      instructivoCodigo: z.string(),
      descripcion:       z.string(),
      severidad:         z.enum(["critica", "alta", "media", "baja"]),
    })).default([]),
    tokensUsados:    z.number().optional(),
    modeloUsado:     z.string().optional(),
  })

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }

  const autorId     = getUserId(req.user!)
  const autorNombre = req.user!.full_name ?? req.user!.email ?? "Desconocido"

  const result = await prisma.sigAnalisisProcVsInst.create({
    data: { ...parsed.data, autorId, autorNombre },
  })
  res.status(201).json(result)
})

// ── GET /api/analisis/proc-vs-inst?procedimientoId= ──────────────────────────
router.get("/proc-vs-inst", async (req: Request, res: Response) => {
  const { procedimientoId } = req.query
  const analisis = await prisma.sigAnalisisProcVsInst.findMany({
    where: procedimientoId
      ? { procedimientoId: parseInt(procedimientoId as string) }
      : {},
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  res.json(analisis)
})

export default router
