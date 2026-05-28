import { useState } from "react"
import "../tareas.css"
import { useTask } from "@/context/TaskContext"
import { useTasks, useDeleteTask } from "@/hooks/useTasks"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { TaskDialog } from "@/components/tareas/TaskDialog"
import type { Task, ListConfig, TeamMember } from "@/types/task"

function formatTiempo(minutos: number): string {
  if (minutos < 60) return `${minutos}m`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

type TaskFilters = {
  search?: string
  estado?: string
  etiqueta?: string
  plataforma?: string
  responsableId?: number
  prioridad?: string
  fechaDesde?: string
  fechaHasta?: string
}

const INPUT_STYLE = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid #d8dde8",
  fontSize: 13,
  color: "#121420",
  background: "#fff",
  outline: "none",
  width: "100%",
}

interface TaskFiltersBarProps {
  teamId: number
  filters: TaskFilters
  onChange: (f: TaskFilters) => void
  members: TeamMember[]
}

function TaskFiltersBar({ teamId, filters, onChange, members }: TaskFiltersBarProps) {
  const { data: lists } = useTaskLists(teamId)
  const [open, setOpen] = useState(false)

  const estados = lists?.estado ?? []
  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []
  const prioridades = lists?.prioridad ?? []

  const activeCount = Object.values(filters).filter(Boolean).length

  const clear = () => onChange({})

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Toggle button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: open ? 10 : 0 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`task-filter-btn${activeCount > 0 ? " has-filters" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 7,
            border: "1px solid #d8dde8",
            background: activeCount > 0 ? "#121420" : "#fff",
            color: activeCount > 0 ? "#fff" : "#3f4652",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <span>{open ? "▲" : "▼"}</span>
          Filtros
          {activeCount > 0 && (
            <span style={{
              background: "#ef3340",
              color: "#fff",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              padding: "1px 6px",
              marginLeft: 2,
            }}>
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            style={{ fontSize: 12, color: "#9aa5b8", cursor: "pointer", border: "none", background: "none", padding: "4px 6px" }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Collapsible panel */}
      {open && (
        <div className="task-filter-panel" style={{
          background: "#fff",
          border: "1px solid #e8ebf4",
          borderRadius: 10,
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Buscar</div>
            <input
              placeholder="Buscar…"
              value={filters.search ?? ""}
              onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Responsable</div>
            <select
              value={filters.responsableId ?? ""}
              onChange={(e) => onChange({ ...filters, responsableId: e.target.value ? Number(e.target.value) : undefined })}
              style={INPUT_STYLE}
            >
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userNombre ?? `Usuario ${m.userId}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Estado</div>
            <select
              value={filters.estado ?? ""}
              onChange={(e) => onChange({ ...filters, estado: e.target.value || undefined })}
              style={INPUT_STYLE}
            >
              <option value="">Todos</option>
              {estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Etiqueta</div>
            <select
              value={filters.etiqueta ?? ""}
              onChange={(e) => onChange({ ...filters, etiqueta: e.target.value || undefined })}
              style={INPUT_STYLE}
            >
              <option value="">Todas</option>
              {etiquetas.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Plataforma</div>
            <select
              value={filters.plataforma ?? ""}
              onChange={(e) => onChange({ ...filters, plataforma: e.target.value || undefined })}
              style={INPUT_STYLE}
            >
              <option value="">Todas</option>
              {plataformas.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {prioridades.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Prioridad</div>
              <select
                value={filters.prioridad ?? ""}
                onChange={(e) => onChange({ ...filters, prioridad: e.target.value || undefined })}
                style={INPUT_STYLE}
              >
                <option value="">Todas</option>
                {prioridades.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Fecha desde</div>
            <input
              type="date"
              value={filters.fechaDesde ?? ""}
              onChange={(e) => onChange({ ...filters, fechaDesde: e.target.value || undefined })}
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#9aa5b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Fecha hasta</div>
            <input
              type="date"
              value={filters.fechaHasta ?? ""}
              onChange={(e) => onChange({ ...filters, fechaHasta: e.target.value || undefined })}
              style={INPUT_STYLE}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface TaskRowProps {
  task: Task
  prioridades: ListConfig[]
  nameMap: Map<number, string>
  onSelect: (t: Task) => void
  onDelete: (taskId: number) => void
}

function TaskRow({ task, prioridades, nameMap, onSelect, onDelete }: TaskRowProps) {
  const prioConfig = prioridades.find((p) => p.value === task.prioridad)
  const prioColor = prioConfig?.color ?? "#6b7280"
  const prioLabel = prioConfig?.label ?? task.prioridad

  // Resolve names: who assigned and who is assigned
  const asignadoNombre = task.asignadoAId
    ? (nameMap.get(task.asignadoAId) ?? task.asignadoANombre)
    : null
  const subidoPorNombre = nameMap.get(task.subidoPorId) ?? task.subidoPorNombre
  const isSelfAssigned = !task.asignadoAId || task.asignadoAId === task.subidoPorId

  return (
    <tr
      onClick={() => onSelect(task)}
      style={{ cursor: "pointer", borderBottom: "1px solid #f0f2f7", transition: "background 120ms" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#f8f9fd")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "")}
    >
      <td style={{ padding: "12px 14px", fontSize: 13 }}>
        {isSelfAssigned ? (
          <span style={{ color: "#5c6374" }}>{asignadoNombre ?? subidoPorNombre}</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: "#121420", fontWeight: 500 }}>{asignadoNombre}</span>
            <span style={{ fontSize: 11, color: "#9aa5b8" }}>por {subidoPorNombre}</span>
          </div>
        )}
      </td>
      <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, color: "#121420" }}>{task.titulo}</td>
      <td style={{ padding: "12px 14px", fontSize: 12, color: "#5c6374" }}>{task.fecha.slice(0, 10)}</td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#eef1f6", color: "#3f4652" }}>
          {task.etiqueta}
        </span>
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#eef1f6", color: "#3f4652" }}>
          {task.plataforma}
        </span>
      </td>
      <td style={{ padding: "12px 14px", fontSize: 12, color: "#5c6374" }}>
        {task.tiempoTotalMinutos ? formatTiempo(task.tiempoTotalMinutos) : "—"}
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "#f0f2f7", color: "#3f4652" }}>
          {task.estado}
        </span>
      </td>
      <td style={{ padding: "12px 14px" }}>
        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: `${prioColor}20`, color: prioColor }}>
          {prioLabel}
        </span>
      </td>
      <td style={{ padding: "12px 14px" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm("¿Eliminar esta tarea?")) onDelete(task.id)
          }}
          style={{ padding: "4px", borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: "#9aa5b8" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ef3340")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#9aa5b8")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
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
  const [localFilters, setLocalFilters] = useState<TaskFilters>({})
  const [page, setPage] = useState(1)
  const limit = 25
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const { data: listsGrouped } = useTaskLists(activeTeamId)
  const prioridades = listsGrouped?.prioridad ?? []

  const { data: members = [] } = useTeamMembers(activeTeamId)

  // Build userId → name lookup from enriched member list
  const nameMap = new Map<number, string>(
    members.filter((m) => m.userNombre).map((m) => [m.userId, m.userNombre!])
  )

  const deleteTask = useDeleteTask()

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
        filters={localFilters}
        members={members}
        onChange={(f) => { setLocalFilters(f); setPage(1) }}
      />

      <div className="task-card-glow" style={{ background: "#fff", borderRadius: 10, border: "1px solid #e8ebf4", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#5c6374", fontSize: 14 }}>Cargando tareas…</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#5c6374", fontSize: 14 }}>
            No se encontraron tareas con los filtros aplicados.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Responsable", "Título", "Fecha", "Etiqueta", "Plataforma", "Tiempo", "Estado", "Prioridad", "Acciones"].map((h) => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} prioridades={prioridades} nameMap={nameMap} onSelect={setEditingTask} onDelete={(id) => deleteTask.mutate(id)} />
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

      {total > limit && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, fontSize: 13, color: "#5c6374" }}>
          <span>Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d8dde8", background: page === 1 ? "#f4f6fa" : "#fff", color: page === 1 ? "#9aa5b8" : "#3f4652", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d8dde8", background: page === totalPages ? "#f4f6fa" : "#fff", color: page === totalPages ? "#9aa5b8" : "#3f4652", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
