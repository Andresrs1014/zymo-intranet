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

// ── Multer — mismo directorio base que commits/instructivos ───────────────────

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
    cb(null, `pendiente_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".md", ".markdown", ".txt", ".docx", ".pdf", ".doc"]
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

const CATEGORIAS = ["procedimiento", "soporte"] as const

// ── GET /api/archivos-pendientes?categoria=&asignado= ─────────────────────────

router.get("/", requireSigAccess, async (req: Request, res: Response) => {
  const { categoria, asignado } = req.query
  const archivos = await prisma.sigArchivoPendiente.findMany({
    where: {
      ...(categoria ? { categoria: categoria as string } : {}),
      ...(asignado !== undefined ? { asignado: asignado === "true" } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
  res.json(archivos)
})

// ── POST /api/archivos-pendientes/upload — sube varios archivos sin asignar ───
// Mismo endpoint sirve a la intranet y al MCP-001 (autentica como rol IA_SIG,
// que ya pasa requireSigAccess) — origen se resuelve solo por el rol del token.

router.post(
  "/upload",
  requireSigAccess,
  upload.array("files", 50),
  async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    if (files.length === 0) {
      res.status(400).json({ error: "Se requiere al menos un archivo" })
      return
    }

    const categoria = CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : null
    if (!categoria) {
      await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})))
      res.status(422).json({ error: 'categoria debe ser "procedimiento" o "soporte"' })
      return
    }

    const userId = getUserId(req.user!)
    const userName = await resolveActorName(userId, req.user!.full_name)
    const origen = req.user!.role === "IA_SIG" ? "mcp" : "intranet"

    const creados = await Promise.all(
      files.map((f) =>
        prisma.sigArchivoPendiente.create({
          data: {
            archivoOriginal: f.filename,
            nombreArchivo: f.originalname,
            tipoMime: f.mimetype || "application/octet-stream",
            tamanoBytes: f.size,
            categoria,
            origen,
            subidoPorId: userId,
            subidoPorNombre: userName,
          },
        }),
      ),
    )

    res.status(201).json(creados)
  },
)

// ── DELETE /api/archivos-pendientes/:id — descarta un archivo sin asignar ─────

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const archivo = await prisma.sigArchivoPendiente.findUnique({ where: { id } })
  if (!archivo) { res.status(404).json({ error: "Archivo no encontrado" }); return }
  if (archivo.asignado) {
    res.status(409).json({ error: "Este archivo ya fue asignado, no se puede descartar" })
    return
  }
  await prisma.sigArchivoPendiente.delete({ where: { id } })
  await fs.unlink(path.join(UPLOADS_DIR, archivo.archivoOriginal)).catch(() => {})
  res.status(204).send()
})

// ── POST /api/archivos-pendientes/:id/asignar-procedimiento ───────────────────
// Convierte un archivo pendiente (categoria "procedimiento") en un SigCommit —
// misma lógica de encadenamiento y auto-aprobación que POST /api/commits/upload.

const AsignarProcedimientoSchema = z.object({
  procedimientoId: z.coerce.number().int().positive(),
  mensaje: z.string().min(1).max(500),
  versionDoc: z.string().max(20).optional(),
})

router.post("/:id/asignar-procedimiento", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const parsed = AsignarProcedimientoSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const archivo = await prisma.sigArchivoPendiente.findUnique({ where: { id } })
  if (!archivo) { res.status(404).json({ error: "Archivo no encontrado" }); return }
  if (archivo.asignado) { res.status(409).json({ error: "Este archivo ya fue asignado" }); return }
  if (archivo.categoria !== "procedimiento") {
    res.status(422).json({ error: 'Este archivo se subió como "documento de soporte", no como procedimiento' })
    return
  }

  const proc = await prisma.sigProcedimiento.findUnique({ where: { id: parsed.data.procedimientoId } })
  if (!proc) { res.status(422).json({ error: "Procedimiento no encontrado" }); return }

  const filePath = path.join(UPLOADS_DIR, archivo.archivoOriginal)
  const extraccion = await extractText(filePath, archivo.nombreArchivo)
  const { text: extractedText, warnings } = extraccion

  const prevCommit = await prisma.sigCommit.findFirst({
    where: { procedimientoId: parsed.data.procedimientoId, estado: "APROBADO" },
    orderBy: { createdAt: "desc" },
    select: { contenidoAgente: true },
  })
  const contenidoOriginal = prevCommit?.contenidoAgente ?? ""

  const userId = getUserId(req.user!)
  const userName = await resolveActorName(userId, req.user!.full_name)
  const isGerente = req.user!.role === "gerente" || req.user!.role === "admin"
  const estadoFinal = isGerente ? "APROBADO" : "PENDIENTE_REVISION"

  const commit = await prisma.sigCommit.create({
    data: {
      procedimientoId: parsed.data.procedimientoId,
      contenidoOriginal,
      contenidoAgente: extractedText,
      flujogramaImagenUrl: extraccion.flujogramaImagenUrl,
      sinCambios: false,
      mensaje: parsed.data.mensaje,
      autorId: userId,
      autorNombre: userName,
      versionDoc: parsed.data.versionDoc,
      archivoOriginal: archivo.archivoOriginal,
      nombreArchivo: archivo.nombreArchivo,
      tipoMime: archivo.tipoMime,
      estado: estadoFinal,
      ...(isGerente ? { aprobadoPor: userId, aprobadoNombre: userName, aprobadoEn: new Date() } : {}),
    },
    include: { procedimiento: { select: { codigo: true, titulo: true } } },
  })

  if (isGerente) {
    await prisma.sigProcedimiento.update({ where: { id: parsed.data.procedimientoId }, data: { estado: "VIGENTE" } })
  }

  await prisma.sigArchivoPendiente.update({
    where: { id },
    data: { asignado: true, asignadoEn: new Date(), asignadoTipo: "procedimiento", commitId: commit.id },
  })

  res.status(201).json({ ...commit, warnings })
})

// ── POST /api/archivos-pendientes/asignar-soporte ──────────────────────────────
// Asigna varios archivos pendientes (categoria "soporte") a UN solo procedimiento
// de una vez, cada uno con su propio tipo (instructivo/formato/doc_anexo).

const ItemSoporteSchema = z.object({
  id: z.number().int().positive(),
  tipo: z.enum(["instructivo", "formato", "doc_anexo"]),
  titulo: z.string().min(1).max(255),
  codigo: z.string().min(1).max(50).optional(), // requerido solo si tipo === "instructivo"
})

const AsignarSoporteSchema = z.object({
  procedimientoId: z.coerce.number().int().positive(),
  items: z.array(ItemSoporteSchema).min(1).max(50),
})

router.post("/asignar-soporte", requireSigAccess, async (req: Request, res: Response) => {
  const parsed = AsignarSoporteSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }

  const proc = await prisma.sigProcedimiento.findUnique({ where: { id: parsed.data.procedimientoId } })
  if (!proc) { res.status(422).json({ error: "Procedimiento no encontrado" }); return }

  for (const item of parsed.data.items) {
    if (item.tipo === "instructivo" && !item.codigo) {
      res.status(422).json({ error: `El item "${item.titulo}" es un instructivo y necesita código` })
      return
    }
  }

  const userId = getUserId(req.user!)
  const userName = await resolveActorName(userId, req.user!.full_name)

  const resultados: Array<{ archivoPendienteId: number; tipo: string; creadoId: number; warnings?: string[] }> = []

  for (const item of parsed.data.items) {
    const archivo = await prisma.sigArchivoPendiente.findUnique({ where: { id: item.id } })
    if (!archivo || archivo.asignado || archivo.categoria !== "soporte") continue

    const filePath = path.join(UPLOADS_DIR, archivo.archivoOriginal)

    if (item.tipo === "instructivo") {
      const { text, warnings } = await extractText(filePath, archivo.nombreArchivo)
      const created = await prisma.sigInstructivo.create({
        data: {
          procedimientoId: parsed.data.procedimientoId,
          codigo: item.codigo!.toUpperCase(),
          titulo: item.titulo,
          contenido: text,
          contenidoOriginal: text,
          archivoOriginal: filePath,
          nombreArchivo: archivo.nombreArchivo,
          tipoMime: archivo.tipoMime,
          autorId: userId,
          autorNombre: userName,
        },
      })
      await prisma.sigArchivoPendiente.update({
        where: { id: item.id },
        data: { asignado: true, asignadoEn: new Date(), asignadoTipo: "instructivo", instructivoId: created.id },
      })
      resultados.push({ archivoPendienteId: item.id, tipo: "instructivo", creadoId: created.id, warnings })
    } else if (item.tipo === "formato") {
      const created = await prisma.sigFormato.create({
        data: {
          procedimientoId: parsed.data.procedimientoId,
          nombre: item.titulo,
          archivo: filePath,
          nombreArchivo: archivo.nombreArchivo,
          tipoMime: archivo.tipoMime,
          autorId: userId,
          autorNombre: userName,
        },
      })
      await prisma.sigArchivoPendiente.update({
        where: { id: item.id },
        data: { asignado: true, asignadoEn: new Date(), asignadoTipo: "formato", formatoId: created.id },
      })
      resultados.push({ archivoPendienteId: item.id, tipo: "formato", creadoId: created.id })
    } else {
      const created = await prisma.sigDocAnexo.create({
        data: {
          procedimientoId: parsed.data.procedimientoId,
          nombre: item.titulo,
          archivo: filePath,
          nombreArchivo: archivo.nombreArchivo,
          tipoMime: archivo.tipoMime,
          autorId: userId,
          autorNombre: userName,
        },
      })
      await prisma.sigArchivoPendiente.update({
        where: { id: item.id },
        data: { asignado: true, asignadoEn: new Date(), asignadoTipo: "doc_anexo", docAnexoId: created.id },
      })
      resultados.push({ archivoPendienteId: item.id, tipo: "doc_anexo", creadoId: created.id })
    }
  }

  res.status(201).json({ ok: true, resultados })
})

export default router
