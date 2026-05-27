import { useState } from "react"
import { useCreateTask } from "@/hooks/useTasks"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTaskToast } from "@/components/tareas/TaskToast"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
} from "@/lib/taskTheme"

interface AsignarTareaFormProps {
  onDone?: () => void
  onCancel?: () => void
  activeTeamId: number
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function AsignarTareaForm({ onDone, onCancel, activeTeamId }: AsignarTareaFormProps) {
  const { data: members = [] } = useTeamMembers(activeTeamId)
  const { data: lists } = useTaskLists(activeTeamId)
  const createTask = useCreateTask()
  const { showToast } = useTaskToast()

  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []
  const today = new Date().toISOString().slice(0, 10)

  const [asignadoAId, setAsignadoAId] = useState<number | "">("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [fecha, setFecha] = useState(getTomorrow())
  const [prioridad, setPrioridad] = useState("media")
  const [etiqueta, setEtiqueta] = useState("")
  const [plataforma, setPlataforma] = useState("")
  const [duracionEstimada, setDuracionEstimada] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asignadoAId || !titulo.trim()) return

    const member = members.find((m) => m.userId === asignadoAId)

    try {
      await createTask.mutateAsync({
        teamId: activeTeamId,
        titulo: titulo.trim(),
        descripcionTecnica: descripcion || undefined,
        etiqueta: etiqueta || etiquetas[0]?.value || "",
        plataforma: plataforma || plataformas[0]?.value || "",
        prioridad,
        fecha,
        asignadoAId: Number(asignadoAId),
        asignadoANombre: member?.userNombre ?? undefined,
        duracionEstimadaMinutos: duracionEstimada ? parseInt(duracionEstimada, 10) : null,
      })
      showToast("Tarea asignada", "success")
      onDone?.()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg ?? "Error al asignar tarea", "error")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
        Asigna una tarea futura a un compañero. El compañero deberá aceptarla desde su vista.
      </div>

      <div>
        <label className={taskLabel}>Asignar a *</label>
        {members.length === 0 ? (
          <p className="text-xs text-gray-400 mt-1">
            No hay compañeros de equipo disponibles. Pide al gestor que agregue miembros al equipo.
          </p>
        ) : (
          <select
            className={taskInput}
            value={asignadoAId}
            onChange={(e) => setAsignadoAId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Seleccionar persona...</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userNombre ?? `Usuario ${m.userId}`}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <label className={taskLabel}>Tiempo estimado (min)</label>
          <input
            type="number"
            min="5"
            max="1440"
            className={taskInput}
            value={duracionEstimada}
            onChange={(e) => setDuracionEstimada(e.target.value)}
            placeholder="Ej. 120"
          />
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

        <div>
          <label className={taskLabel}>Plataforma</label>
          <select className={taskInput} value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
            <option value="">Sin plataforma</option>
            {plataformas.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
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
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className={taskButtonPrimary}
          disabled={createTask.isPending || !asignadoAId || !titulo.trim()}
        >
          {createTask.isPending ? "Asignando..." : "Asignar tarea"}
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
