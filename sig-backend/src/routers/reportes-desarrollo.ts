import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import prisma from "../config/prisma"
import { getUserId } from "../middleware/auth"
import { resolveActorName } from "../utils/userNames"

const router = Router()

// Reportes de Desarrollo — módulo exclusivo de admin (decisión definitiva,
// 2026-07-24). Todo el router queda detrás de este gate, lectura incluida.
router.use((req: Request, res: Response, next) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Reportes de desarrollo — solo administradores" })
    return
  }
  next()
})

// ── Multer — almacenamiento de archivos .md originales ────────────────────────
// Mismo directorio que instructivos/commits para aprovechar el volumen Docker.

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `rep_${Date.now()}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — el .md es texto plano
  fileFilter: (_req, file, cb) => {
    const allowed = [".md", ".markdown", ".txt"]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error("Solo se permiten archivos .md, .markdown o .txt"))
  },
})

// ── GET /api/reportes-desarrollo ──────────────────────────────────────────────
// Lista reportes. Filtros: ?proyecto=Helix&autorId=42
router.get("/", async (req: Request, res: Response) => {
  const { proyecto, autorId } = req.query
  const where: Record<string, unknown> = {}
  if (proyecto) where.proyecto = String(proyecto)
  if (autorId) where.autorId = parseInt(String(autorId))

  const reportes = await prisma.sigReporteDesarrollo.findMany({
    where,
    orderBy: { fechaReporte: "desc" },
  })
  res.json(reportes)
})

// ── GET /api/reportes-desarrollo/proyectos ────────────────────────────────────
// Lista distinta de proyectos (para el filtro).
router.get("/proyectos", async (_req: Request, res: Response) => {
  const result = await prisma.sigReporteDesarrollo.findMany({
    distinct: ["proyecto"],
    select: { proyecto: true },
    orderBy: { proyecto: "asc" },
  })
  res.json(result.map((r) => r.proyecto))
})

// ── GET /api/reportes-desarrollo/:id ──────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const reporte = await prisma.sigReporteDesarrollo.findUnique({ where: { id } })
  if (!reporte) {
    res.status(404).json({ error: "Reporte no encontrado" })
    return
  }
  res.json(reporte)
})

// ── POST /api/reportes-desarrollo ─────────────────────────────────────────────
// Crea un reporte. Acepta upload de archivo .md (campo "archivo") opcional.
// Si se sube archivo, su contenido se copia a contenidoMd.
// Si no se sube archivo pero llega contenidoMd en el body, se usa ese.
// Llega como multipart/form-data — todo campo aparece como string en
// req.body, incluidos los numéricos. z.coerce.number() los convierte antes
// de validar (z.number() a secas siempre rechazaba "0", "50", etc.).
const CrearSchema = z.object({
  titulo: z.string().min(1).max(255),
  descripcion: z.string().max(1000).optional(),
  proyecto: z.string().min(1).max(100),
  contenidoMd: z.string().optional(),
  porcentajeAvance: z.coerce.number().int().min(0).max(100),
  tiempoEstimadoHoras: z.coerce.number().positive().optional(),
  tiempoRealHoras: z.coerce.number().positive().optional(),
  fechaReporte: z.string().datetime().optional(),
})

router.post("/", upload.single("archivo"), async (req: Request, res: Response) => {
  try {
    const data = CrearSchema.parse(req.body)

    // Si hay archivo, leer su contenido
    let contenidoMd = data.contenidoMd ?? ""
    if (req.file) {
      contenidoMd = await fs.readFile(req.file.path, "utf8")
    }

    if (!contenidoMd.trim()) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {})
      res.status(400).json({
        error: "El reporte debe tener contenido (archivo .md o campo contenidoMd)",
      })
      return
    }

    const userId = getUserId(req.user!)
    const userName = await resolveActorName(userId, req.user!.full_name)

    const reporte = await prisma.sigReporteDesarrollo.create({
      data: {
        titulo: data.titulo,
        descripcion: data.descripcion,
        proyecto: data.proyecto,
        contenidoMd,
        porcentajeAvance: data.porcentajeAvance,
        tiempoEstimadoHoras: data.tiempoEstimadoHoras,
        tiempoRealHoras: data.tiempoRealHoras,
        fechaReporte: data.fechaReporte ? new Date(data.fechaReporte) : new Date(),
        autorId: userId,
        autorNombre: userName,
        archivoOriginal: req.file?.filename,
        nombreArchivo: req.file?.originalname,
        tipoMime: req.file?.mimetype,
      },
    })

    res.status(201).json(reporte)
  } catch (err) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {})
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Datos inválidos", details: err.errors })
      return
    }
    throw err
  }
})

// ── PATCH /api/reportes-desarrollo/:id ────────────────────────────────────────
const EditarSchema = z.object({
  titulo: z.string().min(1).max(255).optional(),
  descripcion: z.string().max(1000).optional(),
  proyecto: z.string().min(1).max(100).optional(),
  contenidoMd: z.string().optional(),
  porcentajeAvance: z.coerce.number().int().min(0).max(100).optional(),
  tiempoEstimadoHoras: z.coerce.number().positive().optional(),
  tiempoRealHoras: z.coerce.number().positive().optional(),
  fechaReporte: z.string().datetime().optional(),
})

router.patch(
  "/:id",
  upload.single("archivo"),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id)
    const existing = await prisma.sigReporteDesarrollo.findUnique({ where: { id } })
    if (!existing) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {})
      res.status(404).json({ error: "Reporte no encontrado" })
      return
    }

    try {
      const data = EditarSchema.parse(req.body)

      // Si se subió archivo nuevo, leer contenido y borrar el anterior
      let contenidoMd = data.contenidoMd
      if (req.file) {
        contenidoMd = await fs.readFile(req.file.path, "utf8")
        if (existing.archivoOriginal) {
          const oldPath = path.join(UPLOADS_DIR, existing.archivoOriginal)
          await fs.unlink(oldPath).catch(() => {})
        }
      }

      const reporte = await prisma.sigReporteDesarrollo.update({
        where: { id },
        data: {
          ...(data.titulo !== undefined && { titulo: data.titulo }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
          ...(data.proyecto !== undefined && { proyecto: data.proyecto }),
          ...(contenidoMd !== undefined && { contenidoMd }),
          ...(data.porcentajeAvance !== undefined && { porcentajeAvance: data.porcentajeAvance }),
          ...(data.tiempoEstimadoHoras !== undefined && { tiempoEstimadoHoras: data.tiempoEstimadoHoras }),
          ...(data.tiempoRealHoras !== undefined && { tiempoRealHoras: data.tiempoRealHoras }),
          ...(data.fechaReporte !== undefined && { fechaReporte: new Date(data.fechaReporte) }),
          ...(req.file && {
            archivoOriginal: req.file.filename,
            nombreArchivo: req.file.originalname,
            tipoMime: req.file.mimetype,
          }),
        },
      })

      res.json(reporte)
    } catch (err) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {})
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Datos inválidos", details: err.errors })
        return
      }
      throw err
    }
  },
)

// ── DELETE /api/reportes-desarrollo/:id ───────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const existing = await prisma.sigReporteDesarrollo.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: "Reporte no encontrado" })
    return
  }

  // Borrar el archivo asociado si existe
  if (existing.archivoOriginal) {
    const filePath = path.join(UPLOADS_DIR, existing.archivoOriginal)
    await fs.unlink(filePath).catch(() => {})
  }

  await prisma.sigReporteDesarrollo.delete({ where: { id } })
  res.json({ ok: true })
})

// ── GET /api/reportes-desarrollo/:id/archivo ──────────────────────────────────
// Descarga el archivo .md original adjunto al reporte.
router.get("/:id/archivo", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const reporte = await prisma.sigReporteDesarrollo.findUnique({ where: { id } })
  if (!reporte?.archivoOriginal) {
    res.status(404).json({ error: "Este reporte no tiene archivo adjunto" })
    return
  }

  const filePath = path.join(UPLOADS_DIR, reporte.archivoOriginal)
  try {
    await fs.access(filePath)
    res.download(filePath, reporte.nombreArchivo ?? reporte.archivoOriginal)
  } catch {
    res.status(410).json({ error: "Archivo original ya no disponible" })
  }
})

export default router
