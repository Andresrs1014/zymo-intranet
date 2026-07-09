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

const INPUT_CLASS =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
const SUBLABEL = "mb-1 block text-[11px] font-semibold text-zinc-500"

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, currentUserId, onConfirm }: { event: TaskEvent; currentUserId: number | null; onConfirm: (id: number) => void }) {
  const hasConflict = event.participants.some((p) => p.hasConflict)
  const isParticipant = currentUserId != null && event.participants.some((p) => p.userId === currentUserId)
  const alreadyConfirmed = currentUserId != null && event.participants.find((p) => p.userId === currentUserId)?.confirmado === true
  return (
    <div
      className="mb-2.5 rounded-lg bg-white px-3.5 py-3 shadow-sm"
      style={{ border: `1.5px solid ${hasConflict ? "rgba(196,30,58,0.45)" : "#e4e4e7"}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-zinc-900">{event.titulo}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {event.horaInicio} · {event.duracionMinutos}min
            {event.plataforma && ` · ${event.plataforma}`}
            {event.modalidad && ` · ${event.modalidad}`}
          </div>
          {(event as { descripcion?: string }).descripcion && (
            <div className="mt-1 text-xs text-zinc-500">
              {(event as { descripcion?: string }).descripcion}
            </div>
          )}
        </div>
        {hasConflict && (
          <span title="Conflicto de horario" className="shrink-0 text-base text-red-600">⚠</span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {event.participants.slice(0, 6).map((p) => (
          <div
            key={p.userId}
            title={p.userNombre + (p.hasConflict ? ` — ${p.conflictDetail}` : "") + (p.confirmado ? " ✓" : "")}
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{
              // confirmado = rojo (marcado); pendiente = zinc neutro. Sin verde/cian.
              background: p.confirmado ? "#c41e3a" : "#a1a1aa",
              border: p.hasConflict ? "2px solid #c41e3a" : "2px solid transparent",
            }}
          >
            {p.userNombre.slice(0, 2).toUpperCase()}
          </div>
        ))}
        {event.participants.length > 6 && (
          <span className="text-[11px] text-zinc-500">+{event.participants.length - 6}</span>
        )}
        {isParticipant && !alreadyConfirmed && (
          <button
            onClick={() => onConfirm(event.id)}
            className="ml-auto rounded-md border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Confirmar asistencia
          </button>
        )}
        {isParticipant && alreadyConfirmed && (
          <span className="ml-auto text-[11px] font-semibold text-primary">✓ Confirmado</span>
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
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-[14px] font-bold text-zinc-900">
        Nuevo evento — {selectedDay}
      </h3>

      <div className="flex flex-col gap-3">
        {/* Título */}
        <input
          placeholder="Título del evento *"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          className={INPUT_CLASS}
        />

        {/* Hora inicio + Hora fin */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={SUBLABEL}>Hora inicio</label>
            <input
              type="time"
              value={form.horaInicio}
              onChange={(e) => {
                const horaInicio = e.target.value
                const duracion = diffMinutes(form.horaInicio, form.horaFin)
                setForm((f) => ({ ...f, horaInicio, horaFin: addMinutes(horaInicio, duracion) }))
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={SUBLABEL}>Hora fin</label>
            <input
              type="time"
              value={form.horaFin}
              onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className={SUBLABEL}>Descripción</label>
          <textarea
            placeholder="Descripción del evento…"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            rows={2}
            className={`${INPUT_CLASS} resize-y`}
          />
        </div>

        {/* Modalidad */}
        <div>
          <label className={SUBLABEL}>Modalidad</label>
          <select
            value={form.modalidad}
            onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))}
            className={INPUT_CLASS}
          >
            <option value="">Seleccionar…</option>
            {modalidades.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Plataforma + Prioridad */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={SUBLABEL}>Plataforma</label>
            <select
              value={form.plataforma}
              onChange={(e) => setForm((f) => ({ ...f, plataforma: e.target.value }))}
              className={INPUT_CLASS}
            >
              <option value="">Seleccionar…</option>
              {plataformas.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={SUBLABEL}>Prioridad</label>
            <select
              value={form.prioridad}
              onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
              className={INPUT_CLASS}
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
          <label className={`${SUBLABEL} mb-1.5`}>Participantes</label>
          {/* Tabs */}
          <div className="mb-2 flex border-b border-zinc-200">
            {(["equipo", "todos"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setForm((f) => ({ ...f, participantTab: tab }))}
                className="-mb-px border-b-2 px-3.5 py-1.5 text-xs transition"
                style={{
                  borderBottomColor: form.participantTab === tab ? "#c41e3a" : "transparent",
                  color: form.participantTab === tab ? "#c41e3a" : "#71717a",
                  fontWeight: form.participantTab === tab ? 700 : 400,
                }}
              >
                {tab === "equipo" ? "Equipo" : "Todos"}
              </button>
            ))}
          </div>
          {/* List */}
          <div className="max-h-[140px] overflow-y-auto rounded-md border border-zinc-200 py-1">
            {participantList.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-zinc-500">Sin miembros</div>
            ) : (
              participantList.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5"
                  style={{ background: form.participantIds.includes(u.id) ? "rgba(196,30,58,0.08)" : "transparent" }}
                >
                  <input
                    type="checkbox"
                    checked={form.participantIds.includes(u.id)}
                    onChange={() => toggleParticipant(u.id)}
                    className="cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-zinc-700">{u.name}</span>
                </label>
              ))
            )}
          </div>
          {form.participantIds.length > 0 && (
            <div className="mt-1 text-[11px] text-zinc-500">
              {form.participantIds.length} participante{form.participantIds.length !== 1 ? "s" : ""} seleccionado{form.participantIds.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={createEvent.isPending || !form.titulo.trim()}
            className="rounded-md bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:cursor-default disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
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
    return <div className="p-16 text-center text-zinc-500">Selecciona un equipo.</div>
  }

  return (
    <div className="grid items-start gap-6" style={{ gridTemplateColumns: "300px 1fr" }}>
      {/* ── Calendar grid ── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-[18px] shadow-sm">
        {/* Month nav */}
        <div className="mb-3.5 flex items-center justify-between">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 text-base leading-none text-zinc-700 transition hover:bg-zinc-100"
          >
            ‹
          </button>
          <span className="text-[14px] font-bold text-zinc-900">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 text-base leading-none text-zinc-700 transition hover:bg-zinc-100"
          >
            ›
          </button>
        </div>

        {/* Day names header */}
        <div className="mb-1.5 grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
          {DAY_NAMES.map((d, i) => (
            <div key={i} className="py-1 text-center text-[10px] font-bold tracking-[0.04em] text-zinc-500">
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
            <div key={ri} className="mb-0.5 grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
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
                    className="relative rounded-md py-[7px] text-[13px] leading-none"
                    style={{
                      border: "none",
                      background: isSelected ? "#c41e3a" : isToday ? "rgba(196,30,58,0.10)" : "transparent",
                      color: isSelected ? "#fff" : isToday ? "#c41e3a" : "#3f3f46",
                      fontWeight: isToday || isSelected ? 700 : 400,
                    }}
                  >
                    {day.getDate()}
                    {hasEvent && !isSelected && (
                      <div
                        className="absolute h-1 w-1 rounded-full bg-primary"
                        style={{ bottom: 3, left: "50%", transform: "translateX(-50%)" }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          ))
        })()}

        {/* Today button */}
        <div className="mt-3 text-center">
          <button
            onClick={() => {
              setCurrentDate(today)
              setSelectedDay(formatDate(today))
              setShowCreate(false)
            }}
            className="rounded-md border border-zinc-300 bg-zinc-50 px-3.5 py-[5px] text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* ── Day panel ── */}
      <div>
        <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-[16px] font-bold text-zinc-900">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <div className="mt-0.5 text-xs text-zinc-500">
              {eventsForSelected.length} evento{eventsForSelected.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className={`rounded-md px-4 py-2 text-[13px] font-bold transition ${
              showCreate
                ? "border border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                : "bg-primary text-primary-foreground shadow-sm hover:brightness-95"
            }`}
          >
            {showCreate ? "Cancelar" : "+ Nuevo evento"}
          </button>
        </div>

        {eventsForSelected.length === 0 && !showCreate ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            Sin eventos para este día.
            <div className="mt-2 text-xs">
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
