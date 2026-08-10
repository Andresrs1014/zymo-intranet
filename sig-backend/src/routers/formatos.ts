import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"
import { resolveActorName } from "../utils/userNames"

const router = Router()

// ── Multer — mismo directorio base que instructivos/commits ───────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `formato_${Date.now()}_${safe}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// ── GET /api/formatos?instructivoId=&procedimientoId= ─────────────────────────
// procedimientoId agrega los formatos de TODOS los instructivos del procedimiento
// (Formatos cuelga de Instructivo, no del procedimiento directamente).

router.get("/", async (req: Request, res: Response) => {
  const { instructivoId, procedimientoId } = req.query
  const formatos = await prisma.sigFormato.findMany({
    where: {
      ...(instructivoId ? { instructivoId: parseInt(instructivoId as string) } : {}),
      ...(procedimientoId
        ? { instructivo: { procedimientoId: parseInt(procedimientoId as string) } }
        : {}),
    },
    include: { instructivo: { select: { codigo: true, titulo: true } } },
    orderBy: { createdAt: "asc" },
  })
  res.json(formatos)
})

// ── GET /api/formatos/:id/archivo ──────────────────────────────────────────────

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const formato = await prisma.sigFormato.findUnique({ where: { id } })
  if (!formato) {
    res.status(404).json({ error: "Formato no encontrado" })
    return
  }
  try {
    await fs.access(formato.archivo)
  } catch {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" })
    return
  }
  res.setHeader("Content-Type", formato.tipoMime ?? "application/octet-stream")
  res.setHeader("Content-Disposition", `inline; filename="${formato.nombreArchivo}"`)
  fsSync.createReadStream(formato.archivo).pipe(res)
})

// ── POST /api/formatos/upload ──────────────────────────────────────────────────

router.post(
  "/upload",
  requireSigAccess,
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió archivo" })
      return
    }

    const BodySchema = z.object({
      instructivoId: z.coerce.number().int().positive(),
      nombre: z.string().min(1).max(255),
    })
    const parsed = BodySchema.safeParse(req.body)
    if (!parsed.success) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(422).json({ error: parsed.error.flatten() })
      return
    }

    const inst = await prisma.sigInstructivo.findUnique({ where: { id: parsed.data.instructivoId } })
    if (!inst) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(404).json({ error: "Instructivo no encontrado" })
      return
    }

    const autorId = getUserId(req.user!)
    const created = await prisma.sigFormato.create({
      data: {
        instructivoId: parsed.data.instructivoId,
        nombre: parsed.data.nombre,
        archivo: req.file.path,
        nombreArchivo: req.file.originalname,
        tipoMime: req.file.mimetype || "application/octet-stream",
        autorId,
        autorNombre: await resolveActorName(autorId, req.user!.full_name),
      },
    })
    res.status(201).json(created)
  },
)

// ── DELETE /api/formatos/:id ────────────────────────────────────────────────────

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  try {
    const formato = await prisma.sigFormato.delete({ where: { id } })
    await fs.unlink(formato.archivo).catch(() => {})
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "Formato no encontrado" })
  }
})

export default router
