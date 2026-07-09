import { useState } from "react"
import { useTask } from "@/context/TaskContext"
import { useTaskEvents, useCreateEvent, useConfirmAttendance } from "@/hooks/useTaskEvents"
import { useTeamMembers, useAvailableUsers } from "@/hooks/useTaskTeams"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useAuthStore } from "@/store/authStore"
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

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const DAY_NAMES = ["L","M","M","J","V","S","D"]

const INPUT_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 13,
  color: "#f4f4f5",
  background: "#1b2029",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, currentUserId, onConfirm }: { event: TaskEvent; currentUserId: number | null; onConfirm: (id: number) => void }) {
  const hasConflict = event.participants.some((p) => p.hasConflict)
  const isParticipant = currentUserId != null && event.participants.some((p) => p.userId === currentUserId)
  const alreadyConfirmed = currentUserId != null && event.participants.find((p) => p.userId === currentUserId)?.confirmado === true
  return (
    <div
      style={{
        background: "#1b2029",
        borderRadius: 8,
        border: `1.5px solid ${hasConflict ? "rgba(239,51,64,0.45)" : "rgba(255,255,255,0.10)"}`,
        padding: "12px 14px",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#f4f4f5" }}>{event.titulo}</div>
          <div style={{ color: "#a1a1aa", fontSize: 12, marginTop: 3 }}>
            {event.horaInicio} · {event.duracionMinutos}min
            {event.plataforma && ` · ${event.plataforma}`}
            {event.modalidad && ` · ${event.modalidad}`}
          </div>
          {(event as { descripcion?: string }).descripcion && (
            <div style={{ color: "#a1a1aa", fontSize: 12, marginTop: 4 }}>
              {(event as { descripcion?: string }).descripcion}
            </div>
          )}
        </div>
        {hasConflict && (
          <span title="Conflicto de horario" style={{ color: "#ef4444", fontSize: 16, flexShrink: 0 }}>⚠</span>
        )}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {event.participants.slice(0, 6).map((p) => (
          <div
            key={p.userId}
            title={p.userNombre + (p.hasConflict ? ` — ${p.conflictDetail}` : "") + (p.confirmado ? " ✓" : "")}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: p.confirmado ? "#10b981" : "#00a8c8",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: p.hasConflict ? "2px solid #ef4444" : "2px solid transparent",
              cursor: "default",
              flexShrink: 0,
            }}
          >
            {p.userNombre.slice(0, 2).toUpperCase()}
          </div>
        ))}
        {event.participants.length > 6 && (
          <span style={{ fontSize: 11, color: "#71717a" }}>+{event.participants.length - 6}</span>
        )}
        {isParticipant && !alreadyConfirmed && (
          <button
            onClick={() => onConfirm(event.id)}
            style={{
              marginLeft: "auto",
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "#12151c",
              color: "#d4d4d8",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Confirmar asistencia
          </button>
        )}
        {isParticipant && alreadyConfirmed && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Confirmado</span>
        )}
      </div>
    </div>
  )
}

// ─── Create Event Form ────────────────────────────────────────────────────────

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  return diff > 0 ? diff : 30
}

type CreateForm = {
  titulo: string
  horaInicio: string
  horaFin: string
  descripcion: string
  modalidad: string
  plataforma: string
  prioridad: string
  participantIds: number[]
  participantTab: "equipo" | "todos"
}

