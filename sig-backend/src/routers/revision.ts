import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { getUserId, requireAprobador } from "../middleware/auth"
import { resolveActorName } from "../utils/userNames"

// Cola de revisión de lo que suben los líderes de área (formatos, instructivos y docs extra).
// Las versiones tienen su propia cola en /api/commits/pendientes.
const router = Router()
router.use(requireAprobador)

const tabla = { instructivo: prisma.sigInstructivo, formato: prisma.sigFormato, anexo: prisma.sigDocAnexo } as const
type Tipo = keyof typeof tabla
const procSel = { select: { id: true, codigo: true, titulo: true, area: { select: { nombre: true, color: true } } } } as const

router.get("/pendientes", async (_req: Request, res: Response) => {
  const where = { estado: "PENDIENTE_REVISION" as const }
  const orderBy = { createdAt: "asc" as const }
  const [ins, frm, anx] = await Promise.all([
    prisma.sigInstructivo.findMany({ where, orderBy, include: { procedimiento: procSel } }),
    prisma.sigFormato.findMany({ where, orderBy, include: { procedimiento: procSel } }),
    prisma.sigDocAnexo.findMany({ where, orderBy, include: { procedimiento: procSel } }),
  ])
  const nombre = (x: { nombre?: string; titulo?: string }) => x.nombre ?? x.titulo ?? ""
  const todos = [
    ...ins.map((x) => ({ ...x, tipo: "instructivo" as const })),
    ...frm.map((x) => ({ ...x, tipo: "formato" as const })),
    ...anx.map((x) => ({ ...x, tipo: "anexo" as const })),
  ].map((x) => ({
    tipo: x.tipo, id: x.id, nombre: nombre(x), nombreArchivo: x.nombreArchivo, autorNombre: x.autorNombre,
    createdAt: x.createdAt, procedimiento: x.procedimiento,
  }))
  res.json(todos.sort((a, b) => +a.createdAt - +b.createdAt))
})

async function resolver(req: Request, res: Response, estado: "APROBADO" | "RECHAZADO") {
  const tipo = req.params.tipo as Tipo
  const id = parseInt(req.params.id)
  if (!Object.prototype.hasOwnProperty.call(tabla, tipo) || !Number.isFinite(id)) { res.status(404).json({ error: "No encontrado" }); return }
  const motivo = z.object({ comentario: z.string().min(1).max(1000) }).safeParse(req.body)
  if (estado === "RECHAZADO" && !motivo.success) { res.status(422).json({ error: "Escribe el motivo del rechazo" }); return }
  const comentario = estado === "RECHAZADO" && motivo.success ? motivo.data.comentario : null
  const t = tabla[tipo] as typeof prisma.sigFormato // las tres tablas comparten estos campos
  const uid = getUserId(req.user!)
  // Un solo UPDATE condicionado: dos revisores a la vez no pueden resolver lo mismo dos veces.
  const { count } = await t.updateMany({
    where: { id, estado: "PENDIENTE_REVISION" },
    data: { estado, aprobadoNombre: await resolveActorName(uid, req.user!.full_name), aprobadoEn: new Date(), comentarioRevision: comentario },
  })
  if (count === 0) {
    const existe = await t.findUnique({ where: { id }, select: { id: true } })
    res.status(existe ? 409 : 404).json({ error: existe ? "Ya fue procesado" : "No encontrado" }); return
  }
  res.json({ ok: true })
}

router.post("/:tipo/:id/aprobar", (req, res) => resolver(req, res, "APROBADO"))
router.post("/:tipo/:id/rechazar", (req, res) => resolver(req, res, "RECHAZADO"))

export default router
