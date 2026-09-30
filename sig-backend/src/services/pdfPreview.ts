import fs from "fs/promises"
import path from "path"
import { tryLibreOfficeConvert } from "./textExtraction"

// Cache del PDF generado desde .docx/.doc para la previsualización. Se guarda
// junto a los originales (volumen sig_uploads) y se invalida si el original cambia.
const PREVIEW_DIR = path.join(process.cwd(), "uploads", "sig", "_preview")
const inFlight = new Map<string, Promise<string | null>>()

export function isOfficeDoc(filePath: string): boolean {
  return /\.(docx?|DOCX?)$/.test(filePath)
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

/** Devuelve la ruta a un PDF equivalente del .doc/.docx, o null si LibreOffice falla. */
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
    job = build(filePath, cachePath).finally(() => inFlight.delete(cachePath))
    inFlight.set(cachePath, job)
  }
  return job
}
