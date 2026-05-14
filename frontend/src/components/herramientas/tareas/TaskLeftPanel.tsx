import { X } from "lucide-react"
import type { TaskFilters, PersonTaskSummary } from "@/types/workTask"
import { useTaskLists } from "@/hooks/useWorkTasks"
import { PersonCompactList } from "./PersonCompactList"

interface Props {
  isOpen: boolean
  filters: TaskFilters
  onFiltersChange: (f: TaskFilters) => void
  persons: PersonTaskSummary[]
  onClose: () => void
}

export function TaskLeftPanel({
  isOpen,
  filters,
  onFiltersChange,
  persons,
  onClose,
}: Props) {
  const { data: lists } = useTaskLists()
  const estados = lists?.estado ?? []
  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []

  const set = (patch: Partial<TaskFilters>) =>
    onFiltersChange({ ...filters, ...patch })

  const clear = () =>
    onFiltersChange({
      fecha_desde: undefined,
      fecha_hasta: undefined,
      responsable_id: undefined,
      estado: undefined,
      etiqueta: undefined,
      plataforma: undefined,
      q: undefined,
      sin_registro_hoy: undefined,
    })

  const handleSelectPerson = (userId: number) => {
    set({ responsable_id: filters.responsable_id === userId ? undefined : userId })
  }

  const activeFilterCount = [
    filters.fecha_desde,
    filters.fecha_hasta,
    filters.estado,
    filters.etiqueta,
    filters.plataforma,
    filters.q,
    filters.sin_registro_hoy,
  ].filter(Boolean).length

  return (
    <div
      className={`flex flex-col border-r border-border bg-gray-50/60 overflow-hidden transition-all duration-200 ease-in-out shrink-0`}
      style={{ width: isOpen ? 260 : 0 }}
    >
      <div className="flex flex-col h-full w-[260px]">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {persons.length > 0 ? "Filtros y equipo" : "Filtros"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          <input
            type="text"
            placeholder="Buscar tarea..."
            value={filters.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />

          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Fecha
            </p>
            <div className="space-y-1.5">
              <input
                type="date"
                value={filters.fecha_desde ?? ""}
                onChange={(e) => set({ fecha_desde: e.target.value || undefined })}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              <input
                type="date"
                value={filters.fecha_hasta ?? ""}
                onChange={(e) => set({ fecha_hasta: e.target.value || undefined })}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {estados.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set({ estado: filters.estado === s.value ? undefined : s.value })}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    filters.estado === s.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Etiqueta
            </p>
            <div className="flex flex-wrap gap-1.5">
              {etiquetas.map((et) => (
                <button
                  key={et.value}
                  type="button"
                  onClick={() => set({ etiqueta: filters.etiqueta === et.value ? undefined : et.value })}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    filters.etiqueta === et.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {et.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Plataforma
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plataformas.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() =>
                    set({ plataforma: filters.plataforma === p.value ? undefined : p.value })
                  }
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    filters.plataforma === p.value
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.sin_registro_hoy ?? false}
              onChange={(e) => set({ sin_registro_hoy: e.target.checked || undefined })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
            />
            <span className="text-xs text-gray-600">Sin registro hoy</span>
          </label>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clear}
              className="w-full text-xs text-gray-400 hover:text-gray-700 transition-colors text-center py-1"
            >
              Limpiar {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""}
            </button>
          )}

          {persons.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Equipo
              </p>
              <PersonCompactList
                summaries={persons}
                selectedPersonId={filters.responsable_id}
                onSelect={handleSelectPerson}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}