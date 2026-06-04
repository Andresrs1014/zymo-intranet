import { Router, Request, Response } from "express"
import { z } from "zod"
import { createTwoFilesPatch } from "diff"
import prisma from "../config/prisma"
import { getUserId, requireSigAccess, requireGerente } from "../middleware/auth"
import { sendAprobacionEmail } from "../services/email"

const router = Router()

const CommitSchema = z.object({
  procedimientoId: z.number().int().positive(),
  contenidoOriginal: z.string().min(1),
  contenidoAgente: z.string().min(1),
  flujogramaMmd: z.string().optional(),
  sinCambios: z.boolean().default(false),
  mensaje: z.string().min(1).max(500),
  versionDoc: z.string().max(20).optional(),
})

// GET /api/commits — lista commits con filtros (para la cola de revisión)
router.get("/", async (req: Request, res: Response) => {
  const { procedimientoId, estado, limit } = req.query

  const commits = await prisma.sigCommit.findMany({
    where: {
      ...(procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}),
      ...(estado ? { estado: estado as any } : {}),
    },
    include: {
      procedimiento: {
        select: { id: true, codigo: true, titulo: true, area: { select: { nombre: true, color: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit ? parseInt(limit as string) : 50,
  })
  res.json(commits)
})

// GET /api/commits/pendientes — commits pendientes de revisión (para badge del Gerente)
router.get("/pendientes", requireGerente, async (_req: Request, res: Response) => {
  const commits = await prisma.sigCommit.findMany({
    where: { estado: "PENDIENTE_REVISION" },
    include: {
      procedimiento: {
        select: {
          id: true, codigo: true, titulo: true,
          area: { select: { nombre: true, color: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })
  res.json(commits)
})

// GET /api/commits/:id — detalle completo con contenidos para el diff viewer
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const commit = await prisma.sigCommit.findUnique({
    where: { id },
    include: {
      procedimiento: {
        select: {
          id: true, codigo: true, titulo: true, estado: true,
          area: { select: { nombre: true, color: true } },
        },
      },
    },
  })
  if (!commit) { res.status(404).json({ error: "Commit no encontrado" }); return }

  // Calcular diff unificado en el servidor
  const patch = createTwoFilesPatch(
    "original.md",
    "agente.md",
    commit.contenidoOriginal,
    commit.contenidoAgente,
    "Documento original",
    "Procesado por IA",
    { context: 4 }
  )

  res.json({ ...commit, patch })
})

// POST /api/commits — NetVault (o web) envía un nuevo commit
router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = CommitSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const userId = getUserId(req.user!)
  const userName = req.user!.full_name ?? req.user!.email ?? "Usuario"

  // Verificar que el procedimiento existe
  const proc = await prisma.sigProcedimiento.findUnique({
    where: { id: parsed.data.procedimientoId },
  })
  if (!proc) {
    res.status(422).json({ error: "Procedimiento no encontrado. Crea el procedimiento primero." })
    return
  }

  const commit = await prisma.sigCommit.create({
    data: {
      procedimientoId: parsed.data.procedimientoId,
      contenidoOriginal: parsed.data.contenidoOriginal,
      contenidoAgente: parsed.data.contenidoAgente,
      flujogramaMmd: parsed.data.flujogramaMmd,
      sinCambios: parsed.data.sinCambios,
      mensaje: parsed.data.mensaje,
      autorId: userId,
      autorNombre: userName,
      versionDoc: parsed.data.versionDoc,
      estado: "PENDIENTE_REVISION",
    },
    include: {
      procedimiento: { select: { codigo: true, titulo: true } },
    },
  })

  res.status(201).json(commit)
})

// POST /api/commits/:id/aprobar — solo Gerente o Admin
router.post("/:id/aprobar", requireGerente, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const userId = getUserId(req.user!)
  const userName = req.user!.full_name ?? req.user!.email ?? "Gerente"

  const commit = await prisma.sigCommit.findUnique({
    where: { id },
    include: { procedimiento: { select: { id: true, codigo: true, titulo: true } } },
  })
  if (!commit) { res.status(404).json({ error: "Commit no encontrado" }); return }
  if (commit.estado !== "PENDIENTE_REVISION") {
    res.status(409).json({ error: "Este commit ya fue procesado" }); return
  }

  await prisma.$transaction([
    prisma.sigCommit.update({
      where: { id },
      data: {
        estado: "APROBADO",
        aprobadoPor: userId,
        aprobadoNombre: userName,
        aprobadoEn: new Date(),
      },
    }),
    // El procedimiento pasa a VIGENTE automáticamente al aprobar
    prisma.sigProcedimiento.update({
      where: { id: commit.procedimientoId },
      data: { estado: "VIGENTE" },
    }),
  ])

  // Notificación por email (no bloqueante)
  sendAprobacionEmail({
    codigo: commit.procedimiento.codigo,
    titulo: commit.procedimiento.titulo,
    aprobadoPor: userName,
    mensaje: commit.mensaje,
  }).catch((err) => console.error("Error enviando email de aprobación:", err))

  res.json({ ok: true })
})

// POST /api/commits/:id/rechazar — solo Gerente o Admin
router.post("/:id/rechazar", requireGerente, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const userId = getUserId(req.user!)
  const userName = req.user!.full_name ?? req.user!.email ?? "Gerente"

  const { comentario } = z.object({ comentario: z.string().min(1).max(1000) }).parse(req.body)

  const commit = await prisma.sigCommit.findUnique({ where: { id } })
  if (!commit) { res.status(404).json({ error: "Commit no encontrado" }); return }
  if (commit.estado !== "PENDIENTE_REVISION") {
    res.status(409).json({ error: "Este commit ya fue procesado" }); return
  }

  await prisma.sigCommit.update({
    where: { id },
    data: {
      estado: "RECHAZADO",
      aprobadoPor: userId,
      aprobadoNombre: userName,
      aprobadoEn: new Date(),
      comentarioRevision: comentario,
    },
  })

  res.json({ ok: true })
})

export default router
