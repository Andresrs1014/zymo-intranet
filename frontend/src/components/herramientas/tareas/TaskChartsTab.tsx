import { useState } from "react"
import { TaskCharts } from "./TaskCharts"
import { useTeamCharts, useMyTaskMetrics } from "@/hooks/useWorkTasks"
import type { TaskFilters } from "@/types/workTask"
import { TaskFiltersBar } from "./TaskFiltersBar"

interface Props {
  isManager: boolean
  teamId?: number
}

export function TaskChartsTab({ isManager, teamId }: Props) {
  const [filters, setFilters] = useState<TaskFilters>({})

  const { data: teamCharts } = useTeamCharts(isManager ? filters : {})
  const { data: myMetrics } = useMyTaskMetrics()

  if (isManager) {
    return (
      <div className="space-y-4">
        <TaskFiltersBar filters={filters} onChange={setFilters} teamId={teamId} />
        <TaskCharts data={teamCharts} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Resumen de mis tareas</p>
      {myMetrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard label="Tareas registradas" value={myMetrics.tareas_registradas ?? 0} />
          <MetricCard label="Horas registradas" value={myMetrics.horas_registradas ?? 0} />
          <MetricCard label="Completadas" value={myMetrics.completadas ?? 0} />
          <MetricCard label="En progreso" value={myMetrics.en_progreso ?? 0} />
          <MetricCard label="Bloqueadas" value={myMetrics.bloqueadas ?? 0} />
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
