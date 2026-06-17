import { Router, Request, Response } from "express"
import { z } from "zod"
import { createTwoFilesPatch } from "diff"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import prisma from "../config/prisma"
import { getUserId, requireSigAccess, requireGerente } from "../middleware/auth"
import { sendAprobacionEmail } from "../services/email"
import { extractText } from "../services/textExtraction"

const router = Router()

// ── Multer — almacenamiento de archivos originales ────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `${Date.now()}_${safe}`)
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

// ── Schema JSON (net_file_manager) ────────────────────────────────────────────

const CommitSchema = z.object({
  procedimientoId: z.number().int().positive(),
  contenidoOriginal: z.string().default(""),
  contenidoAgente: z.string().default(""),
  flujogramaMmd: z.string().optional(),
  sinCambios: z.boolean().default(false),
  mensaje: z.string().min(1).max(500),
  versionDoc: z.string().max(20).optional(),
})

// ── GET /api/commits ──────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { procedimientoId, estado, limit } = req.query

  const commits = await prisma.sigCommit.findMany({
    where: {
      ...(procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}),
      ...(estado ? { estado: estado as "PENDIENTE_REVISION" | "APROBADO" | "RECHAZADO" } : {}),
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

// ── GET /api/commits/pendientes ───────────────────────────────────────────────

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

// ── GET /api/commits/:id — detalle con patch para diff viewer ─────────────────

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

  const patch = createTwoFilesPatch(
    "original.md",
    "agente.md",
    commit.contenidoOriginal,
    commit.contenidoAgente,
    "Documento original",
    "Procesado por IA",
    { context: 4 },
  )

  res.json({ ...commit, patch })
})

// ── GET /api/commits/:id/archivo — sirve el archivo original ─────────────────

router.get("/:id/archivo", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const commit = await prisma.sigCommit.findUnique({
    where: { id },
    select: { archivoOriginal: true, nombreArchivo: true, tipoMime: true },
  })

  if (!commit?.archivoOriginal) {
    res.status(404).json({ error: "Este commit no tiene archivo adjunto" })
    return
  }

  const filePath = path.join(UPLOADS_DIR, commit.archivoOriginal)
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" })
    return
  }

  res.setHeader("Content-Type", commit.tipoMime ?? "application/octet-stream")
  res.setHeader("Content-Disposition", `inline; filename="${commit.nombreArchivo ?? "archivo"}"`)
  const stream = fsSync.createReadStream(filePath)
  stream.pipe(res)
})

// ── POST /api/commits/upload — upload desde web con archivo binario ──────────

router.post(
  "/upload",
  requireSigAccess,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "Se requiere un archivo (.md, .txt, .docx, .pdf, .doc)" })
      return
    }

    const procedimientoId = parseInt(req.body.procedimientoId)
    const mensaje = (req.body.mensaje ?? "").trim()
    const versionDoc: string | undefined = req.body.versionDoc?.trim() || undefined

    if (!procedimientoId || !mensaje) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(422).json({ error: "procedimientoId y mensaje son requeridos" })
      return
    }

    const proc = await prisma.sigProcedimiento.findUnique({ where: { id: procedimientoId } })
    if (!proc) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(422).json({ error: "Procedimiento no encontrado. Crea el procedimiento primero." })
      return
    }

    // Extracción de texto en el servidor (autoritativa)
    const { text: extractedText, warnings } = await extractText(req.file.path, req.file.originalname)

    // contenidoOriginal = última versión aprobada (o vacío si es el primer commit)
    const prevCommit = await prisma.sigCommit.findFirst({
      where: { procedimientoId, estado: "APROBADO" },
      orderBy: { createdAt: "desc" },
      select: { contenidoAgente: true },
    })
    const contenidoOriginal = prevCommit?.contenidoAgente ?? ""

    const userId = getUserId(req.user!)
    const userName = req.user!.full_name ?? req.user!.email ?? "Usuario"
    const isGerente = req.user!.role === "gerente" || req.user!.role === "admin"
    const estadoFinal = isGerente ? "APROBADO" : "PENDIENTE_REVISION"

    const commit = await prisma.sigCommit.create({
      data: {
        procedimientoId,
        contenidoOriginal,
        contenidoAgente:  extractedText,
        sinCambios:       false,
        mensaje,
        autorId:          userId,
        autorNombre:      userName,
        versionDoc,
        archivoOriginal:  req.file.filename,
        nombreArchivo:    req.file.originalname,
        tipoMime:         req.file.mimetype,
        estado:           estadoFinal,
        ...(isGerente ? {
          aprobadoPor:    userId,
          aprobadoNombre: userName,
          aprobadoEn:     new Date(),
        } : {}),
      },
      include: { procedimiento: { select: { codigo: true, titulo: true } } },
    })

    if (isGerente) {
      await prisma.sigProcedimiento.update({
        where: { id: procedimientoId },
        data:  { estado: "VIGENTE" },
      })
    }

    res.status(201).json({ ...commit, warnings })
  },
)

// ── POST /api/commits — JSON (net_file_manager / edición inline) ──────────────

router.post("/", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = CommitSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const userId = getUserId(req.user!)
  const userName = req.user!.full_name ?? req.user!.email ?? "Usuario"

  const proc = await prisma.sigProcedimiento.findUnique({
    where: { id: parsed.data.procedimientoId },
  })
  if (!proc) {
    res.status(422).json({ error: "Procedimiento no encontrado. Crea el procedimiento primero." })
    return
  }

  const isGerente   = req.user!.role === "gerente" || req.user!.role === "admin"
  const estadoFinal = isGerente ? "APROBADO" : "PENDIENTE_REVISION"

  const commit = await prisma.sigCommit.create({
    data: {
      procedimientoId:   parsed.data.procedimientoId,
      contenidoOriginal: parsed.data.contenidoOriginal,
      contenidoAgente:   parsed.data.contenidoAgente,
      flujogramaMmd:     parsed.data.flujogramaMmd,
      sinCambios:        parsed.data.sinCambios,
      mensaje:           parsed.data.mensaje,
      autorId:           userId,
      autorNombre:       userName,
      versionDoc:        parsed.data.versionDoc,
      estado:            estadoFinal,
      ...(isGerente ? {
        aprobadoPor:    userId,
        aprobadoNombre: userName,
        aprobadoEn:     new Date(),
      } : {}),
    },
    include: {
      procedimiento: { select: { codigo: true, titulo: true } },
    },
  })

  if (isGerente && !parsed.data.sinCambios) {
    await prisma.sigProcedimiento.update({
      where: { id: parsed.data.procedimientoId },
      data:  { estado: "VIGENTE" },
    })
  }

  res.status(201).json(commit)
})

// ── POST /api/commits/:id/aprobar ─────────────────────────────────────────────

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
    prisma.sigProcedimiento.update({
      where: { id: commit.procedimientoId },
      data: { estado: "VIGENTE" },
    }),
  ])

  sendAprobacionEmail({
    codigo: commit.procedimiento.codigo,
    titulo: commit.procedimiento.titulo,
    aprobadoPor: userName,
    mensaje: commit.mensaje,
  }).catch((err) => console.error("Error enviando email de aprobación:", err))

  res.json({ ok: true })
})

// ── POST /api/commits/:id/rechazar ────────────────────────────────────────────

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
