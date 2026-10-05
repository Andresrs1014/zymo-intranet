import { Router, Request, Response } from "express"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import prisma from "../config/prisma"
import { requireSigAccess } from "../middleware/auth"

// Portado del PR #17 (2026-10-05) con correcciones de la revisión previa al push:
// GET con acceso SIG, ids validados y escritura atómica (upsert) para que dos POST iguales a la vez no den 500.

const router = Router()

const OrigenTipo = z.enum(["procedimiento", "instructivo", "protocolo", "formato"])
const DestinoTipo = z.enum(["procedimiento", "instructivo", "protocolo", "formato", "area"])
const Estado = z.enum(["resuelta", "ausente", "otra_area", "otro_codigo"])

export const ReferenciaBody = z.object({
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

router.get("/", requireSigAccess, async (req: Request, res: Response) => {
  const raw = req.query.procedimientoId
  let procedimientoId: number | undefined
  if (raw !== undefined && raw !== "") {
    procedimientoId = Number(raw)
    if (!Number.isInteger(procedimientoId) || procedimientoId <= 0) {
      res.status(400).json({ error: "procedimientoId debe ser un entero positivo" })
      return
    }
  }
  const rows = await prisma.sigReferencia.findMany({
    where: { ...(procedimientoId ? { procedimientoId } : {}) },
    orderBy: [{ estado: "asc" }, { destinoCodigo: "asc" }],
  })
  res.json(rows)
})

router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = ReferenciaBody.safeParse(req.body)
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
  const clave = {
    origenTipo_origenId_destinoTipo_destinoCodigo: {
      origenTipo: data.origenTipo,
      origenId: data.origenId,
      destinoTipo: data.destinoTipo,
      destinoCodigo: data.destinoCodigo,
    },
  }
  // El código HTTP solo informa si existía; la escritura es atómica (upsert por la clave única).
  const existia = await prisma.sigReferencia.findUnique({ where: clave, select: { id: true } })
  const row = await prisma.sigReferencia.upsert({ where: clave, create: data, update: data })
  res.status(existia ? 200 : 201).json(row)
})

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "id inválido" })
    return
  }
  try {
    await prisma.sigReferencia.delete({ where: { id } })
    res.status(204).send()
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      res.status(404).json({ error: "Referencia no encontrada" })
      return
    }
    throw e
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
