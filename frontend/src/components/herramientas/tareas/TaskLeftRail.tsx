import { SlidersHorizontal, Users } from "lucide-react"

interface Props {
  isPanelOpen: boolean
  onToggle: () => void
  hasActiveFilters: boolean
  hasSelectedPerson: boolean
  showTeam?: boolean
}

export function TaskLeftRail({
  isPanelOpen,
  onToggle,
  hasActiveFilters,
  hasSelectedPerson,
  showTeam = true,
}: Props) {
  const hasAnyActive = hasActiveFilters || hasSelectedPerson

  return (
    <div className="flex flex-col items-center gap-1 w-12 shrink-0 border-r border-border bg-background py-3">
      <button
        type="button"
        onClick={onToggle}
        title={isPanelOpen ? "Cerrar panel" : "Abrir filtros y equipo"}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          isPanelOpen
            ? "bg-gray-900 text-white"
            : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {hasAnyActive && !isPanelOpen && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
        )}
      </button>

      {showTeam && (
        <button
          type="button"
          onClick={onToggle}
          title={isPanelOpen ? "Cerrar panel" : "Ver equipo"}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            isPanelOpen
              ? "bg-gray-900 text-white"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Users className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}