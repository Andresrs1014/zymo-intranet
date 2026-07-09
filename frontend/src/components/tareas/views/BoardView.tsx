import { useState } from "react"
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

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className="task-card-glow"
        onClick={() => onOpen?.(task)}
        style={{
          background: "#1b2029",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "12px 14px",
          cursor: onOpen ? "pointer" : "grab",
          boxShadow: isDragging ? "0 8px 24px rgba(18,20,32,0.14)" : "0 1px 4px rgba(18,20,32,0.06)",
          transition: "box-shadow 120ms",
          marginBottom: 8,
          position: "relative",
        }}
      >
        {/* Drag handle — única zona de arrastre; el resto de la tarjeta abre el detalle */}
        <button
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar tarea"
          style={{
            position: "absolute",
            top: 8,
            right: 6,
            padding: 2,
            border: "none",
            background: "none",
            color: "#52525b",
            cursor: "grab",
            display: "flex",
            touchAction: "none",
          }}
        >
          <GripVertical size={15} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#f4f4f5", marginBottom: 8, lineHeight: 1.4, paddingRight: 18 }}>
          {task.titulo}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 600,
              background: "rgba(255,255,255,0.06)",
              color: "#a1a1aa",
            }}>
              {etiquetaLabel}
            </span>
            {porAceptar && (
              <span style={{ padding: "1px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: "rgba(245,158,11,0.16)", color: "#fcd34d" }}>
                Por aceptar
              </span>
            )}
            {vencida && (
              <span style={{ padding: "1px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: "rgba(239,51,64,0.16)", color: "#ef3340" }}>
                Vencida
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {task.tiempoTotalMinutos && (
              <span style={{ fontSize: 10, color: "#71717a", fontFamily: "'DM Mono', monospace" }}>{formatTiempo(task.tiempoTotalMinutos)}</span>
            )}
            {task.prioridad && (() => {
              const p = prioridades.find((p) => p.value === task.prioridad)
              const color = p?.color ?? "#6b7280"
              const label = p?.label ?? task.prioridad
              return (
                <span style={{
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  background: `${color}18`,
                  color,
                }}>
                  {label}
                </span>
              )
            })()}
          </div>
        </div>
        {(task.asignadoANombre || task.subidoPorNombre) && (() => {
          const isSelfAssigned = !task.asignadoAId || task.asignadoAId === task.subidoPorId
          const displayName = task.asignadoANombre ?? task.subidoPorNombre
          return (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "#ef3340", color: "#fff",
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {displayName!.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.2 }}>{displayName}</div>
                {!isSelfAssigned && task.subidoPorNombre && (
                  <div style={{ fontSize: 10, color: "#52525b", lineHeight: 1.2 }}>por {task.subidoPorNombre}</div>
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
      style={{
        minWidth: 280,
        flex: "0 0 280px",
        background: isOver ? "rgba(239,51,64,0.12)" : "#12151c",
        borderRadius: 10,
        border: `1px solid ${isOver ? "#ef3340" : "rgba(255,255,255,0.10)"}`,
        padding: 14,
        transition: "background 120ms, border-color 120ms",
      }}
    >
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: config.color ?? "#6b7280",
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>{config.label}</span>
        </div>
        <span style={{
          padding: "2px 8px",
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          background: "rgba(255,255,255,0.10)",
          color: "#a1a1aa",
          fontFamily: "'DM Mono', monospace",
        }}>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const { data: members = [] } = useTeamMembers(activeTeamId)
  const [memberFilter, setMemberFilter] = useState<number | null>(null)

  const estados = listsGrouped?.estado ?? []
  const prioridades = listsGrouped?.prioridad ?? []
  const etiquetas = listsGrouped?.etiqueta ?? []
  const tasks = taskResult?.tasks ?? []

  const filteredTasks = memberFilter
    ? tasks.filter((t) => t.asignadoAId === memberFilter || t.subidoPorId === memberFilter)
    : tasks

  function getTasksByState(estado: string) {
    return filteredTasks.filter((t) => t.estado === estado)
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

    try {
      await updateTask.mutateAsync({
        taskId,
        input: { estado: newEstado, version: task.version },
      })
    } catch (err: unknown) {
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
      <div style={{ textAlign: "center", padding: 60, color: "#a1a1aa" }}>
        Selecciona un equipo para ver el tablero.
      </div>
    )
  }

  if (estados.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#a1a1aa" }}>
        Este equipo no tiene estados configurados. Ve a Configuración para agregarlos.
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#a1a1aa" }}>Miembro:</span>
        <select
          value={memberFilter ?? ""}
          onChange={(e) => setMemberFilter(e.target.value ? Number(e.target.value) : null)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.10)", fontSize: 13, color: "#f4f4f5", background: "#1b2029" }}
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
            style={{ fontSize: 12, color: "#71717a", cursor: "pointer", border: "none", background: "none", padding: "4px 6px" }}
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
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
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
