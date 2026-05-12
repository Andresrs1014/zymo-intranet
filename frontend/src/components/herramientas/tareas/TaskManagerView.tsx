import { useState } from "react"
import type { WorkTask, TaskFilters, WorkTaskCreate } from "@/types/workTask"
import {
  useTeamTasks,
  useTeamKpis,
  useUsersWithoutTodayEntry,
  useCreateWorkTask,
} from "@/hooks/useWorkTasks"
import { exportTasksExcel, exportTasksPdf } from "@/hooks/useTaskExports"
import { TaskDataTable } from "./TaskDataTable"
import { TaskDetailSheet } from "./TaskDetailSheet"
import { TaskTeamConfigDialog } from "./TaskTeamConfigDialog"
import { TaskForm } from "./TaskForm"
import {
  taskCard,
  taskButtonPrimary,
  taskButtonSecondary,
  formatMinutos,
} from "@/lib/taskTheme"

interface Props {
  canSubmitOwn?: boolean
  filters: TaskFilters
}

export function TaskManagerView({ canSubmitOwn, filters }: Props) {
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [teamConfigOpen, setTeamConfigOpen] = useState(false)
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const createTask = useCreateWorkTask()

  const { data: tasks } = useTeamTasks(filters)
  const { data: kpis } = useTeamKpis(filters)
  const { data: sinRegistro } = useUsersWithoutTodayEntry()

  const handleExportExcel = async () => {
    setExporting("excel")
    try { await exportTasksExcel(filters) } finally { setExporting(null) }
  }

  const handleExportPdf = async () => {
    setExporting("pdf")
    try { await exportTasksPdf(filters) } finally { setExporting(null) }
  }

  const handleNewTaskSubmit = async (payload: WorkTaskCreate) => {
    await createTask.mutateAsync(payload)
    setShowNewTaskForm(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de tareas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Equipo de Desarrollo e Innovación</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={taskButtonSecondary} onClick={handleExportExcel} disabled={exporting !== null}>
            {exporting === "excel" ? "Exportando..." : "Exportar Excel"}
          </button>
          <button type="button" className={taskButtonSecondary} onClick={handleExportPdf} disabled={exporting !== null}>
            {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
          </button>
          {canSubmitOwn && (
            <button type="button" className={taskButtonPrimary} onClick={() => setShowNewTaskForm((v) => !v)}>
              {showNewTaskForm ? "Cancelar" : "+ Nueva tarea"}
            </button>
          )}
        </div>
      </div>

      {showNewTaskForm && canSubmitOwn && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva tarea</h2>
          <TaskForm onSubmit={handleNewTaskSubmit} onCancel={() => setShowNewTaskForm(false)} loading={createTask.isPending} />
        </div>
      )}

      {sinRegistro && sinRegistro.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>{sinRegistro.length} miembro{sinRegistro.length > 1 ? "s" : ""} sin registro hoy:</strong>{" "}
          {sinRegistro.map((u: { nombre: string }) => u.nombre).join(", ")}.
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Tareas" value={kpis.tareas_registradas} />
          <KpiCard label="Horas" value={formatMinutos(kpis.horas_registradas * 60)} />
          <KpiCard label="Completadas" value={kpis.completadas} color="text-green-700" />
          <KpiCard label="En progreso" value={kpis.en_progreso} color="text-blue-700" />
          <KpiCard label="Bloqueadas" value={kpis.bloqueadas} color="text-red-700" />
          <KpiCard label="Usuarios activos" value={kpis.usuarios_activos} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Tareas ({tasks?.length ?? 0})
        </h2>
        <TaskDataTable tasks={tasks ?? []} onRowClick={(t) => setSelectedTask(t)} />
      </div>

      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
      <TaskTeamConfigDialog open={teamConfigOpen} onClose={() => setTeamConfigOpen(false)} />
    </div>
  )
}

function KpiCard({ label, value, color = "text-gray-900" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className={`${taskCard} p-4`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}