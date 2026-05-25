import { useState } from "react"
import { useTask } from "@/context/TaskContext"
import { useTasks } from "@/hooks/useTasks"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { TaskDialog } from "@/components/tareas/TaskDialog"
import type { Task } from "@/types/task"

const PRIORITY_COLOR: Record<string, string> = {
  baja: "#10b981",
  media: "#f59e0b",
  alta: "#f97316",
  critica: "#ef3340",
}

interface TaskFiltersBarProps {
  teamId: number
  filters: {
    search?: string
    estado?: string
    etiqueta?: string
    plataforma?: string
    responsableId?: number
    prioridad?: string
    fechaDesde?: string
    fechaHasta?: string
  }
  onChange: (f: typeof filters) => void
}

function TaskFiltersBar({ teamId, filters, onChange }: TaskFiltersBarProps) {
  const { data: lists } = useTaskLists(teamId)
  const { data: members = [] } = useTeamMembers(teamId)

  const estados = lists?.estado ?? []
  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []

  const INPUT_STYLE = {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid #d8dde8",
    fontSize: 13,
    color: "#121420",
    background: "#fff",
    outline: "none",
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
      <input
        placeholder="Buscar…"
        value={filters.search ?? ""}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        style={{ ...INPUT_STYLE, minWidth: 180 }}
      />

      <select
        value={filters.estado ?? ""}
        onChange={(e) => onChange({ ...filters, estado: e.target.value || undefined })}
        style={INPUT_STYLE}
      >
        <option value="">Todos los estados</option>
        {estados.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={filters.etiqueta ?? ""}
        onChange={(e) => onChange({ ...filters, etiqueta: e.target.value || undefined })}
        style={INPUT_STYLE}
      >
        <option value="">Todas las etiquetas</option>
        {etiquetas.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={filters.plataforma ?? ""}
        onChange={(e) => onChange({ ...filters, plataforma: e.target.value || undefined })}
        style={INPUT_STYLE}
      >
        <option value="">Todas las plataformas</option>
        {plataformas.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={filters.responsableId ?? ""}
        onChange={(e) => onChange({ ...filters, responsableId: e.target.value ? Number(e.target.value) : undefined })}
        style={INPUT_STYLE}
      >
        <option value="">Todos los responsables</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>{`Usuario ${m.userId}`}</option>
        ))}
      </select>

      <select
        value={filters.prioridad ?? ""}
        onChange={(e) => onChange({ ...filters, prioridad: e.target.value || undefined })}
        style={INPUT_STYLE}
      >
        <option value="">Todas las prioridades</option>
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="critica">Crítica</option>
      </select>

      <input
        type="date"
        value={filters.fechaDesde ?? ""}
        onChange={(e) => onChange({ ...filters, fechaDesde: e.target.value || undefined })}
        style={INPUT_STYLE}
        title="Fecha desde"
      />
      <input
        type="date"
        value={filters.fechaHasta ?? ""}
        onChange={(e) => onChange({ ...filters, fechaHasta: e.target.value || undefined })}
        style={INPUT_STYLE}
        title="Fecha hasta"
      />
    </div>
  )
}

interface TaskRowProps {
  task: Task
  onSelect: (t: Task) => void
}

function TaskRow({ task, onSelect }: TaskRowProps) {
  return (
    <tr
      onClick={() => onSelect(task)}
      style={{
        cursor: "pointer",
        borderBottom: "1px solid #f0f2f7",
        transition: "background 120ms",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#f8f9fd")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "")}
    >
      <td style={{ padding: "12px 14px", fontSize: 13, color: "#5c6374" }}>
        {task.asignadoANombre ?? task.subidoPorNombre}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: "#121420" }}>
        {task.titulo}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 12, color: "#5c6374" }}>
        {task.fecha.slice(0, 10)}
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 600,
          background: "#eef1f6",
          color: "#3f4652",
        }}>
          {task.etiqueta}
        </span>
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 600,
          background: "#eef1f6",
          color: "#3f4652",
        }}>
          {task.plataforma}
        </span>
      </td>
      <td style={{ padding: "12px 14px", fontSize: 12, color: "#5c6374" }}>
        {task.tiempoTotalMinutos ? `${task.tiempoTotalMinutos}m` : "—"}
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          background: "#f0f2f7",
          color: "#3f4652",
        }}>
          {task.estado}
        </span>
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          background: `${PRIORITY_COLOR[task.prioridad] ?? "#6b7280"}20`,
          color: PRIORITY_COLOR[task.prioridad] ?? "#6b7280",
        }}>
          {task.prioridad}
        </span>
      </td>
    </tr>
  )
}

const TH_STYLE = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#5c6374",
  background: "#f4f6fa",
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
}

export function ListView() {
  const { activeTeamId } = useTask()
  const [localFilters, setLocalFilters] = useState<Record<string, unknown>>({})
  const [page, setPage] = useState(1)
  const limit = 25
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const { data, isLoading } = useTasks({
    teamId: activeTeamId ?? undefined,
    ...localFilters,
    page,
    limit,
  })

  const tasks = data?.tasks ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  if (!activeTeamId) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#5c6374" }}>
        Selecciona un equipo en la barra lateral para ver las tareas.
      </div>
    )
  }

  return (
    <div>
      <TaskFiltersBar
        teamId={activeTeamId}
        filters={localFilters as Parameters<typeof TaskFiltersBar>[0]["filters"]}
        onChange={(f) => { setLocalFilters(f); setPage(1) }}
      />

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ebf4", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#5c6374", fontSize: 14 }}>
            Cargando tareas…
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#5c6374", fontSize: 14 }}>
            No se encontraron tareas con los filtros aplicados.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Responsable", "Título", "Fecha", "Etiqueta", "Plataforma", "Tiempo", "Estado", "Prioridad"].map((h) => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onSelect={setEditingTask} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaskDialog
        open={!!editingTask}
        teamId={activeTeamId}
        task={editingTask}
        onClose={() => setEditingTask(null)}
      />

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#5c6374" }}>
          <span>
            Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid #d8dde8",
                background: page === 1 ? "#f4f6fa" : "#fff",
                color: page === 1 ? "#9aa5b8" : "#3f4652",
                cursor: page === 1 ? "default" : "pointer",
                fontSize: 13,
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid #d8dde8",
                background: page === totalPages ? "#f4f6fa" : "#fff",
                color: page === totalPages ? "#9aa5b8" : "#3f4652",
                cursor: page === totalPages ? "default" : "pointer",
                fontSize: 13,
              }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
