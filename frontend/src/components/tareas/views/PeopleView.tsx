import { useState } from "react"
import { useTask } from "@/context/TaskContext"
import { usePersonSummaries } from "@/hooks/useTaskDashboard"
import { useTasks } from "@/hooks/useTasks"
import type { PersonSummary } from "@/types/task"

// Rampa monocroma rojo → zinc (paleta blanco+rojo del módulo)
const ESTADO_BAR_COLORS = ["#c41e3a", "#e0596e", "#f0a6b1", "#a1a1aa", "#71717a"]

function PersonCard({
  person,
  isSelected,
  onClick,
  teamId,
}: {
  person: PersonSummary
  isSelected: boolean
  onClick: () => void
  teamId: number
}) {
  const { data: taskResult } = useTasks({
    teamId,
    responsableId: person.userId,
    limit: 10,
    enabled: isSelected,
  } as Parameters<typeof useTasks>[0] & { enabled?: boolean })

  const recentTasks = taskResult?.tasks ?? []

  return (
    <div
      className="cursor-pointer rounded-lg border bg-white p-[18px] shadow-sm transition-colors"
      style={{ borderColor: isSelected ? "#c41e3a" : "#e4e4e7" }}
      onClick={onClick}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
          style={{ background: isSelected ? "#c41e3a" : "#a1a1aa" }}
        >
          {person.nombre.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-[14px] font-bold text-zinc-900">{person.nombre}</div>
          <div className="font-mono text-[11px] text-zinc-500">
            {person.total} tareas · {person.horasTotal}h
          </div>
        </div>
      </div>

      {/* Estado distribution */}
      {person.total > 0 && (
        <div className="flex h-1.5 gap-[3px] overflow-hidden rounded-[3px]">
          {Object.entries(person.byEstado).map(([estado, count], i) => (
            <div
              key={estado}
              title={`${estado}: ${count}`}
              style={{ flex: count, background: ESTADO_BAR_COLORS[i % ESTADO_BAR_COLORS.length] }}
            />
          ))}
        </div>
      )}

      {/* Recent tasks (when selected) */}
      {isSelected && recentTasks.length > 0 && (
        <div className="mt-3.5 border-t border-zinc-200 pt-3.5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
            Tareas recientes
          </div>
          {recentTasks.map((t) => (
            <div key={t.id} className="border-b border-zinc-100 py-1 text-xs text-zinc-700">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
              {t.titulo}
              <span className="ml-1.5 text-zinc-400">({t.estado})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PeopleView() {
  const { activeTeamId } = useTask()
  const { data: persons = [] } = usePersonSummaries(activeTeamId)
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null)

  if (!activeTeamId) {
    return <div className="p-16 text-center text-zinc-500">Selecciona un equipo.</div>
  }

  if (persons.length === 0) {
    return (
      <div className="p-16 text-center text-zinc-500">
        No hay datos de personas para este equipo.
      </div>
    )
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {persons.map((p) => (
        <PersonCard
          key={p.userId}
          person={p}
          isSelected={selectedPerson === p.userId}
          onClick={() => setSelectedPerson(selectedPerson === p.userId ? null : p.userId)}
          teamId={activeTeamId}
        />
      ))}
    </div>
  )
}
