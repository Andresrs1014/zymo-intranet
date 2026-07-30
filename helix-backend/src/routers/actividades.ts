import { Router } from "express"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "../config/prisma"
import multer from "multer"
import path from "path"
import fs from "fs"
import { env } from "../config/env"
import { getUserId } from "../middleware/auth"
import { crearActividadCompleta, actualizarActividad, ActividadValidationError } from "../services/actividadService"
import { COLUMNS, PRIORITIES } from "../utils/constants"

const router = Router()

// --- Multer setup for evidencias ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(env.UPLOAD_DIR)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `evidencia_${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".docx", ".xlsx"]
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

const ActividadBase = {
  subproyectoId: z.number().int().positive(),
  numeroActividad: z.string().max(30).nullable().optional(),
  responsableId: z.number().int().positive(),
  responsableNombre: z.string().min(1),
  responsableInitials: z.string().min(1).max(3),
  responsableColor: z.string().default("#5461c8"),
  nombre: z.string().min(1).max(100),
  estado: z.enum(COLUMNS).default("Backlog"),
  prioridad: z.enum(PRIORITIES).default("Media"),
  fechaInicio: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  fechaFin: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  avance: z.number().int().min(0).max(100).default(0),
  puntos: z.number().int().min(1).max(21).default(3),
  costoInversion: z.number().min(0).default(0),
  costoOptimizacion: z.number().min(0).default(0),
  costoEjecucion: z.number().min(0).default(0),
  bloqueada: z.boolean().default(false),
  dependenciaId: z.number().int().positive().nullable().optional(),
}

// POST body — the "Gestión de proyecto" form covers actividad + subactividades +
// comentario inicial in one submit, matching the original single-form intent.
const ActividadCreateBody = z.object({
  ...ActividadBase,
  subactividades: z
    .array(
      z.object({
        nombre: z.string().min(1).max(150),
        responsableId: z.number().int().positive().nullable().optional(),
        responsableNombre: z.string().max(100).nullable().optional(),
        estado: z.enum(COLUMNS).default("Planificado"),
      })
    )
    .optional(),
  comentarioInicial: z.string().max(2000).optional(),
})

// PUT body — only the actividad's own fields. Subactividades/comentarios/evidencias
// are edited afterward through their own dedicated endpoints, not re-embedded here.
const ActividadUpdateBody = z.object(ActividadBase)

const EstadoBody = z.object({
  estado: z.enum(COLUMNS),
})

const AvanceBody = z.object({
  avance: z.number().int().min(0).max(100),
})

// GET / — list actividades with optional filters
router.get("/", async (req, res, next) => {
  try {
    const { subproyectoId, estado, responsableId, bloqueada } = req.query

    // Build filter dynamically
    const where: Prisma.HelixActividadWhereInput = {}
    if (subproyectoId !== undefined) {
      const parsed = parseInt(subproyectoId as string, 10)
      if (!isNaN(parsed)) where.subproyectoId = parsed
    }
    if (estado !== undefined) {
      if ((COLUMNS as readonly string[]).includes(estado as string)) {
        where.estado = estado as string
      }
      // silently ignore invalid estado values
    }
    if (responsableId !== undefined) {
      const parsed = parseInt(responsableId as string, 10)
      if (!isNaN(parsed)) where.responsableId = parsed
    }
    if (bloqueada !== undefined) {
      where.bloqueada = bloqueada === "true"
    }

    const items = await prisma.helixActividad.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

// POST / — create actividad (+ subactividades + comentario inicial, opcional)
router.post("/", async (req, res, next) => {
  try {
    const parsed = ActividadCreateBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }

    const autorId = getUserId(req.user!)
    const autorNombre = req.user!.full_name ?? req.user!.email ?? "Usuario"

    const item = await crearActividadCompleta(parsed.data, { id: autorId, nombre: autorNombre })
    res.status(201).json(item)
  } catch (err) {
    if (err instanceof ActividadValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    next(err)
  }
})

// GET /:id — get single actividad with comentarios and evidencias
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const item = await prisma.helixActividad.findUnique({
      where: { id },
      include: {
        subactividades: { orderBy: { createdAt: "asc" } },
        comentarios: { orderBy: { createdAt: "asc" } },
        evidencias: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!item) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// PUT /:id — update actividad's own fields (subactividades/comentarios/evidencias
// are managed through their own endpoints, not through this one)
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = ActividadUpdateBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }

    const item = await actualizarActividad(id, parsed.data)
    if (!item) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    res.json(item)
  } catch (err) {
    if (err instanceof ActividadValidationError) {
      res.status(400).json({ error: err.message })
      return
    }
    next(err)
  }
})

// DELETE /:id — delete actividad
router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }
    await prisma.helixActividad.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/estado — update only estado field
router.patch("/:id/estado", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = EstadoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const updateData: Prisma.HelixActividadUpdateInput = { estado: parsed.data.estado }
    if (parsed.data.estado === "Terminado" && existing.estado !== "Terminado") {
      updateData.completadaEn = new Date()
    }

    const item = await prisma.helixActividad.update({
      where: { id },
      data: updateData,
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/avance — update only avance field
router.patch("/:id/avance", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = AvanceBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const item = await prisma.helixActividad.update({
      where: { id },
      data: { avance: parsed.data.avance },
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

// POST /:id/evidencias — upload file
router.post("/:id/evidencias", upload.single("archivo"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return }

    if (!req.file) { res.status(400).json({ error: "Archivo requerido" }); return }

    const actividad = await prisma.helixActividad.findUnique({ where: { id } })
    if (!actividad) { res.status(404).json({ error: "No encontrado" }); return }

    const evidencia = await prisma.helixEvidencia.create({
      data: {
        actividadId: id,
        nombre: req.file.originalname,
        tipoArchivo: req.file.mimetype,
        tamanio: req.file.size,
        ruta: req.file.filename,
      },
    })
    res.status(201).json(evidencia)
  } catch (err) {
    next(err)
  }
})

// DELETE /:id/evidencias/:evidenciaId
router.delete("/:id/evidencias/:evidenciaId", async (req, res, next) => {
  try {
    const evidenciaId = parseInt(req.params.evidenciaId, 10)
    if (isNaN(evidenciaId)) { res.status(400).json({ error: "ID inválido" }); return }

    const ev = await prisma.helixEvidencia.findUnique({ where: { id: evidenciaId } })
    if (!ev) { res.status(404).json({ error: "No encontrado" }); return }

    const safeName = path.basename(ev.ruta) // prevent path traversal
    const filePath = path.join(path.resolve(env.UPLOAD_DIR), safeName)
    fs.unlink(filePath, () => undefined)

    await prisma.helixEvidencia.delete({ where: { id: evidenciaId } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
