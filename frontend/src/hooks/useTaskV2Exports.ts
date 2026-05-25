import { taskApi } from "@/lib/taskApi"

interface ExportFilters {
  teamId: number
  search?: string
  estado?: string
  etiqueta?: string
  plataforma?: string
  fechaDesde?: string
  fechaHasta?: string
  responsableId?: number
  prioridad?: string
}

function buildParams(filters: ExportFilters): URLSearchParams {
  const p = new URLSearchParams({ teamId: String(filters.teamId) })
  if (filters.search) p.set("search", filters.search)
  if (filters.estado) p.set("estado", filters.estado)
  if (filters.etiqueta) p.set("etiqueta", filters.etiqueta)
  if (filters.plataforma) p.set("plataforma", filters.plataforma)
  if (filters.fechaDesde) p.set("fechaDesde", filters.fechaDesde)
  if (filters.fechaHasta) p.set("fechaHasta", filters.fechaHasta)
  if (filters.responsableId) p.set("responsableId", String(filters.responsableId))
  if (filters.prioridad) p.set("prioridad", filters.prioridad)
  return p
}

async function downloadBlob(url: string, filename: string): Promise<void> {
  const { data } = await taskApi.get(url, { responseType: "blob" })
  const blobUrl = URL.createObjectURL(data as Blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

export async function exportTasksV2Excel(filters: ExportFilters): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  await downloadBlob(`/api/exports/excel?${buildParams(filters)}`, `tareas_${date}.xlsx`)
}

export async function exportTasksV2Pdf(filters: ExportFilters): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  await downloadBlob(`/api/exports/pdf?${buildParams(filters)}`, `tareas_${date}.pdf`)
}
