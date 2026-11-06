/** Cabecera Content-Disposition "inline" con el nombre en UTF-8 (RFC 5987): un nombre con comillas tipográficas, emojis o
 *  acentos raros en el valor crudo hace que Node lance ERR_INVALID_CHAR y la respuesta sea un 500. */
export function inline(nombre: string | null | undefined): string {
  const limpio = (nombre || "archivo").replace(/[\r\n]/g, " ")
  return `inline; filename*=UTF-8''${encodeURIComponent(limpio).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`
}

const DOCX = "application/vnd.openxmlformats-officedocument."
const TIPO_POR_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".bmp": "image/bmp", ".avif": "image/avif",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".mp4": "video/mp4", ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".markdown": "text/markdown; charset=utf-8",
  ".doc": "application/msword",
  ".docx": `${DOCX}wordprocessingml.document`,
  ".xls": "application/vnd.ms-excel",
  ".xlsx": `${DOCX}spreadsheetml.sheet`,
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": `${DOCX}presentationml.presentation`,
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
}

/** Tipo de contenido derivado SOLO de la extensión (lista cerrada). Nunca se confía en el tipo declarado al subir:
 *  .html/.svg/.xml/.js y cualquier otro van como octet-stream para que el navegador no los ejecute en el origen de la intranet. */
export function tipoSeguro(nombre: string | null | undefined): string {
  const m = /\.[^.\/]*$/.exec(nombre || "")
  const ext = m ? m[0].toLowerCase() : ""
  return Object.prototype.hasOwnProperty.call(TIPO_POR_EXT, ext) ? TIPO_POR_EXT[ext] : "application/octet-stream"
}

/** Cabeceras para servir un archivo original: tipo por extensión + nosniff + nombre en UTF-8.
 *  `nombreTipo` permite derivar el tipo de otro nombre (p. ej. el guardado en disco) si `nombre` viene vacío. */
export function cabecerasArchivo(
  res: { setHeader(k: string, v: string): unknown },
  nombre: string | null | undefined,
  nombreTipo?: string | null,
): void {
  res.setHeader("Content-Type", tipoSeguro(nombre || nombreTipo))
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Content-Disposition", inline(nombre || nombreTipo))
}
