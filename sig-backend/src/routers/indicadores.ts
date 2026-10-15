import { Router, Request, Response } from "express"
import { z } from "zod"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import fsSync from "fs"
import { Prisma } from "@prisma/client"
import prisma from "../config/prisma"
import { requireSigAccess, getUserId } from "../middleware/auth"
import { resolveActorName } from "../utils/userNames"
import { leerIndicadoresXlsx, type FichaIndicador, type ResultadoIndicador } from "../services/indicadorHoja"
import { evaluarIndicador } from "../services/indicadorLectura"

const router = Router()
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "sig", "indicadores")
fsSync.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({ defParamCharset: "utf8", // los nombres con tilde llegan en UTF-8; multer los leía como latin1 (DESINFECCIÃ“N)
  
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-z0-9.\-_]/gi, "_").toLowerCase()
      cb(null, `kpi_${Date.now()}_${safe}`)
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(xlsx|xlsm)$/i.test(file.originalname))
  },
})

/** Indicadores con su lectura mecánica (`evaluacion`): lo que ve la pantalla y lo que lee el agente por el MCP. */
export async function listarIndicadores(areaId?: number) {
  const filas = await prisma.sigIndicador.findMany({
    where: areaId ? { areaId } : {},
    include: { area: { select: { id: true, nombre: true, color: true } } },
    orderBy: [{ area: { nombre: "asc" } }, { nombre: "asc" }],
  })
  return filas.map((k) => ({ ...k, evaluacion: evaluarIndicador({ ...k, resultados: k.resultados as unknown as ResultadoIndicador[] }) }))
}

// GET /api/indicadores?areaId= | ?procedimientoId= (los indicadores del área de ese procedimiento)
router.get("/", requireSigAccess, async (req: Request, res: Response) => {
  const q = z.object({ areaId: z.coerce.number().int().positive().optional(), procedimientoId: z.coerce.number().int().positive().optional() }).safeParse(req.query)
  if (!q.success) { res.status(400).json({ error: "areaId y procedimientoId deben ser números positivos" }); return }
  let areaId = q.data.areaId
  if (q.data.procedimientoId) {
    const proc = await prisma.sigProcedimiento.findUnique({ where: { id: q.data.procedimientoId }, select: { areaId: true } })
    if (!proc) { res.status(404).json({ error: "Procedimiento no encontrado" }); return }
    areaId = proc.areaId
  }
  res.json(await listarIndicadores(areaId))
})

router.get("/:id/archivo", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const row = await prisma.sigIndicador.findUnique({ where: { id } })
  if (!row) { res.status(404).json({ error: "Indicador no encontrado" }); return }
  try { await fs.access(row.archivo) } catch { res.status(404).json({ error: "Archivo no encontrado" }); return }
  res.setHeader("Content-Type", row.tipoMime ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(row.nombreArchivo)}"`)
  fsSync.createReadStream(row.archivo).pipe(res)
})

async function guardarFicha(
  areaId: number, file: Express.Multer.File, ficha: FichaIndicador, autorId: number, autorNombre: string,
) {
  const data = {
    areaId, ...ficha,
    resultados: ficha.resultados as unknown as Prisma.InputJsonValue,
    archivo: file.path, nombreArchivo: file.originalname,
    tipoMime: file.mimetype || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    autorId, autorNombre,
  }
  // La llave incluye el archivo: hay indicadores con el mismo nombre en archivos de empresas distintas (p. ej. SG-SST IMC CARGO y LOGIMAT).
  const llave = { areaId_nombre_nombreArchivo: { areaId, nombre: ficha.nombre, nombreArchivo: file.originalname } }
  const prev = await prisma.sigIndicador.findUnique({ where: llave })
  const row = await prisma.sigIndicador.upsert({
    where: llave, create: data, update: data, include: { area: { select: { id: true, nombre: true, color: true } } },
  })
  if (!prev) return { row, updated: false }
  const updated = row
  if (prev.archivo !== file.path) {
    const otros = await prisma.sigIndicador.count({ where: { archivo: prev.archivo } })
    if (otros === 0) await fs.unlink(prev.archivo).catch(() => {})
  }
  return { row: updated, updated: true }
}

router.post("/upload", requireSigAccess, (req, res, next) => {
  upload.array("files", 20)(req, res, (err: unknown) => {
    if (err) { res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo recibir el archivo" }); return }
    next()
  })
}, async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) { res.status(400).json({ error: "Sube un Excel .xlsx de la hoja de vida" }); return }
  const parsed = z.object({ areaId: z.coerce.number().int().positive() }).safeParse(req.body)
  if (!parsed.success) {
    await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})))
    res.status(422).json({ error: "Elige el área a la que pertenecen los indicadores" })
    return
  }
  const area = await prisma.sigArea.findUnique({ where: { id: parsed.data.areaId } })
  if (!area) {
    await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})))
    res.status(404).json({ error: "Área no encontrada" })
    return
  }
  let autorId: number
  try { autorId = getUserId(req.user!) } catch {
    await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})))
    res.status(401).json({ error: "Token sin identificador de usuario" })
    return
  }
  const autorNombre = await resolveActorName(autorId, req.user!.full_name)
  const items = []
  const avisos: string[] = []
  for (const file of files) {
    let fichas: FichaIndicador[] = []
    try { fichas = await leerIndicadoresXlsx(file.path) } catch { avisos.push(`${file.originalname}: no se pudo leer el Excel`) }
    if (fichas.length === 0) {
      const nombre = file.originalname.replace(/\.xlsx?$/i, "").replace(/\.xlsm$/i, "")
      fichas = [{
        nombre, codigo: null, objetivo: null, formula: null, meta: null, frecuencia: null, fuente: null,
        tipo: null, tendencia: null, plazo: null, procesoResponsable: null, versionDoc: null, fechaDoc: null,
        resultados: [], hoja: "",
      }]
      avisos.push(`${file.originalname}: se guardó el archivo, pero no se encontró la hoja de vida`)
    }
    const guardadas = []
    for (const ficha of fichas) {
      const g = await guardarFicha(parsed.data.areaId, file, ficha, autorId, autorNombre)
      items.push(g)
      guardadas.push(g.row.id)
    }
    // Lo que el archivo ya no trae (indicador renombrado o quitado de la hoja) no se deja vivo con datos viejos.
    const viejas = await prisma.sigIndicador.findMany({ where: { areaId: parsed.data.areaId, nombreArchivo: file.originalname, id: { notIn: guardadas } } })
    if (viejas.length > 0) {
      await prisma.sigIndicador.deleteMany({ where: { id: { in: viejas.map((v) => v.id) } } })
      avisos.push(`${file.originalname}: se quitaron ${viejas.length} indicadores que el archivo ya no trae (${viejas.map((v) => v.nombre).join(", ")})`)
      for (const v of viejas) {
        if (v.archivo !== file.path && (await prisma.sigIndicador.count({ where: { archivo: v.archivo } })) === 0) await fs.unlink(v.archivo).catch(() => {})
      }
    }
  }
  res.status(201).json({
    items: items.map((i) => i.row),
    actualizados: items.filter((i) => i.updated).length,
    avisos,
  })
})

router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const row = await prisma.sigIndicador.findUnique({ where: { id } })
  if (!row) { res.status(404).json({ error: "Indicador no encontrado" }); return }
  await prisma.sigIndicador.delete({ where: { id } })
  const otros = await prisma.sigIndicador.count({ where: { archivo: row.archivo } })
  if (otros === 0) await fs.unlink(row.archivo).catch(() => {})
  res.json({ ok: true })
})

export default router
