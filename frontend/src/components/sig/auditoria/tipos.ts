import { BookOpen, ClipboardList, FileText, Paperclip, type LucideIcon } from "lucide-react"

export type TipoDoc = "procedimiento" | "instructivo" | "formato" | "anexo"
export type EstadoRevision = "PENDIENTE_REVISION" | "RECHAZADO"

/** Un documento que se puede leer en la vista de auditoría. Sin `base`, se lee `texto` (Markdown). */
export interface DocAuditoria {
  clave: string
  tipo: TipoDoc
  codigo?: string
  titulo: string
  /** Ruta del recurso («/api/formatos/12»); null si no tiene archivo. */
  base: string | null
  nombreArchivo: string | null
  mime: string | null
  texto: string | null
  /** Solo si NO está aprobado: la lista lo avisa. */
  estado?: EstadoRevision
}

/** El color vive solo en el ícono: orienta qué se lee sin competir con el rojo de la marca. */
export const ESTILO_TIPO: Record<TipoDoc, { singular: string; plural: string; icono: LucideIcon; color: string }> = {
  procedimiento: { singular: "Procedimiento", plural: "Procedimiento", icono: FileText, color: "text-red-500" },
  instructivo: { singular: "Instructivo", plural: "Instructivos", icono: BookOpen, color: "text-sky-500" },
  formato: { singular: "Formato", plural: "Formatos", icono: ClipboardList, color: "text-emerald-500" },
  anexo: { singular: "Doc anexo", plural: "Docs anexos", icono: Paperclip, color: "text-amber-500" },
}

/** Extensión en mayúsculas para la etiqueta del archivo («XLSX»), o null si no tiene. */
export function extensionDe(nombre: string | null): string | null {
  const partes = (nombre ?? "").split(".")
  return partes.length > 1 ? partes[partes.length - 1]!.toUpperCase() : null
}
