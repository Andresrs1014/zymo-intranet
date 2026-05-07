// Centralized style tokens for the task management module
export const taskSurface = "bg-white border border-gray-200 shadow-sm"
export const taskCard = "rounded-xl bg-white border border-gray-200 shadow-sm"
export const taskButtonPrimary = "rounded-lg bg-gray-950 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
export const taskButtonSecondary = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
export const taskButtonDanger = "rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
export const taskInput = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
export const taskLabel = "block text-xs font-medium text-gray-700 mb-1"
export const taskBadge = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"

export const ETIQUETA_COLOR: Record<string, string> = {
  desarrollos: "bg-blue-100 text-blue-700",
  actualizaciones: "bg-purple-100 text-purple-700",
  auditorias: "bg-orange-100 text-orange-700",
  implementacion_okr: "bg-teal-100 text-teal-700",
  tareas_diarias: "bg-gray-100 text-gray-600",
}

export const ESTADO_COLOR: Record<string, string> = {
  en_progreso: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
  bloqueada: "bg-red-100 text-red-700",
}

export const ETIQUETA_LABELS: Record<string, string> = {
  desarrollos: "Desarrollos",
  actualizaciones: "Actualizaciones",
  auditorias: "Auditorías",
  implementacion_okr: "Implementación OKR",
  tareas_diarias: "Tareas Diarias",
}

export const PLATAFORMA_LABELS: Record<string, string> = {
  logimat1: "Logimat 1",
  logimat2: "Logimat 2",
  imccargo: "IMCCARGO",
  imcdeposito: "IMC Depósito",
  transversal: "Transversal",
}

export const ESTADO_LABELS: Record<string, string> = {
  en_progreso: "En progreso",
  completada: "Completada",
  bloqueada: "Bloqueada",
}

export function formatMinutos(min: number | null | undefined): string {
  if (min == null || min <= 0) return "—"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
