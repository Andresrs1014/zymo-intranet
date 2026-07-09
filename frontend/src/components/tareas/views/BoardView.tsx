import { useState, useEffect } from "react"
import "../tareas.css"
import {
  DndContext,
  type DragEndEvent,
  closestCorners,
  DragOverlay,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { useTask } from "@/context/TaskContext"
import { useTasks, useUpdateTask } from "@/hooks/useTasks"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { useTaskToast } from "@/components/tareas/TaskToast"
import { TaskDrawer } from "@/components/tareas/TaskDrawer"
import { Badge } from "@/components/ui/badge"
import { isOverdue } from "@/lib/taskWork"
import type { Task, ListConfig } from "@/types/task"

function formatTiempo(minutos: number): string {
  if (minutos < 60) return `${minutos}m`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  prioridades,
  etiquetas = [],
  columnDone = false,
  isDragging = false,
  onOpen,
}: {
  task: Task
  prioridades: ListConfig[]
  etiquetas?: ListConfig[]
  columnDone?: boolean
  isDragging?: boolean
  onOpen?: (t: Task) => void
}) {
  const etiquetaLabel = etiquetas.find((e) => e.value === task.etiqueta)?.label ?? task.etiqueta
  const vencida = !columnDone && isOverdue(task)
  const porAceptar = task.aceptacion === "pendiente"
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `task-${task.id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const prio = prioridades.find((p) => p.value === task.prioridad)
  const prioColor = prio?.color ?? "#71717a"
  const prioLabel = prio?.label ?? task.prioridad

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className="task-card-glow relative mb-2 cursor-pointer rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-sm"
        onClick={() => onOpen?.(task)}
        style={{ cursor: onOpen ? "pointer" : "grab" }}
      >
        {/* Drag handle — única zona de arrastre; el resto abre el detalle */}
        <button
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar tarea"
          className="absolute right-1.5 top-2 flex cursor-grab border-none bg-transparent p-0.5 text-zinc-300 hover:text-zinc-500"
          style={{ touchAction: "none" }}
        >
          <GripVertical size={15} />
        </button>
        <div className="mb-2 pr-[18px] text-[13px] font-medium leading-snug text-zinc-900">
          {task.titulo}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px] font-normal text-zinc-600">{etiquetaLabel}</Badge>
            {porAceptar && <Badge variant="outline" className="border-zinc-300 text-[10px] font-bold uppercase text-zinc-600">Por aceptar</Badge>}
            {vencida && <Badge className="border-transparent bg-primary text-[10px] font-bold uppercase text-primary-foreground">Vencida</Badge>}
          </div>
          <div className="flex items-center gap-1.5">
            {task.tiempoTotalMinutos && (
              <span className="font-mono text-[10px] text-zinc-500">{formatTiempo(task.tiempoTotalMinutos)}</span>
            )}
            {task.prioridad && (
              <Badge variant="outline" className="px-1.5 py-0" style={{ background: `${prioColor}18`, color: prioColor, borderColor: `${prioColor}44` }}>
                {prioLabel}
              </Badge>
            )}
          </div>
        </div>
        {(task.asignadoANombre || task.subidoPorNombre) && (() => {
          const isSelfAssigned = !task.asignadoAId || task.asignadoAId === task.subidoPorId
          const displayName = task.asignadoANombre ?? task.subidoPorNombre
          return (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {displayName!.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] leading-tight text-zinc-600">{displayName}</div>
                {!isSelfAssigned && task.subidoPorNombre && (
                  <div className="text-[10px] leading-tight text-zinc-400">por {task.subidoPorNombre}</div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ config, tasks, prioridades, etiquetas, onOpen }: { config: ListConfig; tasks: Task[]; prioridades: ListConfig[]; etiquetas: ListConfig[]; onOpen: (t: Task) => void }) {
  const columnDone = !!(config.isFinal || config.isCanceled)
  const { setNodeRef, isOver } = useDroppable({ id: `col-${config.value}` })

  return (
    <div
      className="rounded-lg border p-3.5 transition-colors"
      style={{
        minWidth: 280,
        flex: "0 0 280px",
        background: isOver ? "rgba(196,30,58,0.06)" : "#f4f4f5",
        borderColor: isOver ? "#c41e3a" : "#e4e4e7",
      }}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: config.color ?? "#71717a" }} />
          <span className="text-[13px] font-bold text-zinc-900">{config.label}</span>
        </div>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-600">
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div ref={setNodeRef} style={{ minHeight: 60 }}>
        <SortableContext
          items={tasks.map((t) => `task-${t.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} prioridades={prioridades} etiquetas={etiquetas} columnDone={columnDone} onOpen={onOpen} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

// ─── Board View ───────────────────────────────────────────────────────────────

export function BoardView() {
  const { activeTeamId } = useTask()
  const { data: listsGrouped } = useTaskLists(activeTeamId)
  const { data: taskResult } = useTasks({ teamId: activeTeamId ?? undefined, limit: 200 })
  const updateTask = useUpdateTask()
  const { showToast } = useTaskToast()

  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [optimisticEstado, setOptimisticEstado] = useState<Map<number, string>>(new Map())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const { data: members = [] } = useTeamMembers(activeTeamId)
  const [memberFilter, setMemberFilter] = useState<number | null>(null)

  const estados = listsGrouped?.estado ?? []
  const prioridades = listsGrouped?.prioridad ?? []
  const etiquetas = listsGrouped?.etiqueta ?? []
  const tasks = taskResult?.tasks ?? []

  useEffect(() => {
    setOptimisticEstado((prev) => {
      if (prev.size === 0) return prev
      let changed = false
      const next = new Map(prev)
      for (const [taskId, estado] of prev) {
        const real = tasks.find((t) => t.id === taskId)
        if (real && real.estado === estado) {
          next.delete(taskId)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [tasks])

  const filteredTasks = memberFilter
    ? tasks.filter((t) => t.asignadoAId === memberFilter || t.subidoPorId === memberFilter)
    : tasks

  function getTasksByState(estado: string) {
    return filteredTasks.filter((t) => (optimisticEstado.get(t.id) ?? t.estado) === estado)
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = Number(String(event.active.id).replace("task-", ""))
    setActiveDragTask(tasks.find((t) => t.id === taskId) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = Number(String(active.id).replace("task-", ""))
    const newEstado = String(over.id).replace("col-", "")

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.estado === newEstado) return

    setOptimisticEstado((prev) => new Map(prev).set(taskId, newEstado))

    try {
      await updateTask.mutateAsync({
        taskId,
        input: { estado: newEstado, version: task.version },
      })
    } catch (err: unknown) {
      setOptimisticEstado((prev) => {
        const next = new Map(prev)
        next.delete(taskId)
        return next
      })
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        showToast("La tarea fue modificada por otra sesión. Recargando…", "error")
      } else if (status === 422) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        showToast(msg ?? "Transición de estado no permitida", "error")
      } else {
        showToast("Error al mover la tarea", "error")
      }
    }
  }

  if (!activeTeamId) {
    return (
      <div className="p-16 text-center text-zinc-500">
        Selecciona un equipo para ver el tablero.
      </div>
    )
  }

  if (estados.length === 0) {
    return (
      <div className="p-16 text-center text-zinc-500">
        Este equipo no tiene estados configurados. Ve a Configuración para agregarlos.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <span className="text-xs text-zinc-500">Miembro:</span>
        <select
          value={memberFilter ?? ""}
          onChange={(e) => setMemberFilter(e.target.value ? Number(e.target.value) : null)}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 outline-none focus:border-primary"
        >
          <option value="">Todos</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.userNombre ?? `Usuario ${m.userId}`}
            </option>
          ))}
        </select>
        {memberFilter !== null && (
          <button
            type="button"
            onClick={() => setMemberFilter(null)}
            className="border-none bg-transparent px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-700"
          >
            Limpiar
          </button>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-3.5 overflow-x-auto pb-4">
          {estados.map((config) => (
            <BoardColumn
              key={config.value}
              config={config}
              tasks={getTasksByState(config.value)}
              prioridades={prioridades}
              etiquetas={etiquetas}
              onOpen={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDragTask && <TaskCard task={activeDragTask} prioridades={prioridades} etiquetas={etiquetas} isDragging />}
        </DragOverlay>
      </DndContext>

      <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}
