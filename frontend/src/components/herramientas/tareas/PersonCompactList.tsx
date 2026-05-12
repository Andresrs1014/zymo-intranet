import type { PersonTaskSummary } from "@/types/workTask"

interface Props {
  summaries: PersonTaskSummary[]
  selectedPersonId?: number
  onSelect: (userId: number) => void
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function PersonCompactList({ summaries, selectedPersonId, onSelect }: Props) {
  if (summaries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Sin miembros.
      </p>
    )
  }

  return (
    <div className="space-y-0.5">
      {summaries.map((person) => {
        const isSelected = selectedPersonId === person.user_id
        const avatarColor = getAvatarColor(person.nombre)
        const initials = getInitials(person.nombre)

        return (
          <button
            key={person.user_id}
            type="button"
            onClick={() => onSelect(person.user_id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
              isSelected
                ? "bg-gray-900 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            <span
              className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                isSelected ? "bg-white/20 text-white" : avatarColor
              }`}
            >
              {initials}
            </span>

            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium truncate leading-tight">
                {person.nombre.split(" ")[0]}
              </span>
            </span>

            <span className={`shrink-0 text-[10px] font-semibold ${
              isSelected ? "text-white/70" : "text-gray-400"
            }`}>
              {person.tareas_totales}
            </span>

            {!person.registro_hoy && (
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-400"
                title="Sin registro hoy"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}