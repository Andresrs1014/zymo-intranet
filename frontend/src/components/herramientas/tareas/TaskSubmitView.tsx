import { useState } from "react"
import {
  useMyTasks,
  useMyTaskMetrics,
  useMyTeams,
  useCreateWorkTask,
  useUpdateWorkTask,
} from "@/hooks/useWorkTasks"
import { useAuthStore } from "@/store/authStore"
import type { WorkTask, WorkTaskCreate, TaskFilters } from "@/types/workTask"
import { useUploadTaskAttachment } from "@/hooks/useTaskAttachments"
import { TaskForm } from "./TaskForm"
import { AsignarTareaForm } from "./AsignarTareaForm"
import { AttachmentExplorer } from "./AttachmentExplorer"
import { TaskDataTable } from "./TaskDataTable"
import { TaskDetailSheet } from "./TaskDetailSheet"
import { taskButtonPrimary, taskButtonSecondary, taskCard, formatMinutos } from "@/lib/taskTheme"

interface Props {
  filters: TaskFilters
}

export function TaskSubmitView({ filters }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [showForm, setShowForm] = useState(false)
  const [showAsignarForm, setShowAsignarForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [explorerTask, setExplorerTask] = useState<WorkTask | null>(null)
  const currentUser = useAuthStore((s) => s.user)
  const uploadAttachment = useUploadTaskAttachment()

  const { data: metrics } = useMyTaskMetrics()
  const { data: todayTasks } = useMyTasks({ fecha_desde: today, fecha_hasta: today })
  const { data: allTasks } = useMyTasks(filters)
  const { data: myTeams = [] } = useMyTeams()
  const createTask = useCreateWorkTask()
  const updateTask = useUpdateWorkTask()

  const registeredToday = (todayTasks?.length ?? 0) > 0
  const showTodayReminder = !registeredToday && myTeams.length > 0

  const handleSubmit = async (payload: WorkTaskCreate, files: File[]) => {
    const task = await createTask.mutateAsync(payload)
    for (const file of files) {
      await uploadAttachment.mutateAsync({ taskId: task.id, file })
    }
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
        <div className="flex gap-2">
          <button
            type="button"
            className={taskButtonSecondary}
            onClick={() => {
              setShowAsignarForm((v) => !v)
              setShowForm(false)
            }}
          >
            {showAsignarForm ? "Cancelar" : "Asignar tarea"}
          </button>
          <button
            type="button"
            className={taskButtonPrimary}
            onClick={() => {
              setShowForm((v) => !v)
              setShowAsignarForm(false)
            }}
          >
            {showForm ? "Cancelar" : "+ Nueva tarea"}
          </button>
        </div>
      </div>

      {/* Alert: no registro hoy */}
      {showTodayReminder && (
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

      {/* Asignar tarea form */}
      {showAsignarForm && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Asignar tarea a compañero</h2>
          <AsignarTareaForm
            onSubmit={async (payload) => {
              await createTask.mutateAsync(payload)
              setShowAsignarForm(false)
            }}
            onCancel={() => setShowAsignarForm(false)}
            loading={createTask.isPending}
          />
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
            blockSubmitWithoutTeam
          />
        </div>
      )}

      {/* Task list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Mis tareas</h2>
        <TaskDataTable
          tasks={allTasks ?? []}
          onRowClick={(t) => setSelectedTask(t)}
          onAttachmentsClick={(t) => setExplorerTask(t)}
        />
      </div>

      {/* Detail sheet */}
      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        currentUserId={currentUser?.id}
        onStatusChange={async (taskId, newEstado) => {
          await updateTask.mutateAsync({ id: taskId, payload: { estado: newEstado } })
          setSelectedTask((prev) => prev ? { ...prev, estado: newEstado } : null)
        }}
      />

      {explorerTask && (
        <AttachmentExplorer
          taskId={explorerTask.id}
          taskTitulo={explorerTask.titulo}
          open={!!explorerTask}
          onClose={() => setExplorerTask(null)}
        />
      )}
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
