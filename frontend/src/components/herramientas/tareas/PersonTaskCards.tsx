import type { PersonTaskSummary } from "@/types/workTask"
import { taskCard, formatMinutos } from "@/lib/taskTheme"

interface PersonTaskCardsProps {
  summaries: PersonTaskSummary[]
  onSelectPerson: (userId: number) => void
  selectedPersonId?: number
}

export function PersonTaskCards({ summaries, onSelectPerson, selectedPersonId }: PersonTaskCardsProps) {
  if (summaries.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        No hay miembros del equipo para mostrar.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {summaries.map((person) => {
        const isSelected = selectedPersonId === person.user_id
        return (
          <button
            key={person.user_id}
            type="button"
            onClick={() => onSelectPerson(person.user_id)}
            className={[
              taskCard,
              "p-4 text-left w-full cursor-pointer transition-all",
              isSelected
                ? "ring-2 ring-gray-900"
                : "hover:border-gray-300 hover:shadow-md",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{person.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{person.email}</p>
              </div>
              {!person.registro_hoy && (
                <span className="shrink-0 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Sin registro hoy
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Tareas" value={person.tareas_totales} />
              <Stat label="Horas" value={formatMinutos(person.horas * 60)} />
              <Stat label="Completadas" value={person.completadas} color="text-green-700" />
              <Stat label="En progreso" value={person.en_progreso} color="text-blue-700" />
              {person.bloqueadas > 0 && (
                <Stat label="Bloqueadas" value={person.bloqueadas} color="text-red-700" />
              )}
            </div>

            {person.ultima_actividad && (
              <p className="mt-2 text-xs text-gray-400">
                Última actividad: {new Date(person.ultima_actividad).toLocaleDateString("es-CO")}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Stat({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  )
}
