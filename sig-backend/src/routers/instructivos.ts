import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"
import { extractText } from "../services/textExtraction"
import { resolveActorName } from "../utils/userNames"

const router = Router()

// ── Multer — mismo directorio que commits ─────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `inst_${Date.now()}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".md", ".markdown", ".txt", ".docx", ".pdf", ".doc"]
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

// ── GET /api/instructivos?procedimientoId=&activo= ────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { procedimientoId, activo } = req.query
  const instructivos = await prisma.sigInstructivo.findMany({
    where: {
      ...(procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}),
      ...(activo !== undefined ? { activo: activo === "true" } : {}),
    },
    orderBy: { createdAt: "asc" },
  })
  res.json(instructivos)
})

// ── GET /api/instructivos/:id ─────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const inst = await prisma.sigInstructivo.findUnique({ where: { id } })
  if (!inst) {
    res.status(404).json({ error: "Instructivo no encontrado" })
    return
  }
  res.json(inst)
})

// ── GET /api/instructivos/:id/archivo — servir archivo original ───────────────

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const inst = await prisma.sigInstructivo.findUnique({ where: { id } })

  if (!inst || !inst.archivoOriginal) {
    res.status(404).json({ error: "Archivo no disponible" })
    return
  }

  const filePath = inst.archivoOriginal
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" })
    return
  }

  res.setHeader("Content-Type", inst.tipoMime ?? "application/octet-stream")
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${inst.nombreArchivo ?? "archivo"}"`,
  )
  fsSync.createReadStream(filePath).pipe(res)
})

// ── POST /api/instructivos/upload — multipart con extracción servidor-side ────

router.post(
  "/upload",
  requireSigAccess,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió archivo" })
      return
    }

    const { procedimientoId, codigo, titulo, descripcion, versionDoc } = req.body

    const BodySchema = z.object({
      procedimientoId: z.coerce.number().int().positive(),
      codigo: z.string().min(1).max(50),
      titulo: z.string().min(1).max(255),
      descripcion: z.string().max(1000).optional(),
      versionDoc: z.string().default("1.0"),
    })

    const parsed = BodySchema.safeParse({ procedimientoId, codigo, titulo, descripcion, versionDoc })
    if (!parsed.success) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(422).json({ error: parsed.error.flatten() })
      return
    }

    const proc = await prisma.sigProcedimiento.findUnique({
      where: { id: parsed.data.procedimientoId },
    })
    if (!proc) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(404).json({ error: "Procedimiento no encontrado" })
      return
    }

    // Extracción servidor-side
    const { text, warnings } = await extractText(req.file.path, req.file.originalname)

    const mime =
      req.file.mimetype ||
      (req.file.originalname.endsWith(".md") || req.file.originalname.endsWith(".txt")
        ? "text/plain"
        : req.file.originalname.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : req.file.originalname.endsWith(".pdf")
        ? "application/pdf"
        : req.file.originalname.endsWith(".doc")
        ? "application/msword"
        : "application/octet-stream")

    const autorId = getUserId(req.user!)
    const autorNombre = await resolveActorName(autorId, req.user!.full_name)

    const created = await prisma.sigInstructivo.create({
      data: {
        procedimientoId: parsed.data.procedimientoId,
        codigo: parsed.data.codigo.toUpperCase(),
        titulo: parsed.data.titulo,
        descripcion: parsed.data.descripcion?.trim() || null,
        contenido: text,
        contenidoOriginal: text,
        versionDoc: parsed.data.versionDoc || "1.0",
        archivoOriginal: req.file.path,
        nombreArchivo: req.file.originalname,
        tipoMime: mime,
        autorId,
        autorNombre,
      },
    })

    res.status(201).json({ created, warnings })
  },
)

// ── POST /api/instructivos — carga uno o varios vía JSON (net_file_manager) ───

router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const isBulk = Array.isArray(req.body)
  const items = isBulk ? req.body : [req.body]

  const autorId = getUserId(req.user!)
  const autorNombre = await resolveActorName(autorId, req.user!.full_name)

  const results = []
  const errors  = []

  const InstructivoSchema = z.object({
    procedimientoId:  z.number().int().positive(),
    codigo:           z.string().min(1).max(50),
    titulo:           z.string().min(1).max(255),
    descripcion:      z.string().max(1000).optional(),
    contenido:        z.string().min(1),
    contenidoOriginal: z.string().optional(),
    versionDoc:       z.string().default("1.0"),
  })

  for (const item of items) {
    const parsed = InstructivoSchema.safeParse(item)
    if (!parsed.success) {
      errors.push({ item, error: parsed.error.flatten() })
      continue
    }

    const proc = await prisma.sigProcedimiento.findUnique({
      where: { id: parsed.data.procedimientoId },
    })
    if (!proc) {
      errors.push({ item, error: "Procedimiento no encontrado" })
      continue
    }

    const created = await prisma.sigInstructivo.create({
      data: {
        ...parsed.data,
        autorId,
        autorNombre,
      },
    })
    results.push(created)
  }

  const status =
    errors.length === 0 ? 201 :
    errors.length === items.length ? 422 : 207

  res.status(status).json({ created: results, errors })
})

// ── PATCH /api/instructivos/:id ───────────────────────────────────────────────

router.patch("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)

  const UpdateSchema = z.object({
    titulo:            z.string().max(255).optional(),
    descripcion:       z.string().max(1000).optional(),
    contenido:         z.string().optional(),
    contenidoOriginal: z.string().optional(),
    versionDoc:        z.string().optional(),
    activo:            z.boolean().optional(),
  })

  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }

  try {
    const inst = await prisma.sigInstructivo.update({
      where: { id },
      data: parsed.data,
    })
    res.json(inst)
  } catch {
    res.status(404).json({ error: "Instructivo no encontrado" })
  }
})

// ── POST /api/instructivos/:id/reextract — re-procesar texto de archivo guardado

router.post("/:id/reextract", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)

  const inst = await prisma.sigInstructivo.findUnique({ where: { id } })
  if (!inst) {
    res.status(404).json({ error: "Instructivo no encontrado" })
    return
  }
  if (!inst.archivoOriginal || !inst.nombreArchivo) {
    res.status(400).json({ error: "Este instructivo no tiene archivo almacenado para re-procesar" })
    return
  }

  try {
    await fs.access(inst.archivoOriginal)
  } catch {
    res.status(404).json({ error: "Archivo físico no encontrado en el servidor" })
    return
  }

  const { text, warnings } = await extractText(inst.archivoOriginal, inst.nombreArchivo)

  const updated = await prisma.sigInstructivo.update({
    where: { id },
    data: { contenido: text, contenidoOriginal: text },
  })

  res.json({ updated, warnings })
})

// ── DELETE /api/instructivos/:id ──────────────────────────────────────────────

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id   = parseInt(req.params.id)
  const hard = req.query.hard === "true" && req.user?.role === "admin"

  try {
    if (hard) {
      await prisma.sigInstructivo.delete({ where: { id } })
      res.status(204).send()
    } else {
      const inst = await prisma.sigInstructivo.update({
        where: { id },
        data: { activo: false },
      })
      res.json(inst)
    }
  } catch {
    res.status(404).json({ error: "Instructivo no encontrado" })
  }
})

export default router
