import { useState } from "react"
import "../tareas.css"
import { useTask } from "@/context/TaskContext"
import { useTasks, useDeleteTask } from "@/hooks/useTasks"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { TaskDrawer } from "@/components/tareas/TaskDrawer"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { isOverdue, todayStr } from "@/lib/taskWork"
import { useAuthStore } from "@/store/authStore"
import type { Task, ListConfig, TeamMember } from "@/types/task"

function formatTiempo(minutos: number): string {
  if (minutos < 60) return `${minutos}m`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function ListRowSkeleton() {
  return (
    <tr className="border-b border-zinc-200">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-3.5 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  )
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
  soloSinAsignar?: boolean
}

// ── Chips de filtro rápido ────────────────────────────────────────────────────
function QuickFilterChips({ filters, onChange, userId }: { filters: TaskFilters; onChange: (f: TaskFilters) => void; userId: number | null }) {
  const today = todayStr()
  const misTareas = userId != null && filters.responsableId === userId
  const vencenHoy = filters.fechaDesde === today && filters.fechaHasta === today
  const sinAsignar = !!filters.soloSinAsignar

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-[5px] text-xs font-semibold transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {chip(misTareas, "Mías", () =>
        onChange({ ...filters, responsableId: misTareas || userId == null ? undefined : userId }))}
      {chip(vencenHoy, "Vencen hoy", () =>
        onChange({ ...filters, fechaDesde: vencenHoy ? undefined : today, fechaHasta: vencenHoy ? undefined : today }))}
      {chip(sinAsignar, "Sin asignar", () =>
        onChange({ ...filters, soloSinAsignar: sinAsignar ? undefined : true }))}
    </div>
  )
}

