import fs from "fs/promises"
import fsSync from "fs"
import path from "path"
import type { Response } from "express"
import { tryLibreOfficeConvert } from "./textExtraction"

// Cache del PDF generado desde documentos de Office para la previsualización. Se guarda
// junto a los originales (volumen sig_uploads) y se invalida si el original cambia.
const PREVIEW_DIR = path.join(process.cwd(), "uploads", "sig", "_preview")
const inFlight = new Map<string, Promise<string | null>>()

// LibreOffice pesa mucho: este servidor es un equipo pequeño que se ha reiniciado bajo carga. Una conversión a la vez.
let cola: Promise<unknown> = Promise.resolve()
function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const r = cola.then(tarea, tarea)
  cola = r.catch(() => undefined)
  return r
}

/** Lo que LibreOffice sabe pasar a PDF: Word, Excel, PowerPoint, OpenDocument y RTF. */
export function isOfficeDoc(filePath: string): boolean {
  return /\.(docx?|xlsx?|xlsm|pptx?|odt|ods|odp|rtf)$/i.test(filePath)
}

async function build(filePath: string, cachePath: string): Promise<string | null> {
  const converted = await tryLibreOfficeConvert(filePath, "pdf")
  if (!converted) return null
  try {
    await fs.mkdir(PREVIEW_DIR, { recursive: true })
    const tmp = `${cachePath}.${process.pid}.tmp`
    await fs.copyFile(converted, tmp)
    await fs.rename(tmp, cachePath)
    return cachePath
  } finally {
    await fs.rm(path.dirname(converted), { recursive: true, force: true }).catch(() => {})
  }
}

/** Devuelve la ruta a un PDF equivalente del documento de Office, o null si LibreOffice falla. */
export async function getPdfPreview(filePath: string, key: string): Promise<string | null> {
  const cachePath = path.join(PREVIEW_DIR, `${key}.pdf`)
  const src = await fs.stat(filePath)
  try {
    const cached = await fs.stat(cachePath)
    if (cached.mtimeMs >= src.mtimeMs) return cachePath
  } catch {
    // sin caché todavía
  }
  let job = inFlight.get(cachePath)
  if (!job) {
    job = enCola(() => build(filePath, cachePath)).finally(() => inFlight.delete(cachePath))
    inFlight.set(cachePath, job)
  }
  return job
}

/** Responde con el PDF de un documento de Office (415 si no es convertible, 404 si falta, 502 si LibreOffice falla). */
export async function servirPdfPreview(res: Response, filePath: string, key: string): Promise<void> {
  if (!isOfficeDoc(filePath)) {
    res.status(415).json({ error: "Este tipo de archivo no se convierte a PDF" })
    return
  }
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" })
    return
  }
  const pdf = await getPdfPreview(filePath, key)
  if (!pdf) {
    res.status(502).json({ error: "No se pudo convertir el documento a PDF" })
    return
  }
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", "inline")
  fsSync.createReadStream(pdf).pipe(res)
}
