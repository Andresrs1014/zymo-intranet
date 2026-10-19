/** Cabecera Content-Disposition "inline" con el nombre en UTF-8 (RFC 5987): un nombre con comillas tipográficas, emojis o
 *  acentos raros en el valor crudo hace que Node lance ERR_INVALID_CHAR y la respuesta sea un 500. */
export function inline(nombre: string | null | undefined): string {
  const limpio = (nombre || "archivo").replace(/[\r\n]/g, " ")
  return `inline; filename*=UTF-8''${encodeURIComponent(limpio).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`
}