const INPUT_CLASS =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-[7px] text-[13px] text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
const FILTER_LABEL = "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"

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
    <div className="mb-4">
      {/* Toggle button */}
      <div className={`flex items-center gap-2 ${open ? "mb-2.5" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`task-filter-btn flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-[13px] font-medium transition ${
            activeCount > 0
              ? "border-primary bg-primary text-primary-foreground"
              : "border-zinc-300 bg-white text-zinc-700"
          }`}
        >
          <span>{open ? "▲" : "▼"}</span>
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-white/25 px-1.5 py-px text-[11px] font-bold">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            className="border-none bg-transparent px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Collapsible panel */}
      {open && (
        <div className="grid gap-2.5 rounded-lg border border-zinc-200 bg-white p-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <div>
            <div className={FILTER_LABEL}>Buscar</div>
            <input
              placeholder="Buscar…"
              value={filters.search ?? ""}
              onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <div className={FILTER_LABEL}>Responsable</div>
            <select
              value={filters.responsableId ?? ""}
              onChange={(e) => onChange({ ...filters, responsableId: e.target.value ? Number(e.target.value) : undefined })}
              className={INPUT_CLASS}
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
            <div className={FILTER_LABEL}>Estado</div>
            <select
              value={filters.estado ?? ""}
              onChange={(e) => onChange({ ...filters, estado: e.target.value || undefined })}
              className={INPUT_CLASS}
            >
              <option value="">Todos</option>
              {estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <div className={FILTER_LABEL}>Etiqueta</div>
            <select
              value={filters.etiqueta ?? ""}
              onChange={(e) => onChange({ ...filters, etiqueta: e.target.value || undefined })}
              className={INPUT_CLASS}
            >
              <option value="">Todas</option>
              {etiquetas.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <div className={FILTER_LABEL}>Plataforma</div>
            <select
              value={filters.plataforma ?? ""}
              onChange={(e) => onChange({ ...filters, plataforma: e.target.value || undefined })}
              className={INPUT_CLASS}
            >
              <option value="">Todas</option>
              {plataformas.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {prioridades.length > 0 && (
            <div>
              <div className={FILTER_LABEL}>Prioridad</div>
              <select
                value={filters.prioridad ?? ""}
                onChange={(e) => onChange({ ...filters, prioridad: e.target.value || undefined })}
                className={INPUT_CLASS}
              >
                <option value="">Todas</option>
                {prioridades.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className={FILTER_LABEL}>Fecha desde</div>
            <input
              type="date"
              value={filters.fechaDesde ?? ""}
              onChange={(e) => onChange({ ...filters, fechaDesde: e.target.value || undefined })}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <div className={FILTER_LABEL}>Fecha hasta</div>
            <input
              type="date"
              value={filters.fechaHasta ?? ""}
              onChange={(e) => onChange({ ...filters, fechaHasta: e.target.value || undefined })}
              className={INPUT_CLASS}
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
  etiquetas: ListConfig[]
  plataformas: ListConfig[]
  estados: ListConfig[]
  nameMap: Map<number, string>
  onSelect: (t: Task) => void
  onDelete: (taskId: number) => void
}

function TaskRow({ task, prioridades, etiquetas, plataformas, estados, nameMap, onSelect, onDelete }: TaskRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const prioConfig = prioridades.find((p) => p.value === task.prioridad)
  const prioColor = prioConfig?.color ?? "#71717a"
  const prioLabel = prioConfig?.label ?? task.prioridad

  const etiquetaLabel = etiquetas.find((e) => e.value === task.etiqueta)?.label ?? task.etiqueta
  const plataformaLabel = plataformas.find((p) => p.value === task.plataforma)?.label ?? task.plataforma
  const estadoConfig = estados.find((e) => e.value === task.estado)
  const done = !!(estadoConfig?.isFinal || estadoConfig?.isCanceled)
  const vencida = !done && isOverdue(task)

  const asignadoNombre = task.asignadoAId
    ? (nameMap.get(task.asignadoAId) ?? task.asignadoANombre)
    : null
  const subidoPorNombre = nameMap.get(task.subidoPorId) ?? task.subidoPorNombre
  const isSelfAssigned = !task.asignadoAId || task.asignadoAId === task.subidoPorId

  return (
    <tr
      onClick={() => onSelect(task)}
      className="cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50"
    >
      <td className="px-3.5 py-3 text-[13px]">
        {isSelfAssigned ? (
          <span className="text-zinc-500">{asignadoNombre ?? subidoPorNombre}</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-zinc-900">{asignadoNombre}</span>
            <span className="text-[11px] text-zinc-500">por {subidoPorNombre}</span>
          </div>
        )}
      </td>
      <td className="px-3.5 py-3 text-[13px] font-medium text-zinc-900">{task.titulo}</td>
      <td className="px-3.5 py-3 text-xs text-zinc-500">{task.fecha.slice(0, 10)}</td>
      <td className="px-3.5 py-3">
        <Badge variant="secondary" className="font-normal text-zinc-700">{etiquetaLabel}</Badge>
      </td>
      <td className="px-3.5 py-3">
        <Badge variant="secondary" className="font-normal text-zinc-700">{plataformaLabel}</Badge>
      </td>
      <td className="px-3.5 py-3 font-mono text-xs text-zinc-500">
        {task.tiempoTotalMinutos ? formatTiempo(task.tiempoTotalMinutos) : "—"}
      </td>
      <td className="px-3.5 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-zinc-700">{estadoConfig?.label ?? task.estado}</Badge>
          {task.aceptacion === "pendiente" && (
            <Badge variant="outline" className="border-zinc-300 text-[10px] font-bold uppercase text-zinc-600">Por aceptar</Badge>
          )}
          {vencida && (
            <Badge className="border-transparent bg-primary text-[10px] font-bold uppercase text-primary-foreground">Vencida</Badge>
          )}
        </div>
      </td>
      <td className="px-3.5 py-3">
        <Badge variant="outline" style={{ background: `${prioColor}18`, color: prioColor, borderColor: `${prioColor}44` }}>
          {prioLabel}
        </Badge>
      </td>
      <td className="px-3.5 py-3">
        {confirmDelete ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              className="rounded bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDelete(true)
            }}
            className="rounded p-1 text-zinc-400 transition-colors hover:text-primary"
            aria-label="Eliminar tarea"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        )}
      </td>
    </tr>
  )
}

const TH_CLASS =
  "whitespace-nowrap bg-zinc-50 px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"

export function ListView() {
  const { activeTeamId } = useTask()
  const { user } = useAuthStore()
  const [localFilters, setLocalFilters] = useState<TaskFilters>({})
  const [page, setPage] = useState(1)
  const limit = 25
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const { data: listsGrouped } = useTaskLists(activeTeamId)
  const prioridades = listsGrouped?.prioridad ?? []
  const etiquetas = listsGrouped?.etiqueta ?? []
  const plataformas = listsGrouped?.plataforma ?? []
  const estados = listsGrouped?.estado ?? []

  const { data: members = [] } = useTeamMembers(activeTeamId)

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
      <div className="p-16 text-center text-zinc-500">
        Selecciona un equipo en la barra lateral para ver las tareas.
      </div>
    )
  }

  return (
    <div>
      <QuickFilterChips
        filters={localFilters}
        userId={user?.id ?? null}
        onChange={(f) => { setLocalFilters(f); setPage(1) }}
      />

      <TaskFiltersBar
        teamId={activeTeamId}
        filters={localFilters}
        members={members}
        onChange={(f) => { setLocalFilters(f); setPage(1) }}
      />

      <div className="task-card-glow overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {isLoading ? (
          <table className="w-full border-collapse">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => <ListRowSkeleton key={i} />)}
            </tbody>
          </table>
        ) : tasks.length === 0 ? (
          <div className="p-16 text-center text-sm text-zinc-500">
            No se encontraron tareas con los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Responsable", "Título", "Fecha", "Etiqueta", "Plataforma", "Tiempo", "Estado", "Prioridad", "Acciones"].map((h) => (
                    <th key={h} className={TH_CLASS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} prioridades={prioridades} etiquetas={etiquetas} plataformas={plataformas} estados={estados} nameMap={nameMap} onSelect={setEditingTask} onDelete={(id) => deleteTask.mutate(id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaskDrawer task={editingTask} onClose={() => setEditingTask(null)} />

      {total > limit && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-zinc-500">
          <span>Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-[13px] text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-[13px] text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
