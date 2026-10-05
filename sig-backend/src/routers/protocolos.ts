import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import crypto from "crypto"
import fs from "fs/promises"
import fsSync from "fs"
import { Prisma } from "@prisma/client"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"
import { extractText } from "../services/textExtraction"
import { resolveActorName } from "../utils/userNames"

// Portado del PR #17 (2026-10-05) con correcciones de la revisión previa al push:
// archivo servido como descarga con MIME derivado de la extensión (no del cliente), GET con acceso SIG,
// ids validados, limpieza del archivo subido si falla el alta y carrera de duplicados → 409.

const router = Router()

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const EXT_PERMITIDAS = [".md", ".markdown", ".txt", ".docx", ".pdf", ".doc"]
// Lista cerrada: el tipo que se sirve sale de la extensión, nunca del que declaró el cliente al subir.
const MIME_POR_EXT: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".markdown": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `prt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, EXT_PERMITIDAS.includes(path.extname(file.originalname).toLowerCase()))
  },
})

/** undefined = no vino; null = vino mal; número = entero positivo válido. */
function entero(v: unknown): number | undefined | null {
  if (v === undefined || v === "") return undefined
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const esNoEncontrado = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025"
const esDuplicado = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"

router.get("/", requireSigAccess, async (req: Request, res: Response) => {
  const pid = entero(req.query.procedimientoId)
  if (pid === null) {
    res.status(400).json({ error: "procedimientoId debe ser un entero positivo" })
    return
  }
  const { activo } = req.query
  const protocolos = await prisma.sigProtocolo.findMany({
    where: {
      ...(pid !== undefined ? { procedimientoId: pid } : {}),
      ...(activo === "true" || activo === "false" ? { activo: activo === "true" } : {}),
    },
    orderBy: { codigo: "asc" },
  })
  res.json(protocolos)
})

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const id = entero(req.params.id)
  if (!id) {
    res.status(400).json({ error: "id inválido" })
    return
  }
  const row = await prisma.sigProtocolo.findUnique({ where: { id } })
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
  const original = row.nombreArchivo ?? "archivo"
  const ext = path.extname(original).toLowerCase()
  res.setHeader("Content-Type", MIME_POR_EXT[ext] ?? "application/octet-stream")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${original.replace(/[^\x20-\x7E]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(original)}`,
  )
  fsSync.createReadStream(row.archivoOriginal).pipe(res)
})

router.get("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = entero(req.params.id)
  if (!id) {
    res.status(400).json({ error: "id inválido" })
    return
  }
  const row = await prisma.sigProtocolo.findUnique({ where: { id } })
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
    res.status(400).json({ error: `No se recibió un archivo válido (${EXT_PERMITIDAS.join(", ")})` })
    return
  }
  const subido = req.file.path
  const descartar = () => fs.unlink(subido).catch(() => {})

  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    await descartar()
    res.status(422).json({ error: parsed.error.flatten() })
    return
  }
  const proc = await prisma.sigProcedimiento.findUnique({ where: { id: parsed.data.procedimientoId } })
  if (!proc) {
    await descartar()
    res.status(404).json({ error: "Procedimiento no encontrado" })
    return
  }
  const codigo = parsed.data.codigo.toUpperCase()
  const dup = await prisma.sigProtocolo.findFirst({
    where: { procedimientoId: parsed.data.procedimientoId, codigo },
  })
  if (dup) {
    await descartar()
    res.status(409).json({ error: "Ya existe un protocolo con ese código en el procedimiento" })
    return
  }

  try {
    const { text, warnings } = await extractText(subido, req.file.originalname)
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
        archivoOriginal: subido,
        nombreArchivo: req.file.originalname,
        tipoMime: req.file.mimetype || "application/octet-stream",
        autorId,
        autorNombre: await resolveActorName(autorId, req.user!.full_name),
      },
    })
    res.status(201).json({ created, warnings })
  } catch (e) {
    await descartar() // no dejar huérfano el archivo si falló la extracción o el alta
    if (esDuplicado(e)) {
      res.status(409).json({ error: "Ya existe un protocolo con ese código en el procedimiento" })
      return
    }
    throw e
  }
})

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = entero(req.params.id)
  if (!id) {
    res.status(400).json({ error: "id inválido" })
    return
  }
  try {
    if (req.query.hard === "true" && req.user?.role === "admin") {
      const row = await prisma.sigProtocolo.delete({ where: { id } })
      if (row.archivoOriginal) await fs.unlink(row.archivoOriginal).catch(() => {})
      res.status(204).send()
      return
    }
    res.json(await prisma.sigProtocolo.update({ where: { id }, data: { activo: false } }))
  } catch (e) {
    if (esNoEncontrado(e)) {
      res.status(404).json({ error: "Protocolo no encontrado" })
      return
    }
    throw e
  }
})

export default router
