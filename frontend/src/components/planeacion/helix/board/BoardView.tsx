import { useState, useEffect, type CSSProperties } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { helixApi } from "@/lib/helixApi"
import type { HelixEstado, HelixSubproyecto, HelixUsuario } from "@/types/helix"
import { useHelixActividades } from "@/hooks/useHelixActividades"
import { useHelixFilters } from "@/hooks/useHelixFilters"
import { BoardToolbar } from "./BoardToolbar"
import { KanbanColumn } from "./KanbanColumn"
import { TaskCard } from "./TaskCard"

const ESTADOS: HelixEstado[] = [
  "Backlog",
  "Planificado",
  "En curso",
  "Revision",
  "Terminado",
]

export function BoardView() {
  const { actividades, loading, error, updateEstado } = useHelixActividades()
  const {
    filters,
    setSearch,
    setResponsableId,
    setSubproyectoId,
    setSoloBlockeadas,
    setPrioridad,
    applyFilters,
  } = useHelixFilters()

  const [usuarios, setUsuarios] = useState<HelixUsuario[]>([])
  const [subproyectos, setSubproyectos] = useState<HelixSubproyecto[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // Fetch filter data
  useEffect(() => {
    helixApi
      .get<HelixUsuario[]>("/api/usuarios")
      .then((r) => setUsuarios(r.data))
      .catch(() => undefined)

    helixApi
      .get<HelixSubproyecto[]>("/api/subproyectos")
      .then((r) => setSubproyectos(r.data))
      .catch(() => undefined)
  }, [])

  const filtered = applyFilters(actividades)

  // Group by estado
  const byEstado = ESTADOS.reduce<Record<HelixEstado, typeof actividades>>(
    (acc, e) => {
      acc[e] = filtered.filter((a) => a.estado === e)
      return acc
    },
    {
      Backlog: [],
      Planificado: [],
      "En curso": [],
      Revision: [],
      Terminado: [],
    }
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const draggedId = Number(active.id)
    const targetEstado = over.id as HelixEstado

    if (!ESTADOS.includes(targetEstado)) return

    const actividad = actividades.find((a) => a.id === draggedId)
    if (!actividad || actividad.estado === targetEstado) return

    updateEstado(draggedId, targetEstado).catch(() => undefined)
  }

  const activeActividad =
    activeId != null
      ? actividades.find((a) => a.id === Number(activeId))
      : undefined

  const boardGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(240px, 1fr))",
    gap: "16px",
    overflowX: "auto",
    paddingBottom: "12px",
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          color: "#6b7280",
          fontSize: "14px",
        }}
      >
        Cargando...
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: "24px",
          borderRadius: "8px",
          background: "#fef2f2",
          color: "#ef4444",
          fontSize: "13px",
          border: "1px solid #fecaca",
        }}
      >
        Error: {error}
      </div>
    )
  }

  return (
    <div>
      {/* Section heading */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#111827",
              margin: 0,
            }}
          >
            Tablero Scrum
          </h2>
          <p
            style={{
              fontSize: "12px",
              color: "#6b7280",
              margin: "2px 0 0",
            }}
          >
            Backlog, planificacion, ejecucion, revision y cierre.
          </p>
        </div>
      </div>

      <BoardToolbar
        filters={filters}
        setters={{
          setSearch,
          setResponsableId,
          setSubproyectoId,
          setSoloBlockeadas,
          setPrioridad,
        }}
        usuarios={usuarios}
        subproyectos={subproyectos}
      />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={boardGridStyle}>
          {ESTADOS.map((estado) => (
            <KanbanColumn
              key={estado}
              estado={estado}
              actividades={byEstado[estado]}
              onEstadoChange={updateEstado}
            />
          ))}
        </div>

        <DragOverlay>
          {activeActividad != null ? (
            <TaskCard actividad={activeActividad} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
