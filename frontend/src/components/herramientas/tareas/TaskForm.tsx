import { useState } from "react"
import type { WorkTaskCreate } from "@/types/workTask"
import { ETIQUETAS, PLATAFORMAS, ESTADOS } from "@/types/workTask"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
  ETIQUETA_LABELS,
  PLATAFORMA_LABELS,
  ESTADO_LABELS,
  formatMinutos,
} from "@/lib/taskTheme"

interface TaskFormProps {
  onSubmit: (payload: WorkTaskCreate) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

function calcMinutos(inicio: string, cierre: string): number | null {
  if (!inicio || !cierre) return null
  const [h1, m1] = inicio.split(":").map(Number)
  const [h2, m2] = cierre.split(":").map(Number)
  const total = (h2 * 60 + m2) - (h1 * 60 + m1)
  return total > 0 ? total : null
}

export function TaskForm({ onSubmit, onCancel, loading }: TaskFormProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [etiqueta, setEtiqueta] = useState<string>(ETIQUETAS[0])
  const [plataforma, setPlataforma] = useState<string>(PLATAFORMAS[0])
  const [fecha, setFecha] = useState(today)
  const [estado, setEstado] = useState<string>("en_progreso")
  const [horaInicio, setHoraInicio] = useState("")
  const [horaCierre, setHoraCierre] = useState("")

  const minutos = calcMinutos(horaInicio, horaCierre)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: WorkTaskCreate = {
      titulo,
      descripcion_tecnica: descripcion,
      etiqueta,
      plataforma,
      fecha,
      estado,
      hora_inicio: horaInicio ? new Date(`${fecha}T${horaInicio}:00`).toISOString() : undefined,
      hora_cierre: horaCierre ? new Date(`${fecha}T${horaCierre}:00`).toISOString() : undefined,
    }
    await onSubmit(payload)
    // Reset form
    setTitulo("")
    setDescripcion("")
    setEtiqueta(ETIQUETAS[0])
    setPlataforma(PLATAFORMAS[0])
    setFecha(today)
    setEstado("en_progreso")
    setHoraInicio("")
    setHoraCierre("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <select
            className={taskInput}
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
          >
            {ETIQUETAS.map((e) => (
              <option key={e} value={e}>{ETIQUETA_LABELS[e] ?? e}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Plataforma</label>
          <select
            className={taskInput}
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value)}
          >
            {PLATAFORMAS.map((p) => (
              <option key={p} value={p}>{PLATAFORMA_LABELS[p] ?? p}</option>
            ))}
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
          <select
            className={taskInput}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>{ESTADO_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Hora inicio</label>
          <input
            type="time"
            className={taskInput}
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
        </div>

        <div>
          <label className={taskLabel}>Hora cierre</label>
          <input
            type="time"
            className={taskInput}
            value={horaCierre}
            onChange={(e) => setHoraCierre(e.target.value)}
          />
        </div>
      </div>

      {minutos !== null && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
          Tiempo calculado: <span className="font-semibold text-gray-900">{formatMinutos(minutos)}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" className={taskButtonPrimary} disabled={loading}>
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
