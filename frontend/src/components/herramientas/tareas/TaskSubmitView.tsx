import { useState } from "react"
import { ChevronDown, Trash2 } from "lucide-react"
import {
  useMyTasks,
  useMyTaskMetrics,
  useMyTeams,
  useCreateWorkTask,
  useUpdateWorkTask,
} from "@/hooks/useWorkTasks"
import { useTasks, useDeleteTask } from "@/hooks/useTasks"
import { useMyTeams as useMyTeamsV2 } from "@/hooks/useTaskTeams"
import { useAuthStore } from "@/store/authStore"
import type { WorkTask, WorkTaskCreate, TaskFilters } from "@/types/workTask"
import type { Task } from "@/types/task"
import { useUploadTaskAttachment } from "@/hooks/useTaskAttachments"
import { TaskForm } from "./TaskForm"
import { AsignarTareaForm } from "./AsignarTareaForm"
import { AttachmentExplorer } from "./AttachmentExplorer"
import { TaskDetailSheet } from "./TaskDetailSheet"
import { taskButtonPrimary, taskButtonSecondary, taskCard, formatMinutos } from "@/lib/taskTheme"

interface Props {
  filters: TaskFilters
  activeTeamId?: number
}

export function TaskSubmitView({ activeTeamId }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [showForm, setShowForm] = useState(false)
  const [showAsignarForm, setShowAsignarForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [explorerTask, setExplorerTask] = useState<WorkTask | null>(null)
  const [selectedV2TeamId, setSelectedV2TeamId] = useState<number | undefined>(undefined)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const currentUser = useAuthStore((s) => s.user)
  const uploadAttachment = useUploadTaskAttachment()

  // V1 data (KPIs + reminder)
  const { data: metrics } = useMyTaskMetrics(activeTeamId)
  const { data: todayTasks } = useMyTasks({ fecha_desde: today, fecha_hasta: today, team_id: activeTeamId })
  const { data: myTeams = [] } = useMyTeams()
  const createTask = useCreateWorkTask()
  const updateTask = useUpdateWorkTask()

  // V2 data (task list)
  const { data: v2Teams = [] } = useMyTeamsV2()
  const activeV2TeamId = selectedV2TeamId ?? v2Teams[0]?.id
  const activeV2Team = v2Teams.find((t) => t.id === activeV2TeamId)
  const { data: v2TasksResult } = useTasks({ teamId: activeV2TeamId })
  const deleteTask = useDeleteTask()

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
            activeTeamId={activeTeamId}
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
            activeTeamId={activeTeamId}
          />
        </div>
      )}

      {/* V2 Task list with team selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Mis tareas</h2>

          {/* Team dropdown */}
          {v2Teams.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTeamDropdown((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <span>{activeV2Team?.name ?? "Seleccionar equipo"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
              {showTeamDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px]">
                  {v2Teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedV2TeamId(t.id)
                        setShowTeamDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                        t.id === activeV2TeamId ? "font-semibold text-red-600" : "text-gray-700"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {v2Teams.length === 1 && activeV2Team && (
            <span className="text-xs text-gray-400">{activeV2Team.name}</span>
          )}
        </div>

        {/* V2 task rows */}
        {(v2TasksResult?.tasks ?? []).length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-xl">
            No hay tareas registradas en este equipo.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(v2TasksResult?.tasks ?? []).map((task) => (
              <V2TaskRow
                key={task.id}
                task={task}
                onDelete={() => setTaskToDelete(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* V1 legacy detail sheet */}
      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        currentUserId={currentUser?.id}
        teamId={activeTeamId}
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

      {/* Delete confirmation */}
      {taskToDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 28, width: 380 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>¿Eliminar tarea?</h3>
            <p style={{ fontSize: 13, color: "#5c6374", margin: "0 0 20px" }}>
              Se eliminará <strong>"{taskToDelete.titulo}"</strong> de forma permanente.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setTaskToDelete(null)}
                style={{ flex: 1, padding: "9px", borderRadius: 7, border: "1px solid #d8dde8", background: "#f4f6fa", fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                disabled={deleteTask.isPending}
                onClick={async () => {
                  await deleteTask.mutateAsync(taskToDelete.id)
                  setTaskToDelete(null)
                }}
                style={{ flex: 1, padding: "9px", borderRadius: 7, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {deleteTask.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── V2 Task row ──────────────────────────────────────────────────────────────

function V2TaskRow({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const estadoColors: Record<string, string> = {
    pendiente: "#6b7280",
    en_progreso: "#3b82f6",
    revision: "#f59e0b",
    completada: "#10b981",
    cancelada: "#ef4444",
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      background: "#fff",
      borderRadius: 8,
      border: "1px solid #e8ebf4",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: estadoColors[task.estado] ?? "#6b7280",
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#121420", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.titulo}
          </div>
          <div style={{ fontSize: 11, color: "#9aa5b8", marginTop: 1 }}>
            {task.fecha ? task.fecha.slice(0, 10) : "—"} · {task.estado}
            {task.asignadoANombre && ` · ${task.asignadoANombre}`}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Eliminar tarea"
        style={{ padding: "5px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fff5f5", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", flexShrink: 0 }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

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
