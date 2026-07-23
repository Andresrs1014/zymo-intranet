// ── Reportes de Desarrollo — constantes y utilidades compartidas ───────────────
// Centraliza la paleta por proyecto, formatters de fecha/horas y el conjunto
// de clases `prose` estilo Typora para que la card, la vista de detalle y el
// editor no dupliquen lógica.

import type { ReporteDesarrollo } from "@/lib/reportesApi"

/** Paleta por proyecto. Si el proyecto no está acá, se usa zinc neutro. */
export const PROYECTO_COLORS: Record<string, string> = {
  Helix: "#3b82f6",
  Intranet: "#a855f7",
  ZymoAlly: "#d43a56",
  Sig: "#10b981",
  Mantenimiento: "#f59e0b",
}

/** Devuelve el color (hex) asociado a un proyecto, o zinc-500 si no existe. */
export function colorForProyecto(proyecto: string): string {
  return PROYECTO_COLORS[proyecto] ?? "#71717a"
}

/** Formatea una fecha ISO a "miércoles, 23 de julio de 2026" (es-CO). */
export function formatFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

/** Formatea una fecha ISO a "miércoles, 23 jul" (es-CO, formato corto). */
export function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Devuelve "8h" o "—" si es null. */
export function formatHoras(h: number | null | undefined): string {
  if (h == null) return "—"
  return `${h}h`
}

/** Tailwind: el `prose` con la estética Typora del módulo. Usado por el editor y la vista detalle. */
export const PROSE_TYPORA = `prose prose-sm max-w-none
  prose-headings:font-mono prose-headings:text-zinc-700 prose-headings:font-semibold
  prose-headings:text-[13px] prose-headings:text-balance
  prose-p:text-zinc-600 prose-p:text-[13px] prose-p:leading-relaxed
  prose-strong:text-zinc-800 prose-strong:font-semibold
  prose-li:text-zinc-600 prose-li:text-[13px] prose-li:leading-relaxed
  prose-ul:space-y-1.5 prose-ol:space-y-1.5 prose-ul:my-3 prose-ol:my-3
  prose-code:text-zinc-800 prose-code:bg-zinc-100 prose-code:px-1 prose-code:rounded
  prose-code:text-[11px] prose-code:font-mono
  prose-code:before:content-none prose-code:after:content-none
  prose-table:text-[12px]
  prose-th:text-zinc-600 prose-th:font-mono prose-th:font-semibold prose-th:text-[11px]
  prose-th:border prose-th:border-zinc-200 prose-th:px-3 prose-th:py-1.5 prose-th:bg-zinc-50
  prose-td:text-zinc-600 prose-td:text-[12px]
  prose-td:border prose-td:border-zinc-100 prose-td:px-3 prose-td:py-1.5
  prose-hr:border-zinc-200`

/** Tipos derivados — alias del modelo para que el código sea más legible. */
export type Reporte = ReporteDesarrollo
