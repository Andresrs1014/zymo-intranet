import { Router } from "express"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "../config/prisma"
import multer from "multer"
import path from "path"
import fs from "fs"
import { env } from "../config/env"

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

const ActividadBody = z.object({
  subproyectoId: z.number().int().positive(),
  responsableId: z.number().int().positive(),
  responsableNombre: z.string().min(1),
  responsableInitials: z.string().min(1).max(3),
  responsableColor: z.string().default("#5461c8"),
  nombre: z.string().min(1).max(100),
  estado: z
    .enum(["Backlog", "Planificado", "En curso", "Revision", "Terminado"])
    .default("Backlog"),
  prioridad: z.enum(["Alta", "Media", "Baja"]).default("Media"),
  fechaInicio: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  fechaFin: z.string().refine((d) => !isNaN(Date.parse(d)), "Fecha inválida"),
  avance: z.number().int().min(0).max(100).default(0),
  puntos: z.number().int().min(1).max(21).default(3),
  costoInversion: z.number().min(0).default(0),
  costoOptimizacion: z.number().min(0).default(0),
  costoEjecucion: z.number().min(0).default(0),
  bloqueada: z.boolean().default(false),
  dependenciaId: z.number().int().positive().nullable().optional(),
})

const EstadoBody = z.object({
  estado: z.enum(["Backlog", "Planificado", "En curso", "Revision", "Terminado"]),
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
      const estadoValid = ["Backlog", "Planificado", "En curso", "Revision", "Terminado"]
      if (estadoValid.includes(estado as string)) {
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

// POST / — create actividad
router.post("/", async (req, res, next) => {
  try {
    const parsed = ActividadBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }

    const { fechaInicio, fechaFin, ...rest } = parsed.data
    const item = await prisma.helixActividad.create({
      data: {
        ...rest,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
      },
    })
    res.status(201).json(item)
  } catch (err) {
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

// PUT /:id — full update of actividad
router.put("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" })
      return
    }
    const parsed = ActividadBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const existing = await prisma.helixActividad.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: "No encontrado" })
      return
    }

    const { fechaInicio, fechaFin, ...rest } = parsed.data
    // Auto-set completadaEn if transitioning to Terminado
    const completadaEn =
      rest.estado === "Terminado" && existing.estado !== "Terminado"
        ? new Date()
        : existing.completadaEn ?? undefined

    const item = await prisma.helixActividad.update({
      where: { id },
      data: {
        ...rest,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        completadaEn,
      },
    })
    res.json(item)
  } catch (err) {
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

    const filePath = path.join(path.resolve(env.UPLOAD_DIR), ev.ruta)
    fs.unlink(filePath, () => undefined)

    await prisma.helixEvidencia.delete({ where: { id: evidenciaId } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
