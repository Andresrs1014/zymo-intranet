import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { getUserId, requireSigAccess, requireGerente } from "../middleware/auth"

const router = Router()

const ProcedimientoSchema = z.object({
  areaId: z.number().int().positive(),
  codigo: z.string().min(1).max(50),
  titulo: z.string().min(1).max(255),
  descripcion: z.string().max(1000).optional(),
})

const UpdateSchema = ProcedimientoSchema.partial().omit({ areaId: true })

// GET /api/procedimientos — lista con filtros opcionales
router.get("/", async (req: Request, res: Response) => {
  const { areaId, estado, q } = req.query

  const procedimientos = await prisma.sigProcedimiento.findMany({
    where: {
      ...(areaId ? { areaId: parseInt(areaId as string) } : {}),
      ...(estado ? { estado: estado as any } : {}),
      ...(q ? {
        OR: [
          { titulo: { contains: q as string, mode: "insensitive" } },
          { codigo: { contains: q as string, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      area: { select: { id: true, nombre: true, color: true } },
      _count: { select: { commits: true } },
    },
    orderBy: [{ areaId: "asc" }, { codigo: "asc" }],
  })
  res.json(procedimientos)
})

// GET /api/procedimientos/:id — detalle con último commit
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const proc = await prisma.sigProcedimiento.findUnique({
    where: { id },
    include: {
      area: true,
      commits: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, mensaje: true, autorNombre: true, estado: true,
          sinCambios: true, versionDoc: true, createdAt: true,
        },
      },
    },
  })
  if (!proc) { res.status(404).json({ error: "Procedimiento no encontrado" }); return }
  res.json(proc)
})

// POST /api/procedimientos — SIG, admin, gerente
router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = ProcedimientoSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  // Verificar que el área existe
  const area = await prisma.sigArea.findUnique({ where: { id: parsed.data.areaId } })
  if (!area) { res.status(422).json({ error: "El área especificada no existe. Crea el área primero." }); return }

  // Verificar código único
  const existe = await prisma.sigProcedimiento.findUnique({ where: { codigo: parsed.data.codigo } })
  if (existe) { res.status(409).json({ error: "Ya existe un procedimiento con ese código." }); return }

  const proc = await prisma.sigProcedimiento.create({ data: parsed.data })
  res.status(201).json(proc)
})

// PATCH /api/procedimientos/:id — SIG, admin, gerente
router.patch("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)

  const EstadoSchema = z.object({ estado: z.enum(["BORRADOR", "VIGENTE", "OBSOLETO"]) }).optional()
  const parsed = UpdateSchema.merge(EstadoSchema.unwrap() ?? z.object({})).partial().safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const proc = await prisma.sigProcedimiento.update({ where: { id }, data: parsed.data as any })
  res.json(proc)
})

// GET /api/procedimientos/:id/sync — último commit aprobado para sincronización con NetVault
router.get("/:id/sync", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const proc = await prisma.sigProcedimiento.findUnique({
    where: { id },
    include: {
      area: true,
      commits: {
        where: { estado: "APROBADO" },
        orderBy: { aprobadoEn: "desc" },
        take: 1,
        select: {
          id: true,
          contenidoAgente: true,
          flujogramaMmd: true,
          mensaje: true,
          autorNombre: true,
          aprobadoNombre: true,
          aprobadoEn: true,
          versionDoc: true,
          createdAt: true,
        },
      },
    },
  })
  if (!proc) { res.status(404).json({ error: "Procedimiento no encontrado" }); return }

  const latest = proc.commits[0] ?? null
  res.json({
    procedimientoId: proc.id,
    codigo: proc.codigo,
    titulo: proc.titulo,
    estado: proc.estado,
    area: { nombre: proc.area.nombre, color: proc.area.color },
    latestApproved: latest ? {
      commitId:        latest.id,
      contenidoAgente: latest.contenidoAgente,
      flujogramaMmd:   latest.flujogramaMmd,
      mensaje:         latest.mensaje,
      autorNombre:     latest.autorNombre,
      aprobadoNombre:  latest.aprobadoNombre,
      aprobadoEn:      latest.aprobadoEn,
      versionDoc:      latest.versionDoc,
      createdAt:       latest.createdAt,
    } : null,
  })
})

// DELETE /api/procedimientos/:id — admin o gerente
router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin" && role !== "gerente") {
    res.status(403).json({ error: "Solo admin o gerente puede eliminar procedimientos" })
    return
  }

  const id = parseInt(req.params.id)
  try {
    await prisma.sigProcedimiento.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "Procedimiento no encontrado" })
  }
})

export default router
