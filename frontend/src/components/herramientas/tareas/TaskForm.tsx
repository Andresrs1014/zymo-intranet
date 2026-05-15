import { useState } from "react"
import type { WorkTaskCreate } from "@/types/workTask"
import { useTaskLists, useMyTeams } from "@/hooks/useWorkTasks"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
  formatMinutos,
} from "@/lib/taskTheme"

interface TaskFormProps {
  onSubmit: (payload: WorkTaskCreate) => Promise<void>
  onCancel?: () => void
  loading?: boolean
  /** Si true, bloquea envío cuando el usuario no tiene equipos (colaboradores sin alta en equipo). */
  blockSubmitWithoutTeam?: boolean
}

function calcMinutos(inicio: string, cierre: string): number | null {
  if (!inicio || !cierre) return null
  const [h1, m1] = inicio.split(":").map(Number)
  const [h2, m2] = cierre.split(":").map(Number)
  const total = (h2 * 60 + m2) - (h1 * 60 + m1)
  return total > 0 ? total : null
}

export function TaskForm({
  onSubmit,
  onCancel,
  loading,
  blockSubmitWithoutTeam = false,
}: TaskFormProps) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: myTeams = [] } = useMyTeams()

  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [etiqueta, setEtiqueta] = useState<string>("")
  const [plataforma, setPlataforma] = useState<string>("")
  const [fecha, setFecha] = useState(today)
  const [estado, setEstado] = useState<string>("")
  const [prioridad, setPrioridad] = useState<string>("media")
  const [teamId, setTeamId] = useState<number | undefined>(undefined)
  const [horaInicio, setHoraInicio] = useState("")
  const [horaCierre, setHoraCierre] = useState("")

  // Fetch lists for the selected team so dropdowns always match validation
  const { data: lists } = useTaskLists(teamId)

  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []
  const estados = lists?.estado ?? []

  const minutos = calcMinutos(horaInicio, horaCierre)
  const needsTeamSelector = myTeams.length > 1
  const cannotSubmitNoTeam = blockSubmitWithoutTeam && myTeams.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cannotSubmitNoTeam) return
    const payload: WorkTaskCreate = {
      titulo,
      descripcion_tecnica: descripcion,
      ...(etiqueta && { etiqueta }),
      ...(plataforma && { plataforma }),
      ...(estado && { estado }),
      prioridad,
      // Single-team users: backend auto-assigns team_id from their only membership.
      // Multi-team users: team_id is required via the selector above.
      ...(needsTeamSelector && teamId ? { team_id: teamId } : {}),
      fecha,
      hora_inicio: horaInicio ? new Date(`${fecha}T${horaInicio}:00`).toISOString() : undefined,
      hora_cierre: horaCierre ? new Date(`${fecha}T${horaCierre}:00`).toISOString() : undefined,
    }
    await onSubmit(payload)
    setTitulo("")
    setDescripcion("")
    setEtiqueta("")
    setPlataforma("")
    setFecha(today)
    setEstado("")
    setPrioridad("media")
    setTeamId(undefined)
    setHoraInicio("")
    setHoraCierre("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {cannotSubmitNoTeam && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <strong>No puedes registrar tareas aún:</strong> no figurás en ningún equipo de este módulo. Pedí al gestor
          que te agregue en <strong>Configuración del equipo</strong> y que tengas el permiso de registro
          (herramienta de envío de tareas).
        </div>
      )}

      {needsTeamSelector && (
        <div>
          <label className={taskLabel}>Equipo *</label>
          <select
            className={taskInput}
            value={teamId ?? ""}
            onChange={(e) => {
              setTeamId(e.target.value ? Number(e.target.value) : undefined)
              // Reset dependent fields so they don't carry values invalid for the new team's lists
              setEtiqueta("")
              setPlataforma("")
              setEstado("")
            }}
            required
          >
            <option value="">Seleccionar equipo...</option>
            {myTeams.map((t) => (
              <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={taskLabel}>Título *</label>
        <input
          className={taskInput}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Descripción breve de la tarea"
          required
        />
      </div>

      <div>
        <label className={taskLabel}>Descripción técnica</label>
        <textarea
          className={`${taskInput} resize-none`}
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalle técnico, pasos realizados, observaciones..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={taskLabel}>Etiqueta</label>
          <select className={taskInput} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
            <option value="">Seleccionar...</option>
            {etiquetas.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Plataforma</label>
          <select className={taskInput} value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
            <option value="">Seleccionar...</option>
            {plataformas.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Fecha</label>
          <input
            type="date"
            className={taskInput}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={taskLabel}>Estado</label>
          <select className={taskInput} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Seleccionar...</option>
            {estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Prioridad</label>
          <select className={taskInput} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <div>
          <label className={taskLabel}>Hora inicio</label>
          <input type="time" className={taskInput} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>

        <div>
          <label className={taskLabel}>Hora cierre</label>
          <input type="time" className={taskInput} value={horaCierre} onChange={(e) => setHoraCierre(e.target.value)} />
        </div>
      </div>

      {minutos !== null && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
          Tiempo calculado: <span className="font-semibold text-gray-900">{formatMinutos(minutos)}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className={taskButtonPrimary}
          disabled={loading || cannotSubmitNoTeam}
        >
          {loading ? "Guardando..." : "Registrar tarea"}
        </button>
        {onCancel && (
          <button type="button" className={taskButtonSecondary} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
