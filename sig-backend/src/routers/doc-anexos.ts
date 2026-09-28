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
    cb(null, `anexo_${Date.now()}_${safe}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// ── GET /api/doc-anexos?procedimientoId= ───────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { procedimientoId } = req.query
  const anexos = await prisma.sigDocAnexo.findMany({
    where: procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {},
    orderBy: { createdAt: "asc" },
  })
  res.json(anexos)
})

// ── GET /api/doc-anexos/:id/archivo ────────────────────────────────────────────

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const anexo = await prisma.sigDocAnexo.findUnique({ where: { id } })
  if (!anexo) {
    res.status(404).json({ error: "Documento anexo no encontrado" })
    return
  }
  try {
    await fs.access(anexo.archivo)
  } catch {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" })
    return
  }
  res.setHeader("Content-Type", anexo.tipoMime ?? "application/octet-stream")
  res.setHeader("Content-Disposition", `inline; filename="${anexo.nombreArchivo}"`)
  fsSync.createReadStream(anexo.archivo).pipe(res)
})

// ── POST /api/doc-anexos/upload ────────────────────────────────────────────────

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
      procedimientoId: z.coerce.number().int().positive(),
      nombre: z.string().min(1).max(255),
    })
    const parsed = BodySchema.safeParse(req.body)
    if (!parsed.success) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(422).json({ error: parsed.error.flatten() })
      return
    }

    const proc = await prisma.sigProcedimiento.findUnique({ where: { id: parsed.data.procedimientoId } })
    if (!proc) {
      await fs.unlink(req.file.path).catch(() => {})
      res.status(404).json({ error: "Procedimiento no encontrado" })
      return
    }

    const autorId = getUserId(req.user!)
    const created = await prisma.sigDocAnexo.create({
      data: {
        procedimientoId: parsed.data.procedimientoId,
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

// ── DELETE /api/doc-anexos/:id ──────────────────────────────────────────────────

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  try {
    const anexo = await prisma.sigDocAnexo.delete({ where: { id } })
    await fs.unlink(anexo.archivo).catch(() => {})
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "Documento anexo no encontrado" })
  }
})

export default router
