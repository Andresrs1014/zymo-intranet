import { useState } from "react"
import { useTask } from "@/context/TaskContext"
import { useTaskEvents, useCreateEvent, useConfirmAttendance } from "@/hooks/useTaskEvents"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import type { TaskEvent } from "@/types/task"

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function EventCard({ event, onConfirm }: { event: TaskEvent; onConfirm: (id: number) => void }) {
  const hasConflict = event.participants.some((p) => p.hasConflict)
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 6,
        border: `1px solid ${hasConflict ? "#fca5a5" : "#e8ebf4"}`,
        padding: "8px 12px",
        marginBottom: 8,
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, color: "#121420" }}>{event.titulo}</div>
          <div style={{ color: "#5c6374", marginTop: 2 }}>
            {event.horaInicio} · {event.duracionMinutos}min
            {event.plataforma && ` · ${event.plataforma}`}
          </div>
        </div>
        {hasConflict && (
          <span title="Conflicto de horario" style={{ color: "#ef4444", fontSize: 16 }}>⚠</span>
        )}
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {event.participants.slice(0, 5).map((p) => (
          <div
            key={p.userId}
            title={p.userNombre + (p.hasConflict ? ` — ${p.conflictDetail}` : "") + (p.confirmado ? " (confirmado)" : "")}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: p.confirmado ? "#10b981" : "#6366f1",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: p.hasConflict ? "2px solid #ef4444" : "none",
              cursor: "default",
            }}
          >
            {p.userNombre.slice(0, 2).toUpperCase()}
          </div>
        ))}
        <button
          onClick={() => onConfirm(event.id)}
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid #d8dde8",
            background: "#f4f6fa",
            color: "#3f4652",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}

export function CalendarView() {
  const { activeTeamId } = useTask()
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [selectedDay, setSelectedDay] = useState<string>(formatDate(today))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const days = getDaysInMonth(year, month)

  const { data: events = [] } = useTaskEvents(activeTeamId)
  const confirmAttendance = useConfirmAttendance()

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ titulo: "", horaInicio: "09:00", duracionMinutos: 60 })
  const createEvent = useCreateEvent()
  const { data: members = [] } = useTeamMembers(activeTeamId)

  const eventsForSelected = events.filter(
    (e) => e.fecha.slice(0, 10) === selectedDay,
  )

  const datesWithEvents = new Set(events.map((e) => e.fecha.slice(0, 10)))

  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

  async function handleCreateEvent() {
    if (!activeTeamId || !createForm.titulo.trim()) return
    await createEvent.mutateAsync({
      teamId: activeTeamId,
      titulo: createForm.titulo,
      fecha: selectedDay,
      horaInicio: createForm.horaInicio,
      duracionMinutos: createForm.duracionMinutos,
    })
    setShowCreate(false)
    setCreateForm({ titulo: "", horaInicio: "09:00", duracionMinutos: 60 })
  }

  if (!activeTeamId) {
    return <div style={{ textAlign: "center", padding: 60, color: "#5c6374" }}>Selecciona un equipo.</div>
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      {/* Calendar */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ebf4", padding: 20 }}>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#3f4652" }}
          >
            ‹
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#121420" }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#3f4652" }}
          >
            ›
          </button>
        </div>

        {/* Day names */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {["L","M","M","J","V","S","D"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9aa5b8", padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        {/* Days */}
        {(() => {
          const firstDOW = (days[0].getDay() + 6) % 7 // 0=Mon
          const cells: (Date | null)[] = [...Array(firstDOW).fill(null), ...days]
          const rows: (Date | null)[][] = []
          for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
          return rows.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
              {row.map((day, ci) => {
                if (!day) return <div key={ci} />
                const iso = formatDate(day)
                const isSelected = iso === selectedDay
                const isToday = iso === formatDate(today)
                const hasEvent = datesWithEvents.has(iso)
                return (
                  <button
                    key={ci}
                    onClick={() => setSelectedDay(iso)}
                    style={{
                      padding: "6px 0",
                      borderRadius: 6,
                      border: "none",
                      background: isSelected ? "#ef3340" : isToday ? "#fef2f2" : "transparent",
                      color: isSelected ? "#fff" : isToday ? "#ef3340" : "#3f4652",
                      fontWeight: isToday || isSelected ? 700 : 400,
                      fontSize: 13,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {day.getDate()}
                    {hasEvent && !isSelected && (
                      <div style={{
                        position: "absolute",
                        bottom: 3,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#ef3340",
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          ))
        })()}
      </div>

      {/* Day panel */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#121420" }}>
            {selectedDay}
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              background: "#ef3340",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Evento
          </button>
        </div>

        {eventsForSelected.length === 0 ? (
          <div style={{ padding: "32px 0", color: "#9aa5b8", textAlign: "center", fontSize: 14 }}>
            Sin eventos para este día.
          </div>
        ) : (
          eventsForSelected.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              onConfirm={(id) => confirmAttendance.mutate(id)}
            />
          ))
        )}

        {showCreate && (
          <div style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #e8ebf4",
            padding: 20,
            marginTop: 16,
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Nuevo evento — {selectedDay}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                placeholder="Título del evento"
                value={createForm.titulo}
                onChange={(e) => setCreateForm((f) => ({ ...f, titulo: e.target.value }))}
                style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d8dde8", fontSize: 13 }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="time"
                  value={createForm.horaInicio}
                  onChange={(e) => setCreateForm((f) => ({ ...f, horaInicio: e.target.value }))}
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d8dde8", fontSize: 13, flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="Duración (min)"
                  value={createForm.duracionMinutos}
                  onChange={(e) => setCreateForm((f) => ({ ...f, duracionMinutos: Number(e.target.value) }))}
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d8dde8", fontSize: 13, flex: 1 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #d8dde8", background: "#fff", fontSize: 13, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateEvent}
                  disabled={createEvent.isPending}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#ef3340", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {createEvent.isPending ? "Guardando…" : "Crear evento"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
