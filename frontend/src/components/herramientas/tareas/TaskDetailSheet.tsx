import { useState, useEffect } from "react"
import type { WorkTask, TaskAttachment, WorkTaskUpdate } from "@/types/workTask"
import { useTaskLists, useUpdateWorkTask } from "@/hooks/useWorkTasks"
import { useTaskAttachments } from "@/hooks/useTaskAttachments"
import { FileUploadZone } from "./FileUploadZone"
import { AttachmentList } from "./AttachmentList"
import { FilePreviewModal } from "./FilePreviewModal"
import {
  taskBadge,
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
  ETIQUETA_COLOR,
  ESTADO_COLOR,
  ETIQUETA_LABELS,
  PLATAFORMA_LABELS,
  ESTADO_LABELS,
  formatMinutos,
} from "@/lib/taskTheme"

interface TaskDetailSheetProps {
  task: WorkTask | null
  onClose: () => void
  onStatusChange?: (taskId: number, newEstado: string) => Promise<void>
  currentUserId?: number
}

export function TaskDetailSheet({ task, onClose, onStatusChange, currentUserId }: TaskDetailSheetProps) {
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const { data: lists } = useTaskLists()
  const estadoOptions = lists?.estado ?? []
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null)
  const { data: liveAdjuntos } = useTaskAttachments(task ? task.id : null)
  const adjuntos = liveAdjuntos ?? task?.adjuntos ?? []

  const [isEditing, setIsEditing] = useState(false)
  const [editFields, setEditFields] = useState<WorkTaskUpdate>({})
  const [editError, setEditError] = useState<string | null>(null)

  const updateTask = useUpdateWorkTask()
  const isOwner = currentUserId != null && task?.subido_por_id === currentUserId

  const etiquetaOptions = lists?.etiqueta ?? []
  const plataformaOptions = lists?.plataforma ?? []

  // Reset edit state when task changes
  useEffect(() => {
    setIsEditing(false)
    setEditError(null)
    setStatusError(null)
    setIsChangingStatus(false)
  }, [task?.id])

  if (!task) return null

  const handleStatusChange = async (newEstado: string) => {
    if (!onStatusChange || newEstado === task.estado) return
    setIsChangingStatus(true)
    setStatusError(null)
    try {
      await onStatusChange(task.id, newEstado)
    } catch {
      setStatusError("Error al cambiar el estado.")
    } finally {
      setIsChangingStatus(false)
    }
  }

  const enterEditMode = () => {
    setEditFields({
      titulo: task.titulo,
      descripcion_tecnica: task.descripcion_tecnica,
      etiqueta: task.etiqueta,
      plataforma: task.plataforma,
      estado: task.estado,
      prioridad: task.prioridad,
      fecha: task.fecha,
      hora_inicio: task.hora_inicio ?? undefined,
      hora_cierre: task.hora_cierre ?? undefined,
    })
    setEditError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditError(null)
  }

  const updateField = <K extends keyof WorkTaskUpdate>(key: K, value: WorkTaskUpdate[K]) => {
    setEditFields((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveEdit = async () => {
    if (!task) return
    setEditError(null)
    try {
      await updateTask.mutateAsync({ id: task.id, payload: editFields })
      setIsEditing(false)
      onClose()
    } catch (err: unknown) {
      if (
        typeof err === "object" && err !== null &&
        "response" in err &&
        (err as { response?: { status?: number } }).response?.status === 403
      ) {
        setEditError("No tienes permiso para editar esta tarea.")
      } else {
        setEditError("Error al guardar los cambios. Intenta de nuevo.")
      }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={isEditing ? cancelEdit : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditing ? "Editar tarea" : "Detalle de tarea"}
          </h2>
          <div className="flex items-center gap-2">
            {isOwner && !isEditing && (
              <button
                type="button"
                onClick={enterEditMode}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={isEditing ? cancelEdit : onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label={isEditing ? "Cancelar edición" : "Cerrar"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className={taskLabel}>Título *</label>
                <input
                  className={taskInput}
                  value={editFields.titulo ?? ""}
                  onChange={(e) => updateField("titulo", e.target.value)}
                  placeholder="Título de la tarea"
                  required
                />
              </div>

              <div>
                <label className={taskLabel}>Descripción técnica</label>
                <textarea
                  className={`${taskInput} resize-none`}
                  rows={4}
                  value={editFields.descripcion_tecnica ?? ""}
                  onChange={(e) => updateField("descripcion_tecnica", e.target.value)}
                  placeholder="Detalle técnico..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={taskLabel}>Etiqueta</label>
                  <select className={taskInput} value={editFields.etiqueta ?? ""} onChange={(e) => updateField("etiqueta", e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {etiquetaOptions.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className={taskLabel}>Plataforma</label>
                  <select className={taskInput} value={editFields.plataforma ?? ""} onChange={(e) => updateField("plataforma", e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {plataformaOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className={taskLabel}>Estado</label>
                  <select className={taskInput} value={editFields.estado ?? ""} onChange={(e) => updateField("estado", e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {estadoOptions.map((s) => <option key={s.value} value={s.value}>{s.label}{s.is_final ? " 🏁" : s.is_canceled ? " ✕" : ""}</option>)}
                  </select>
                </div>

                <div>
                  <label className={taskLabel}>Prioridad</label>
                  <select className={taskInput} value={editFields.prioridad ?? ""} onChange={(e) => updateField("prioridad", e.target.value)}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>

                <div>
                  <label className={taskLabel}>Fecha</label>
                  <input type="date" className={taskInput} value={editFields.fecha ?? ""} onChange={(e) => updateField("fecha", e.target.value)} />
                </div>

                <div>
                  <label className={taskLabel}>Hora inicio</label>
                  <input
                    type="time"
                    className={taskInput}
                    value={editFields.hora_inicio ? new Date(editFields.hora_inicio).toTimeString().slice(0, 5) : ""}
                    onChange={(e) => {
                      const fecha = editFields.fecha ?? task.fecha
                      updateField("hora_inicio", e.target.value ? new Date(`${fecha}T${e.target.value}:00`).toISOString() : undefined)
                    }}
                  />
                </div>

                <div className="col-span-2">
                  <label className={taskLabel}>Hora cierre</label>
                  <input
                    type="time"
                    className={taskInput}
                    value={editFields.hora_cierre ? new Date(editFields.hora_cierre).toTimeString().slice(0, 5) : ""}
                    onChange={(e) => {
                      const fecha = editFields.fecha ?? task.fecha
                      updateField("hora_cierre", e.target.value ? new Date(`${fecha}T${e.target.value}:00`).toISOString() : undefined)
                    }}
                  />
                </div>
              </div>

              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {editError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" className={taskButtonPrimary} onClick={handleSaveEdit} disabled={updateTask.isPending}>
                  {updateTask.isPending ? "Guardando..." : "Guardar cambios"}
                </button>
                <button type="button" className={taskButtonSecondary} onClick={cancelEdit}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Título</p>
                <p className="text-sm font-semibold text-gray-900">{task.titulo}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Responsable" value={task.subido_por_nombre} />
                <Field label="Fecha" value={task.fecha} />
                <Field label="Tiempo registrado" value={formatMinutos(task.tiempo_total_minutos)} />

                {/* Estado — inline changer if onStatusChange provided */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Estado</p>
                  {onStatusChange && estadoOptions.length > 0 ? (
                    <div className="space-y-1">
                      <select
                        value={task.estado}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={isChangingStatus}
                        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
                      >
                        {estadoOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                            {opt.is_final ? " 🏁" : opt.is_canceled ? " ✕" : ""}
                          </option>
                        ))}
                      </select>
                      {statusError && <p className="text-xs text-red-500">{statusError}</p>}
                      {isChangingStatus && <p className="text-xs text-gray-400">Guardando...</p>}
                    </div>
                  ) : (
                    <span className={`${taskBadge} ${ESTADO_COLOR[task.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {ESTADO_LABELS[task.estado] ?? task.estado}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Etiqueta</p>
                  <span className={`${taskBadge} ${ETIQUETA_COLOR[task.etiqueta] ?? "bg-gray-100 text-gray-600"}`}>
                    {ETIQUETA_LABELS[task.etiqueta] ?? task.etiqueta}
                  </span>
                </div>
                <Field label="Plataforma" value={PLATAFORMA_LABELS[task.plataforma] ?? task.plataforma} />
              </div>

              {task.hora_inicio && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Hora inicio" value={formatHora(task.hora_inicio)} />
                  {task.hora_cierre && (
                    <Field label="Hora cierre" value={formatHora(task.hora_cierre)} />
                  )}
                </div>
              )}

              {task.descripcion_tecnica && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Descripción técnica</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {task.descripcion_tecnica}
                  </p>
                </div>
              )}

              {/* Evidencias */}
              <div className="border-t border-gray-200 pt-4">
                <FileUploadZone taskId={task.id} />
                <AttachmentList
                  taskId={task.id}
                  attachments={adjuntos}
                  onPreview={setPreviewAttachment}
                />
              </div>
            </>
          )}
        </div>
      </aside>

      <FilePreviewModal
        attachment={previewAttachment}
        open={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  )
}

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
}
