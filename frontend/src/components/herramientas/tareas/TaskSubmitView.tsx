import { useState } from "react"
import {
  useMyTasks,
  useMyTaskMetrics,
  useCreateWorkTask,
} from "@/hooks/useWorkTasks"
import type { WorkTask, WorkTaskCreate, TaskFilters } from "@/types/workTask"
import { TaskForm } from "./TaskForm"
import { TaskFiltersBar } from "./TaskFiltersBar"
import { TaskDataTable } from "./TaskDataTable"
import { TaskDetailSheet } from "./TaskDetailSheet"
import { taskButtonPrimary, taskCard, formatMinutos } from "@/lib/taskTheme"

export function TaskSubmitView() {
  const today = new Date().toISOString().slice(0, 10)

  const [showForm, setShowForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [filters, setFilters] = useState<TaskFilters>({})

  const { data: metrics } = useMyTaskMetrics()
  const { data: todayTasks } = useMyTasks({ fecha_desde: today, fecha_hasta: today })
  const { data: allTasks } = useMyTasks(filters)
  const createTask = useCreateWorkTask()

  const registeredToday = (todayTasks?.length ?? 0) > 0

  const handleSubmit = async (payload: WorkTaskCreate) => {
    await createTask.mutateAsync(payload)
    setShowForm(false)
  }

  const kpis = metrics as {
    tareas_registradas?: number
    horas_registradas?: number
    completadas?: number
    en_progreso?: number
    bloqueadas?: number
  } | undefined

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Registro de tareas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Desarrollo e Innovación</p>
        </div>
        <button
          type="button"
          className={taskButtonPrimary}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "+ Nueva tarea"}
        </button>
      </div>

      {/* Alert: no registro hoy */}
      {!registeredToday && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <strong>Recuerda:</strong> Aún no has registrado ninguna tarea hoy ({today}).
        </div>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Tareas totales" value={kpis.tareas_registradas ?? 0} />
          <KpiCard
            label="Horas registradas"
            value={formatMinutos((kpis.horas_registradas ?? 0) * 60)}
          />
          <KpiCard label="Completadas" value={kpis.completadas ?? 0} color="text-green-700" />
          <KpiCard label="En progreso" value={kpis.en_progreso ?? 0} color="text-blue-700" />
          {(kpis.bloqueadas ?? 0) > 0 && (
            <KpiCard label="Bloqueadas" value={kpis.bloqueadas ?? 0} color="text-red-700" />
          )}
        </div>
      )}

      {/* New task form */}
      {showForm && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva tarea</h2>
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            loading={createTask.isPending}
          />
        </div>
      )}

      {/* Task list */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Mis tareas</h2>
        </div>
        <TaskFiltersBar
          filters={filters}
          onChange={setFilters}
        />
        <div className="mt-4">
        <TaskDataTable
          tasks={allTasks ?? []}
          onRowClick={(t) => setSelectedTask(t)}
        />
        </div>
      </div>

      {/* Detail sheet */}
      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}

function KpiCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className={`${taskCard} p-4`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
