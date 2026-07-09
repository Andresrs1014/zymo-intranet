import { useState } from "react"
import type { ReactNode } from "react"
import { useQueries } from "@tanstack/react-query"
import { Inbox, Clock, AlertTriangle, ChevronRight } from "lucide-react"
import { taskApi } from "@/lib/taskApi"
import { useMyTasks } from "@/hooks/useTasks"
import { useMyTeams } from "@/hooks/useTaskTeams"
import { TaskDrawer } from "@/components/tareas/TaskDrawer"
import { TaskStatusPill } from "@/components/tareas/TaskStatusPill"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { categorizeMyWork, isOverdue } from "@/lib/taskWork"
import type { Task, ListsGrouped, ListConfig } from "@/types/task"

function fmtMin(min: number | null | undefined): string | null {
  if (!min) return null
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function fmtFecha(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  })
}

function WorkCardSkeleton() {
  return (
    <Card className="flex w-full items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-2 h-4 w-2/3" />
        <Skeleton className="h-3 w-32" />
      </div>
    </Card>
  )
}

// ── Tarjeta de tarea ──────────────────────────────────────────────────────────
interface CardProps {
  task: Task
  teamName?: string
  estadoCfg?: ListConfig
  prioCfg?: ListConfig
  done: boolean
  onOpen: (t: Task) => void
}

function WorkCard({ task, teamName, estadoCfg, prioCfg, done, onOpen }: CardProps) {
  const vencida = !done && isOverdue(task)
  const tiempo = fmtMin(task.tiempoTotalMinutos)

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(task) } }}
      className="group flex w-full cursor-pointer items-start gap-4 px-5 py-4 text-left transition hover:-translate-y-px hover:border-primary/40 hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <TaskStatusPill
            estadoLabel={estadoCfg?.label ?? task.estado}
            estadoColor={estadoCfg?.color}
            aceptacion={task.aceptacion}
            vencida={vencida}
          />
          {teamName && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {teamName}
            </span>
          )}
        </div>
        <h4 className="truncate text-[14px] font-semibold text-zinc-900">{task.titulo}</h4>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          <span className="font-mono">{fmtFecha(task.fecha)}</span>
          {tiempo && <span className="font-mono">{tiempo}</span>}
          {task.subidoPorNombre && task.asignadoAId !== task.subidoPorId && (
            <span>por {task.subidoPorNombre}</span>
          )}
          {prioCfg && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: `${prioCfg.color ?? "#71717a"}1e`, color: prioCfg.color ?? "#71717a" }}
            >
              {prioCfg.label}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="mt-1 shrink-0 text-zinc-400 transition group-hover:text-zinc-600" />
    </Card>
  )
}

// ── Sección con encabezado y contador ─────────────────────────────────────────
interface SectionProps {
  icon: ReactNode
  title: string
  accent: string
  tasks: Task[]
  emptyLabel: string
  children: (t: Task) => ReactNode
}

function Section({ icon, title, accent, tasks, emptyLabel, children }: SectionProps) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent }}>
          {icon}
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-zinc-700">{title}</h3>
        <span
          className="ml-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
          style={{ background: `${accent}1f`, color: accent }}
        >
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-[13px] text-zinc-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">{tasks.map(children)}</div>
      )}
    </section>
  )
}

export function MiTrabajoView() {
  const { data, isLoading, userId } = useMyTasks()
  const { data: teams = [] } = useMyTeams()
  const [selected, setSelected] = useState<Task | null>(null)

  const teamName = new Map(teams.map((t) => [t.id, t.name]))
  const teamIds = teams.map((t) => t.id)

  const listsResults = useQueries({
    queries: teamIds.map((id) => ({
      queryKey: ["taskLists", id],
      queryFn: async () => (await taskApi.get<ListsGrouped>(`/api/teams/${id}/lists`)).data,
    })),
  })
  const listsByTeam = new Map<number, ListsGrouped>()
  teamIds.forEach((id, i) => {
    const d = listsResults[i]?.data
    if (d) listsByTeam.set(id, d)
  })

  const estadoCfg = (t: Task) => listsByTeam.get(t.teamId)?.estado?.find((e) => e.value === t.estado)
  const prioCfg = (t: Task) => listsByTeam.get(t.teamId)?.prioridad?.find((p) => p.value === t.prioridad)
  const isDone = (t: Task) => {
    const c = estadoCfg(t)
    return !!(c?.isFinal || c?.isCanceled)
  }

  const tasks = data?.tasks ?? []
  const { pendientes, vencidas, enCurso } = categorizeMyWork(tasks, userId, isDone)

  const renderCard = (t: Task) => (
    <WorkCard
      key={t.id}
      task={t}
      teamName={teamName.get(t.teamId)}
      estadoCfg={estadoCfg(t)}
      prioCfg={prioCfg(t)}
      done={isDone(t)}
      onOpen={setSelected}
    />
  )

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => <WorkCardSkeleton key={i} />)}
      </div>
    )
  }

  const totalActivo = pendientes.length + vencidas.length + enCurso.length

  return (
    <div className="w-full">
      <Card className="mb-7 px-7 py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">Bandeja personal</p>
        <h2 className="mt-1.5 text-lg font-bold text-zinc-900">
          Tienes <span className="font-mono text-primary">{totalActivo}</span> tarea{totalActivo === 1 ? "" : "s"} activa{totalActivo === 1 ? "" : "s"}
          {pendientes.length > 0 && (
            <> · <span className="font-mono text-zinc-600">{pendientes.length}</span> por aceptar</>
          )}
        </h2>
      </Card>

      {/* Vencidas es la única sección roja — protagonista visual (Red Dress Rule).
          Pendientes y En curso usan zinc neutro para no competir por atención. */}
      <Section
        icon={<AlertTriangle size={15} />}
        title="Vencidas o en riesgo"
        accent="#c41e3a"
        tasks={vencidas}
        emptyLabel="Sin tareas vencidas."
      >
        {renderCard}
      </Section>

      <Section
        icon={<Inbox size={15} />}
        title="Pendientes de aceptar"
        accent="#52525b"
        tasks={pendientes}
        emptyLabel="Nada por aceptar. Estás al día."
      >
        {renderCard}
      </Section>

      <Section
        icon={<Clock size={15} />}
        title="En curso / para hoy"
        accent="#71717a"
        tasks={enCurso}
        emptyLabel="No tienes tareas en curso."
      >
        {renderCard}
      </Section>

      <TaskDrawer task={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
