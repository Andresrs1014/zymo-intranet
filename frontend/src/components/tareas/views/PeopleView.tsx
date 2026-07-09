import { useState } from "react"
import { useTask } from "@/context/TaskContext"
import { usePersonSummaries } from "@/hooks/useTaskDashboard"
import { useTasks } from "@/hooks/useTasks"
import type { PersonSummary } from "@/types/task"

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
      style={{
        background: "#1b2029",
        borderRadius: 10,
        border: `1px solid ${isSelected ? "#ef3340" : "rgba(255,255,255,0.10)"}`,
        padding: 18,
        cursor: "pointer",
        transition: "border-color 120ms",
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: isSelected ? "#ef3340" : "#00a8c8",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          {person.nombre.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f4f4f5" }}>{person.nombre}</div>
          <div style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "'DM Mono', monospace" }}>
            {person.total} tareas · {person.horasTotal}h
          </div>
        </div>
      </div>

      {/* Estado distribution */}
      {person.total > 0 && (
        <div style={{ display: "flex", gap: 3, height: 6, borderRadius: 3, overflow: "hidden" }}>
          {Object.entries(person.byEstado).map(([estado, count], i) => (
            <div
              key={estado}
              title={`${estado}: ${count}`}
              style={{
                flex: count,
                background: ["#10b981", "#f59e0b", "#00a8c8", "#ef3340", "#71717a"][i % 5],
              }}
            />
          ))}
        </div>
      )}

      {/* Recent tasks (when selected) */}
      {isSelected && recentTasks.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Tareas recientes
          </div>
          {recentTasks.map((t) => (
            <div key={t.id} style={{ fontSize: 12, color: "#d4d4d8", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ef3340",
                marginRight: 6,
                verticalAlign: "middle",
              }} />
              {t.titulo}
              <span style={{ color: "#71717a", marginLeft: 6 }}>({t.estado})</span>
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
    return <div style={{ textAlign: "center", padding: 60, color: "#a1a1aa" }}>Selecciona un equipo.</div>
  }

  if (persons.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#a1a1aa" }}>
        No hay datos de personas para este equipo.
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
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
