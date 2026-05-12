import type { TaskFilters, PersonTaskSummary } from "@/types/workTask"
import { useTaskLists } from "@/hooks/useWorkTasks"
import { taskInput, taskLabel, taskButtonSecondary } from "@/lib/taskTheme"

interface TaskFiltersBarProps {
  filters: TaskFilters
  onChange: (filters: TaskFilters) => void
  teamMembers?: PersonTaskSummary[]
}

export function TaskFiltersBar({ filters, onChange, teamMembers }: TaskFiltersBarProps) {
  const { data: lists } = useTaskLists()
  const estados = lists?.estado ?? []
  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []

  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch })

  const clear = () =>
    onChange({
      fecha_desde: undefined,
      fecha_hasta: undefined,
      responsable_id: undefined,
      estado: undefined,
      etiqueta: undefined,
      plataforma: undefined,
      q: undefined,
      sin_registro_hoy: undefined,
    })

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[120px]">
          <label className={taskLabel}>Desde</label>
          <input
            type="date"
            className={taskInput}
            value={filters.fecha_desde ?? ""}
            onChange={(e) => set({ fecha_desde: e.target.value || undefined })}
          />
        </div>

        <div className="min-w-[120px]">
          <label className={taskLabel}>Hasta</label>
          <input
            type="date"
            className={taskInput}
            value={filters.fecha_hasta ?? ""}
            onChange={(e) => set({ fecha_hasta: e.target.value || undefined })}
          />
        </div>

        {teamMembers && teamMembers.length > 0 && (
          <div className="min-w-[160px]">
            <label className={taskLabel}>Responsable</label>
            <select
              className={taskInput}
              value={filters.responsable_id ?? ""}
              onChange={(e) =>
                set({ responsable_id: e.target.value ? Number(e.target.value) : undefined })
              }
            >
              <option value="">Todos</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-w-[130px]">
          <label className={taskLabel}>Estado</label>
          <select
            className={taskInput}
            value={filters.estado ?? ""}
            onChange={(e) => set({ estado: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {estados.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[150px]">
          <label className={taskLabel}>Etiqueta</label>
          <select
            className={taskInput}
            value={filters.etiqueta ?? ""}
            onChange={(e) => set({ etiqueta: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {etiquetas.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[130px]">
          <label className={taskLabel}>Plataforma</label>
          <select
            className={taskInput}
            value={filters.plataforma ?? ""}
            onChange={(e) => set({ plataforma: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {plataformas.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label className={taskLabel}>Buscar</label>
          <input
            className={taskInput}
            placeholder="Buscar tarea..."
            value={filters.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <input
            id="sin-registro-hoy"
            type="checkbox"
            checked={filters.sin_registro_hoy ?? false}
            onChange={(e) => set({ sin_registro_hoy: e.target.checked || undefined })}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
          />
          <label htmlFor="sin-registro-hoy" className="text-xs font-medium text-gray-700 cursor-pointer whitespace-nowrap">
            Sin registro hoy
          </label>
        </div>

        <div className="pb-0.5">
          <button type="button" className={taskButtonSecondary} onClick={clear}>
            Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  )
}
