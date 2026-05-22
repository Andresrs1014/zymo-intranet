import type { CSSProperties } from "react"
import { useDroppable } from "@dnd-kit/core"
import type { HelixActividad, HelixEstado } from "@/types/helix"
import { TaskCard } from "./TaskCard"

interface KanbanColumnProps {
  estado: HelixEstado
  actividades: HelixActividad[]
  onEstadoChange: (id: number, estado: HelixEstado) => void
}

const COLUMN_COLORS: Record<HelixEstado, string> = {
  Backlog: "#6b7280",
  Planificado: "#3b82f6",
  "En curso": "#f59e0b",
  Revision: "#8b5cf6",
  Terminado: "#10b981",
}

const COLUMN_BG: Record<HelixEstado, string> = {
  Backlog: "#f9fafb",
  Planificado: "#eff6ff",
  "En curso": "#fffbeb",
  Revision: "#f5f3ff",
  Terminado: "#ecfdf5",
}

export function KanbanColumn({
  estado,
  actividades,
  onEstadoChange: _onEstadoChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })

  const color = COLUMN_COLORS[estado]
  const bg = COLUMN_BG[estado]

  const columnStyle: CSSProperties = {
    background: isOver ? bg : "#f3f4f6",
    borderRadius: "8px",
    padding: "10px",
    minHeight: "200px",
    border: isOver ? `2px solid ${color}` : "2px solid transparent",
    transition: "border-color 150ms, background 150ms",
  }

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
    padding: "6px 8px",
    borderRadius: "6px",
    background: "#fff",
    borderLeft: `3px solid ${color}`,
  }

  const countBadgeStyle: CSSProperties = {
    backgroundColor: color,
    color: "#fff",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    padding: "1px 7px",
    minWidth: "20px",
    textAlign: "center",
  }

  return (
    <div ref={setNodeRef} style={columnStyle}>
      <div style={headerStyle}>
        <span
          style={{
            fontWeight: 700,
            fontSize: "13px",
            color: "#111827",
          }}
        >
          {estado}
        </span>
        <span style={countBadgeStyle}>{actividades.length}</span>
      </div>

      <div>
        {actividades.map((actividad) => (
          <TaskCard key={actividad.id} actividad={actividad} />
        ))}

        {actividades.length === 0 && (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "12px",
              border: "2px dashed #e5e7eb",
              borderRadius: "6px",
              marginTop: "4px",
            }}
          >
            Sin tareas
          </div>
        )}
      </div>
    </div>
  )
}
