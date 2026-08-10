import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import fs from "fs"
import prisma from "../config/prisma"
import { getUserId, requireSigAccess, requireGerente } from "../middleware/auth"
import { extractText } from "../services/textExtraction"

const router = Router()

const UPLOADS_PROC_DIR = path.join(process.cwd(), "uploads", "sig", "proc_pdf_tmp")
fs.mkdirSync(UPLOADS_PROC_DIR, { recursive: true })

const procStorage = multer.diskStorage({
  destination: UPLOADS_PROC_DIR,
  filename: (_, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `${Date.now()}-${safe}`)
  },
})
const uploadProcPdf = multer({
  storage: procStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".pdf")) cb(null, true)
    else cb(new Error("Solo se permiten archivos PDF"))
  },
})

// POST /api/procedimientos/:id/upload-pdf
// Sube un PDF, extrae su texto y lo devuelve para revision antes del commit.
router.post(
  "/:id/upload-pdf",
  requireSigAccess,
  uploadProcPdf.single("file"),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id)
    if (!req.file) {
      res.status(400).json({ error: "No se recibio archivo" })
      return
    }

    try {
      const proc = await prisma.sigProcedimiento.findUnique({ where: { id } })
      if (!proc) {
        await fs.promises.unlink(req.file.path).catch(() => {})
        res.status(404).json({ error: "Procedimiento no encontrado" })
        return
      }

      const { text, warnings } = await extractText(req.file.path, req.file.originalname)

      await fs.promises.unlink(req.file.path).catch(() => {})

      if (!text) {
        res.status(422).json({
          error: "No se pudo extraer texto del PDF",
          warnings,
        })
        return
      }

      res.json({
        texto_extraido: text,
        warnings,
        mensaje: "Texto extraido correctamente. Revisalo y crea el commit cuando este listo.",
      })
    } catch {
      await fs.promises.unlink(req.file?.path ?? "").catch(() => {})
      res.status(500).json({ error: "Error procesando el PDF" })
    }
  },
)
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
      cargosInvolucrados: { orderBy: { cargoNombre: "asc" } },
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

const CargosInvolucradosSchema = z.object({
  cargos: z.array(z.object({
    cargoId:     z.number().int().positive(),
    cargoNombre: z.string().min(1).max(150),
  })).max(50),
})

// GET /api/procedimientos/:id/cargos — cargos T&C asignados al procedimiento
router.get("/:id/cargos", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const cargos = await prisma.sigProcedimientoCargo.findMany({
    where: { procedimientoId: id },
    orderBy: { cargoNombre: "asc" },
  })
  res.json(cargos)
})

// PUT /api/procedimientos/:id/cargos — reemplaza la lista de cargos asignados
router.put("/:id/cargos", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const parsed = CargosInvolucradosSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const proc = await prisma.sigProcedimiento.findUnique({ where: { id }, select: { id: true } })
  if (!proc) { res.status(404).json({ error: "Procedimiento no encontrado" }); return }

  const seen = new Set<number>()
  for (const c of parsed.data.cargos) {
    if (seen.has(c.cargoId)) {
      res.status(422).json({ error: `Cargo duplicado: ${c.cargoNombre}` })
      return
    }
    seen.add(c.cargoId)
  }

  const cargos = await prisma.$transaction(async (tx) => {
    await tx.sigProcedimientoCargo.deleteMany({ where: { procedimientoId: id } })
    if (parsed.data.cargos.length === 0) return []
    await tx.sigProcedimientoCargo.createMany({
      data: parsed.data.cargos.map((c) => ({
        procedimientoId: id,
        cargoId: c.cargoId,
        cargoNombre: c.cargoNombre.trim(),
      })),
    })
    return tx.sigProcedimientoCargo.findMany({
      where: { procedimientoId: id },
      orderBy: { cargoNombre: "asc" },
    })
  })

  res.json(cargos)
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
          flujogramaImagenUrl: true,
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
      flujogramaImagenUrl: latest.flujogramaImagenUrl
        ? `/sig-api/api/commits/${latest.id}/flujograma-imagen`
        : null,
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
