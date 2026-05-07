import { api } from "@/lib/api"
import type { TaskFilters } from "@/types/workTask"

const BASE = "/api/herramientas/tareas"

function filtersToParams(filters: TaskFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.fecha_desde) p.set("fecha_desde", filters.fecha_desde)
  if (filters.fecha_hasta) p.set("fecha_hasta", filters.fecha_hasta)
  if (filters.responsable_id != null) p.set("responsable_id", String(filters.responsable_id))
  if (filters.estado) p.set("estado", filters.estado)
  if (filters.etiqueta) p.set("etiqueta", filters.etiqueta)
  if (filters.plataforma) p.set("plataforma", filters.plataforma)
  if (filters.q) p.set("q", filters.q)
  if (filters.sin_registro_hoy) p.set("sin_registro_hoy", "true")
  return p
}

async function downloadBlob(url: string, filename: string): Promise<void> {
  const { data } = await api.get(url, { responseType: "blob" })
  const blobUrl = URL.createObjectURL(data as Blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

export async function exportTasksExcel(filters: TaskFilters = {}): Promise<void> {
  await downloadBlob(`${BASE}/equipo/export/excel?${filtersToParams(filters)}`, "tareas.xlsx")
}

export async function exportTasksPdf(filters: TaskFilters = {}): Promise<void> {
  await downloadBlob(`${BASE}/equipo/export/pdf?${filtersToParams(filters)}`, "tareas.pdf")
}
