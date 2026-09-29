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

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `prt_${Date.now()}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".md", ".markdown", ".txt", ".docx", ".pdf", ".doc"]
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()))
  },
})

router.get("/", async (req: Request, res: Response) => {
  const { procedimientoId, activo } = req.query
  const protocolos = await prisma.sigProtocolo.findMany({
    where: {
      ...(procedimientoId ? { procedimientoId: parseInt(procedimientoId as string) } : {}),
      ...(activo !== undefined ? { activo: activo === "true" } : {}),
    },
    orderBy: { codigo: "asc" },
  })
  res.json(protocolos)
})

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const row = await prisma.sigProtocolo.findUnique({ where: { id: parseInt(req.params.id) } })
  if (!row?.archivoOriginal) {
    res.status(404).json({ error: "Archivo no disponible" })
    return
  }
  try {
    await fs.access(row.archivoOriginal)
  } catch {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" })
    return
  }
  res.setHeader("Content-Type", row.tipoMime ?? "application/octet-stream")
  res.setHeader("Content-Disposition", `inline; filename="${row.nombreArchivo ?? "archivo"}"`)
  fsSync.createReadStream(row.archivoOriginal).pipe(res)
})

router.get("/:id", async (req: Request, res: Response) => {
  const row = await prisma.sigProtocolo.findUnique({ where: { id: parseInt(req.params.id) } })
  if (!row) {
    res.status(404).json({ error: "Protocolo no encontrado" })
    return
  }
  res.json(row)
})

const BodySchema = z.object({
  procedimientoId: z.coerce.number().int().positive(),
  codigo: z.string().min(1).max(50),
  titulo: z.string().min(1).max(255),
  descripcion: z.string().max(1000).optional(),
  versionDoc: z.string().default("1.0"),
})

router.post("/upload", requireSigAccess, upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibió archivo" })
    return
  }
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
  const codigo = parsed.data.codigo.toUpperCase()
  const dup = await prisma.sigProtocolo.findFirst({
    where: { procedimientoId: parsed.data.procedimientoId, codigo },
  })
  if (dup) {
    await fs.unlink(req.file.path).catch(() => {})
    res.status(409).json({ error: "Ya existe un protocolo con ese código en el procedimiento" })
    return
  }

  const { text, warnings } = await extractText(req.file.path, req.file.originalname)
  const autorId = getUserId(req.user!)
  const created = await prisma.sigProtocolo.create({
    data: {
      procedimientoId: parsed.data.procedimientoId,
      codigo,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion?.trim() || null,
      contenido: text,
      contenidoOriginal: text,
      versionDoc: parsed.data.versionDoc || "1.0",
      archivoOriginal: req.file.path,
      nombreArchivo: req.file.originalname,
      tipoMime: req.file.mimetype || "application/octet-stream",
      autorId,
      autorNombre: await resolveActorName(autorId, req.user!.full_name),
    },
  })
  res.status(201).json({ created, warnings })
})

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  try {
    if (req.query.hard === "true" && req.user?.role === "admin") {
      const row = await prisma.sigProtocolo.delete({ where: { id } })
      if (row.archivoOriginal) await fs.unlink(row.archivoOriginal).catch(() => {})
      res.status(204).send()
      return
    }
    res.json(await prisma.sigProtocolo.update({ where: { id }, data: { activo: false } }))
  } catch {
    res.status(404).json({ error: "Protocolo no encontrado" })
  }
})

export default router
