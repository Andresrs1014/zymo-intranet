import { useState } from "react"
import type { WorkTaskCreate } from "@/types/workTask"
import { useTeamCompaneros, useMyTeams, useTaskLists } from "@/hooks/useWorkTasks"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
} from "@/lib/taskTheme"

interface AsignarTareaFormProps {
  onSubmit: (payload: WorkTaskCreate) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function AsignarTareaForm({ onSubmit, onCancel, loading }: AsignarTareaFormProps) {
  const { data: companeros = [] } = useTeamCompaneros()
  const { data: myTeams = [] } = useMyTeams()

  const [asignadoAId, setAsignadoAId] = useState<number | "">("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [fecha, setFecha] = useState(getTomorrow())
  const [prioridad, setPrioridad] = useState("media")
  const [etiqueta, setEtiqueta] = useState("")
  const [teamId, setTeamId] = useState<number | undefined>(undefined)

  const needsTeamSelector = myTeams.length > 1
  const { data: lists } = useTaskLists(teamId ?? myTeams[0]?.team_id)
  const etiquetas = lists?.etiqueta ?? []

  const today = new Date().toISOString().slice(0, 10)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asignadoAId) return

    const payload: WorkTaskCreate = {
      titulo,
      descripcion_tecnica: descripcion,
      asignado_a_id: asignadoAId,
      fecha,
      prioridad,
      ...(etiqueta && { etiqueta }),
      ...(needsTeamSelector && teamId ? { team_id: teamId } : {}),
    }
    await onSubmit(payload)

    setAsignadoAId("")
    setTitulo("")
    setDescripcion("")
    setFecha(getTomorrow())
    setPrioridad("media")
    setEtiqueta("")
    setTeamId(undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
        Asigna una tarea futura a un compañero. No se registran horas — es para planificar trabajo próximo.
      </div>

      {needsTeamSelector && (
        <div>
          <label className={taskLabel}>Equipo *</label>
          <select
            className={taskInput}
            value={teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : undefined)}
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
        <label className={taskLabel}>Asignar a *</label>
        {companeros.length === 0 ? (
          <p className="text-xs text-gray-400 mt-1">
            No hay compañeros de equipo disponibles. Pide al gestor que te agregue a un equipo.
          </p>
        ) : (
          <select
            className={taskInput}
            value={asignadoAId}
            onChange={(e) => setAsignadoAId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Seleccionar persona...</option>
            {companeros.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.user_full_name || c.user_email}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className={taskLabel}>Título *</label>
        <input
          className={taskInput}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="¿Qué debe hacer?"
          required
        />
      </div>

      <div>
        <label className={taskLabel}>Descripción / instrucciones</label>
        <textarea
          className={`${taskInput} resize-none`}
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalles, contexto, links de referencia..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={taskLabel}>Fecha *</label>
          <input
            type="date"
            className={taskInput}
            value={fecha}
            min={today}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
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
          <label className={taskLabel}>Etiqueta</label>
          <select className={taskInput} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
            <option value="">Sin etiqueta</option>
            {etiquetas.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className={taskButtonPrimary}
          disabled={loading || !asignadoAId || !titulo}
        >
          {loading ? "Asignando..." : "Asignar tarea"}
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
