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
    issues:                z.array(z.any()).default([]),
    flujogramaConsistente: z.boolean().nullable().optional(),
    flujogramaDiff:        z.string().nullable().optional(),
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
    markdownMejorado: z.string().nullable().optional(),
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

// ── POST /api/analisis/cargos ─────────────────────────────────────────────────
router.post("/cargos", requireSigAccess, async (req: Request, res: Response) => {
  const Schema = z.object({
    procedimientoId: z.number().int().positive(),
    cargos:          z.array(z.object({
      cargo:       z.string(),
      funciones:   z.array(z.string()).default([]),
      mencionadoEn: z.array(z.string()).default([]),
    })).default([]),
    resumen:         z.string(),
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

  const result = await prisma.sigAnalisisCargos.create({
    data: { ...parsed.data, autorId, autorNombre },
  })
  res.status(201).json(result)
})

// ── GET /api/analisis/cargos?procedimientoId= ─────────────────────────────────
router.get("/cargos", async (req: Request, res: Response) => {
  const { procedimientoId } = req.query
  const analisis = await prisma.sigAnalisisCargos.findMany({
    where: procedimientoId
      ? { procedimientoId: parseInt(procedimientoId as string) }
      : {},
    orderBy: { createdAt: "desc" },
    take: 10,
  })
  res.json(analisis)
})

// ── GET /api/analisis/historial — todos los tipos combinados ──────────────────
router.get("/historial", async (req: Request, res: Response) => {
  const { tipo, procedimientoId, limit } = req.query
  const take      = limit ? parseInt(limit as string) : 100
  const pidFilter = procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}

  const include = {
    procedimiento: {
      select: {
        codigo: true,
        titulo: true,
        area: { select: { nombre: true, color: true } },
      },
    },
  }

  const [coherencias, mejoras, procVsInst, cargos] = await Promise.all([
    (!tipo || tipo === "coherencia")
      ? prisma.sigAnalisisCoherencia.findMany({ where: pidFilter, orderBy: { createdAt: "desc" }, take, include })
      : Promise.resolve([]),
    (!tipo || tipo === "mejoras")
      ? prisma.sigAnalisisMejoras.findMany({ where: pidFilter, orderBy: { createdAt: "desc" }, take, include })
      : Promise.resolve([]),
    (!tipo || tipo === "proc-vs-inst")
      ? prisma.sigAnalisisProcVsInst.findMany({ where: pidFilter, orderBy: { createdAt: "desc" }, take, include })
      : Promise.resolve([]),
    (!tipo || tipo === "cargos")
      ? prisma.sigAnalisisCargos.findMany({ where: pidFilter, orderBy: { createdAt: "desc" }, take, include })
      : Promise.resolve([]),
  ])

  const combined = [
    ...coherencias.map((a) => ({ ...a, tipo: "coherencia" as const })),
    ...mejoras.map((a)    => ({ ...a, tipo: "mejoras"    as const })),
    ...procVsInst.map((a) => ({ ...a, tipo: "proc-vs-inst" as const })),
    ...cargos.map((a)     => ({ ...a, tipo: "cargos"      as const })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, take)

  res.json(combined)
})

export default router
