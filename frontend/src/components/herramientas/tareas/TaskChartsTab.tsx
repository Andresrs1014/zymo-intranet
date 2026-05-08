import { useState } from "react"
import { TaskCharts } from "./TaskCharts"
import { useTeamCharts, useMyTaskMetrics } from "@/hooks/useWorkTasks"
import type { TaskFilters } from "@/types/workTask"
import { TaskFiltersBar } from "./TaskFiltersBar"

interface Props {
  isManager: boolean
}

export function TaskChartsTab({ isManager }: Props) {
  const [filters, setFilters] = useState<TaskFilters>({})

  const { data: teamCharts } = useTeamCharts(isManager ? filters : {})
  const { data: myMetrics } = useMyTaskMetrics()

  if (isManager) {
    const chartsData = teamCharts as {
      tareas_por_responsable: { nombre: string; tareas: number }[]
      horas_por_responsable: { nombre: string; horas: number }[]
      distribucion_estado: { estado: string; cantidad: number }[]
      tareas_por_etiqueta: { etiqueta: string; cantidad: number }[]
      evolucion_completadas: { fecha: string; completadas: number }[]
    } | undefined

    return (
      <div className="space-y-4">
        <TaskFiltersBar filters={filters} onChange={setFilters} />
        <TaskCharts data={chartsData} />
      </div>
    )
  }

  // Non-manager: show personal metrics summary
  const metrics = myMetrics as {
    tareas_registradas?: number
    horas_registradas?: number
    completadas?: number
    en_progreso?: number
    bloqueadas?: number
  } | undefined

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Resumen de mis tareas</p>
      {metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Tareas registradas" value={metrics.tareas_registradas ?? 0} />
          <MetricCard label="Horas registradas" value={metrics.horas_registradas ?? 0} />
          <MetricCard label="Completadas" value={metrics.completadas ?? 0} />
          <MetricCard label="En progreso" value={metrics.en_progreso ?? 0} />
          <MetricCard label="Bloqueadas" value={metrics.bloqueadas ?? 0} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">Cargando métricas...</p>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  )
}
