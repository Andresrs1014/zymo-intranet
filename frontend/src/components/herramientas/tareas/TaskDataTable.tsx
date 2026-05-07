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

interface TaskDataTableProps {
  tasks: WorkTask[]
  onRowClick: (task: WorkTask) => void
}

export function TaskDataTable({ tasks, onRowClick }: TaskDataTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="py-12 text-center text-sm text-gray-400">
          No hay tareas para mostrar.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              <Th>Responsable</Th>
              <Th>Tarea</Th>
              <Th>Fecha</Th>
              <Th>Etiqueta</Th>
              <Th>Plataforma</Th>
              <Th>Tiempo</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((task, idx) => (
              <tr
                key={task.id}
                onClick={() => onRowClick(task)}
                className={[
                  "cursor-pointer transition-colors",
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                  "hover:bg-blue-50/40",
                ].join(" ")}
              >
                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                  {task.subido_por_nombre}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-[220px]">
                  <span className="line-clamp-2" title={task.titulo}>
                    {task.titulo}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {task.fecha}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`${taskBadge} ${ETIQUETA_COLOR[task.etiqueta] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {ETIQUETA_LABELS[task.etiqueta] ?? task.etiqueta}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {PLATAFORMA_LABELS[task.plataforma] ?? task.plataforma}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {formatMinutos(task.tiempo_total_minutos)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`${taskBadge} ${ESTADO_COLOR[task.estado] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {ESTADO_LABELS[task.estado] ?? task.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
      {children}
    </th>
  )
}
