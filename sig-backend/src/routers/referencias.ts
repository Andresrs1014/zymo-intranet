import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess } from "../middleware/auth"

const router = Router()

const OrigenTipo = z.enum(["procedimiento", "instructivo", "protocolo", "formato"])
const DestinoTipo = z.enum(["procedimiento", "instructivo", "protocolo", "formato", "area"])
const Estado = z.enum(["resuelta", "ausente", "otra_area", "otro_codigo"])

const BodySchema = z.object({
  procedimientoId: z.number().int().positive(),
  origenTipo: OrigenTipo,
  origenId: z.number().int().positive(),
  destinoTipo: DestinoTipo,
  destinoCodigo: z.string().min(1).max(80),
  destinoId: z.number().int().positive().nullable().optional(),
  estado: Estado,
  nota: z.string().max(2000).nullable().optional(),
  frase: z.string().max(500).nullable().optional(),
}).superRefine((body, ctx) => {
  if (body.estado === "resuelta" && (body.destinoId == null || body.destinoTipo === "area")) {
    ctx.addIssue({ code: "custom", message: "Una cita resuelta necesita un documento destino", path: ["destinoId"] })
  }
  if ((body.estado === "ausente" || body.estado === "otra_area") && body.destinoId != null) {
    ctx.addIssue({ code: "custom", message: "Esa cita no tiene archivo destino", path: ["destinoId"] })
  }
})

router.get("/", async (req: Request, res: Response) => {
  const procedimientoId = req.query.procedimientoId ? parseInt(req.query.procedimientoId as string) : undefined
  const rows = await prisma.sigReferencia.findMany({
    where: { ...(procedimientoId ? { procedimientoId } : {}) },
    orderBy: [{ estado: "asc" }, { destinoCodigo: "asc" }],
  })
  res.json(rows)
})

router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }
  const proc = await prisma.sigProcedimiento.findUnique({ where: { id: parsed.data.procedimientoId } })
  if (!proc) {
    res.status(404).json({ error: "Procedimiento no encontrado" })
    return
  }
  const origenOk = await origenEsDelProcedimiento(parsed.data.procedimientoId, parsed.data.origenTipo, parsed.data.origenId)
  if (!origenOk) {
    res.status(422).json({ error: "El origen no pertenece a ese procedimiento" })
    return
  }
  if (parsed.data.estado === "resuelta") {
    const destOk = await destinoExiste(parsed.data.destinoTipo, parsed.data.destinoId!)
    if (!destOk) {
      res.status(422).json({ error: "El destino no existe" })
      return
    }
  }

  const data = {
    procedimientoId: parsed.data.procedimientoId,
    origenTipo: parsed.data.origenTipo,
    origenId: parsed.data.origenId,
    destinoTipo: parsed.data.destinoTipo,
    destinoCodigo: parsed.data.destinoCodigo,
    destinoId: parsed.data.destinoId ?? null,
    estado: parsed.data.estado,
    nota: parsed.data.nota ?? null,
    frase: parsed.data.frase ?? null,
  }
  const prev = await prisma.sigReferencia.findFirst({
    where: {
      origenTipo: data.origenTipo,
      origenId: data.origenId,
      destinoTipo: data.destinoTipo,
      destinoCodigo: data.destinoCodigo,
    },
  })
  const row = prev
    ? await prisma.sigReferencia.update({ where: { id: prev.id }, data })
    : await prisma.sigReferencia.create({ data })
  res.status(prev ? 200 : 201).json(row)
})

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  try {
    await prisma.sigReferencia.delete({ where: { id: parseInt(req.params.id) } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "Referencia no encontrada" })
  }
})

export default router

async function origenEsDelProcedimiento(procedimientoId: number, tipo: string, origenId: number): Promise<boolean> {
  if (tipo === "procedimiento") return origenId === procedimientoId
  if (tipo === "instructivo") {
    const row = await prisma.sigInstructivo.findUnique({ where: { id: origenId }, select: { procedimientoId: true } })
    return row?.procedimientoId === procedimientoId
  }
  if (tipo === "protocolo") {
    const row = await prisma.sigProtocolo.findUnique({ where: { id: origenId }, select: { procedimientoId: true } })
    return row?.procedimientoId === procedimientoId
  }
  const row = await prisma.sigFormato.findUnique({ where: { id: origenId }, select: { procedimientoId: true } })
  return row?.procedimientoId === procedimientoId
}

async function destinoExiste(tipo: string, id: number): Promise<boolean> {
  if (tipo === "procedimiento") return !!(await prisma.sigProcedimiento.findUnique({ where: { id }, select: { id: true } }))
  if (tipo === "instructivo") return !!(await prisma.sigInstructivo.findUnique({ where: { id }, select: { id: true } }))
  if (tipo === "protocolo") return !!(await prisma.sigProtocolo.findUnique({ where: { id }, select: { id: true } }))
  if (tipo === "formato") return !!(await prisma.sigFormato.findUnique({ where: { id }, select: { id: true } }))
  return false
}
