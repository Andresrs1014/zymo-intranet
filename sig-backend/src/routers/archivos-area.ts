import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"
import { fueraDeArea } from "../middleware/gateLider"
import { resolveActorName } from "../utils/userNames"
import { inline } from "../utils/descarga"
import { servirPdfPreview } from "../services/pdfPreview"

// Archivos que cuelgan del ÁREA (no de un procedimiento): cualquier formato, sin extracción de texto ni revisión.
const router = Router()

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `area_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`)
  },
})

const upload = multer({ defParamCharset: "utf8", storage, limits: { fileSize: 50 * 1024 * 1024 } })

// GET /api/archivos-area?areaId=
router.get("/", requireSigAccess, async (req: Request, res: Response) => {
  const areaId = parseInt(String(req.query.areaId ?? ""))
  if (!Number.isFinite(areaId)) { res.status(422).json({ error: "areaId requerido" }); return }
  res.json(await prisma.sigArchivoArea.findMany({ where: { areaId }, orderBy: { createdAt: "desc" } }))
})

async function archivoDe(req: Request, res: Response) {
  const a = await prisma.sigArchivoArea.findUnique({ where: { id: parseInt(req.params.id) } })
  if (!a) { res.status(404).json({ error: "Archivo no encontrado" }); return null }
  return a
}

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const a = await archivoDe(req, res)
  if (!a) return
  try { await fs.access(a.archivo) } catch { res.status(404).json({ error: "Archivo no encontrado en el servidor" }); return }
  res.setHeader("Content-Type", a.tipoMime ?? "application/octet-stream")
  res.setHeader("Content-Disposition", inline(a.nombreArchivo))
  fsSync.createReadStream(a.archivo).pipe(res)
})

router.get("/:id/archivo/pdf", requireSigAccess, async (req: Request, res: Response) => {
  const a = await archivoDe(req, res)
  if (!a) return
  await servirPdfPreview(res, a.archivo, `area_${a.id}`)
})

// POST /api/archivos-area/upload
router.post("/upload", requireSigAccess, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No se recibió archivo" }); return }
  const limpiar = () => fs.unlink(req.file!.path).catch(() => {})

  const parsed = z.object({
    areaId: z.coerce.number().int().positive(),
    nombre: z.string().min(1).max(255),
  }).safeParse(req.body)
  if (!parsed.success) { await limpiar(); res.status(422).json({ error: parsed.error.flatten() }); return }

  const area = await prisma.sigArea.findUnique({ where: { id: parsed.data.areaId }, select: { id: true } })
  if (!area || fueraDeArea(req, area.id)) { await limpiar(); res.status(404).json({ error: "Área no encontrada" }); return }

  const autorId = getUserId(req.user!)
  const created = await prisma.sigArchivoArea.create({
    data: {
      areaId: area.id,
      nombre: parsed.data.nombre,
      archivo: req.file.path,
      nombreArchivo: req.file.originalname,
      tipoMime: req.file.mimetype || "application/octet-stream",
      autorId,
      autorNombre: await resolveActorName(autorId, req.user!.full_name),
    },
  })
  res.status(201).json(created)
})

// DELETE /api/archivos-area/:id
router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  try {
    const a = await prisma.sigArchivoArea.delete({ where: { id: parseInt(req.params.id) } })
    await fs.unlink(a.archivo).catch(() => {})
    res.status(204).send()
  } catch {
    res.status(404).json({ error: "Archivo no encontrado" })
  }
})

export default router