function CreateEventForm({
  selectedDay,
  teamId,
  onClose,
}: {
  selectedDay: string
  teamId: number
  onClose: () => void
}) {
  const createEvent = useCreateEvent()
  const { data: lists } = useTaskLists(teamId)
  const { data: teamMembers = [] } = useTeamMembers(teamId)
  const { data: allUsers = [] } = useAvailableUsers(teamId)

  const plataformas = lists?.plataforma ?? []
  const modalidades = lists?.modalidad ?? []
  const prioridades = lists?.prioridad_agenda ?? lists?.prioridad ?? []

  const [form, setForm] = useState<CreateForm>({
    titulo: "",
    horaInicio: "09:00",
    horaFin: "10:00",
    descripcion: "",
    modalidad: "",
    plataforma: "",
    prioridad: "",
    participantIds: [],
    participantTab: "equipo",
  })

  function toggleParticipant(id: number) {
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(id)
        ? f.participantIds.filter((x) => x !== id)
        : [...f.participantIds, id],
    }))
  }

  async function handleSubmit() {
    if (!form.titulo.trim()) return
    await createEvent.mutateAsync({
      teamId,
      titulo: form.titulo.trim(),
      fecha: selectedDay,
      horaInicio: form.horaInicio,
      duracionMinutos: diffMinutes(form.horaInicio, form.horaFin),
      descripcion: form.descripcion || undefined,
      modalidad: form.modalidad || undefined,
      plataforma: form.plataforma || undefined,
      prioridad: form.prioridad || undefined,
      participantIds: form.participantIds.length > 0 ? form.participantIds : undefined,
    })
    onClose()
  }

  const participantList =
    form.participantTab === "equipo"
      ? teamMembers.map((m) => ({ id: m.userId, name: m.userNombre ?? `Usuario ${m.userId}` }))
      : allUsers.map((u) => ({ id: u.id, name: u.full_name ?? u.email }))

  return (
    <div
      style={{
        background: "#1b2029",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
        padding: 20,
        marginTop: 16,
      }}
    >
      <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>
        Nuevo evento — {selectedDay}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Título */}
        <input
          placeholder="Título del evento *"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          style={INPUT_STYLE}
        />

        {/* Hora inicio + Hora fin */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
              Hora inicio
            </label>
            <input
              type="time"
              value={form.horaInicio}
              onChange={(e) => {
                const horaInicio = e.target.value
                // Mantener la misma duración al cambiar hora inicio
                const duracion = diffMinutes(form.horaInicio, form.horaFin)
                setForm((f) => ({ ...f, horaInicio, horaFin: addMinutes(horaInicio, duracion) }))
              }}
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
              Hora fin
            </label>
            <input
              type="time"
              value={form.horaFin}
              onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))}
              style={INPUT_STYLE}
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
            Descripción
          </label>
          <textarea
            placeholder="Descripción del evento…"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            rows={2}
            style={{ ...INPUT_STYLE, resize: "vertical" }}
          />
        </div>

        {/* Modalidad */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
            Modalidad
          </label>
          <select
            value={form.modalidad}
            onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))}
            style={INPUT_STYLE}
          >
            <option value="">Seleccionar…</option>
            {modalidades.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Plataforma + Prioridad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
              Plataforma
            </label>
            <select
              value={form.plataforma}
              onChange={(e) => setForm((f) => ({ ...f, plataforma: e.target.value }))}
              style={INPUT_STYLE}
            >
              <option value="">Seleccionar…</option>
              {plataformas.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 4 }}>
              Prioridad
            </label>
            <select
              value={form.prioridad}
              onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
              style={INPUT_STYLE}
            >
              <option value="">Seleccionar…</option>
              {prioridades.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Participantes */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
            Participantes
          </label>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.10)", marginBottom: 8 }}>
            {(["equipo", "todos"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setForm((f) => ({ ...f, participantTab: tab }))}
                style={{
                  padding: "6px 14px",
                  border: "none",
                  borderBottom: `2px solid ${form.participantTab === tab ? "#ef3340" : "transparent"}`,
                  background: "none",
                  color: form.participantTab === tab ? "#ef3340" : "#a1a1aa",
                  fontWeight: form.participantTab === tab ? 700 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {tab === "equipo" ? "Equipo" : "Todos"}
              </button>
            ))}
          </div>
          {/* List */}
          <div
            style={{
              maxHeight: 140,
              overflowY: "auto",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6,
              padding: "4px 0",
            }}
          >
            {participantList.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "#71717a" }}>Sin miembros</div>
            ) : (
              participantList.map((u) => (
                <label
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    background: form.participantIds.includes(u.id) ? "rgba(239,51,64,0.12)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.participantIds.includes(u.id)}
                    onChange={() => toggleParticipant(u.id)}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12, color: "#d4d4d8" }}>{u.name}</span>
                </label>
              ))
            )}
          </div>
          {form.participantIds.length > 0 && (
            <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 4 }}>
              {form.participantIds.length} participante{form.participantIds.length !== 1 ? "s" : ""} seleccionado{form.participantIds.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "#1b2029",
              color: "#d4d4d8",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={createEvent.isPending || !form.titulo.trim()}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "none",
              background: !form.titulo.trim() ? "rgba(239,51,64,0.45)" : "#ef3340",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: form.titulo.trim() ? "pointer" : "default",
              opacity: createEvent.isPending ? 0.7 : 1,
            }}
          >
            {createEvent.isPending ? "Guardando…" : "Crear evento"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────────────

export function CalendarView() {
  const { activeTeamId } = useTask()
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(today)
  const [selectedDay, setSelectedDay] = useState<string>(formatDate(today))
  const [showCreate, setShowCreate] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const days = getDaysInMonth(year, month)

  const currentUser = useAuthStore((s) => s.user)
  const { data: events = [] } = useTaskEvents(activeTeamId)
  const confirmAttendance = useConfirmAttendance()

  const eventsForSelected = events.filter((e) => e.fecha.slice(0, 10) === selectedDay)
  const datesWithEvents = new Set(events.map((e) => e.fecha.slice(0, 10)))

  if (!activeTeamId) {
    return <div style={{ textAlign: "center", padding: 60, color: "#a1a1aa" }}>Selecciona un equipo.</div>
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>
      {/* ── Calendar grid ── */}
      <div
        style={{
          background: "#1b2029",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.10)",
          padding: 18,
          boxShadow: "0 1px 4px rgba(18,20,32,0.05)",
        }}
      >
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "#12151c",
              fontSize: 16,
              cursor: "pointer",
              color: "#d4d4d8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ‹
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#f4f4f5" }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "#12151c",
              fontSize: 16,
              cursor: "pointer",
              color: "#d4d4d8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ›
          </button>
        </div>

        {/* Day names header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
          {DAY_NAMES.map((d, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "#71717a",
                padding: "4px 0",
                letterSpacing: "0.04em",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {(() => {
          const firstDOW = (days[0].getDay() + 6) % 7
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
                    onClick={() => { setSelectedDay(iso); setShowCreate(false) }}
                    style={{
                      padding: "7px 2px",
                      borderRadius: 7,
                      border: "none",
                      background: isSelected ? "#ef3340" : isToday ? "rgba(239,51,64,0.12)" : "transparent",
                      color: isSelected ? "#fff" : isToday ? "#ef3340" : "#d4d4d8",
                      fontWeight: isToday || isSelected ? 700 : 400,
                      fontSize: 13,
                      cursor: "pointer",
                      position: "relative",
                      lineHeight: 1,
                    }}
                  >
                    {day.getDate()}
                    {hasEvent && !isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 3,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "#ef3340",
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          ))
        })()}

        {/* Today button */}
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <button
            onClick={() => {
              setCurrentDate(today)
              setSelectedDay(formatDate(today))
              setShowCreate(false)
            }}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "#12151c",
              color: "#a1a1aa",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* ── Day panel ── */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f4f4f5" }}>
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>
              {eventsForSelected.length} evento{eventsForSelected.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: showCreate ? "1px solid rgba(255,255,255,0.10)" : "none",
              background: showCreate ? "#12151c" : "#ef3340",
              color: showCreate ? "#d4d4d8" : "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            } as React.CSSProperties}
          >
            {showCreate ? "Cancelar" : "+ Nuevo evento"}
          </button>
        </div>

        {eventsForSelected.length === 0 && !showCreate ? (
          <div
            style={{
              padding: "48px 0",
              color: "#71717a",
              textAlign: "center",
              fontSize: 14,
            }}
          >
            Sin eventos para este día.
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Haz clic en "+ Nuevo evento" para crear uno.
            </div>
          </div>
        ) : (
          eventsForSelected.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              currentUserId={currentUser?.id ?? null}
              onConfirm={(id) => confirmAttendance.mutate(id)}
            />
          ))
        )}

        {showCreate && (
          <CreateEventForm
            selectedDay={selectedDay}
            teamId={activeTeamId}
            onClose={() => setShowCreate(false)}
          />
        )}
      </div>
    </div>
  )
}
