import type { WorkTask } from "@/types/workTask"
import {
  taskBadge,
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
}

export function TaskDetailSheet({ task, onClose }: TaskDetailSheetProps) {
  if (!task) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Detalle de tarea</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Título</p>
            <p className="text-sm font-semibold text-gray-900">{task.titulo}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsable" value={task.subido_por_nombre} />
            <Field label="Fecha" value={task.fecha} />
            <Field label="Tiempo registrado" value={formatMinutos(task.tiempo_total_minutos)} />
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Estado</p>
              <span className={`${taskBadge} ${ESTADO_COLOR[task.estado] ?? "bg-gray-100 text-gray-600"}`}>
                {ESTADO_LABELS[task.estado] ?? task.estado}
              </span>
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
        </div>
      </aside>
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
  try {
    return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}
