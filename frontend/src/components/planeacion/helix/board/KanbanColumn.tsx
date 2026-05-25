import type { CSSProperties } from "react"
import { useDroppable } from "@dnd-kit/core"
import type { HelixActividad, HelixEstado } from "@/types/helix"
import { TaskCard } from "./TaskCard"

interface KanbanColumnProps {
  estado: HelixEstado
  actividades: HelixActividad[]
  onEdit: (actividad: HelixActividad) => void
}

// Accent colors per column — intentionally bold/semantic, not overridable by theme
const COLUMN_COLORS: Record<HelixEstado, string> = {
  Backlog:    "#9ca3af",
  Planificado: "#60a5fa",
  "En curso": "#f59e0b",
  Revision:   "#a78bfa",
  Terminado:  "#22c55e",
}

export function KanbanColumn({ estado, actividades, onEdit }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  const color = COLUMN_COLORS[estado]

  const columnStyle: CSSProperties = {
    background: isOver ? `${color}12` : "var(--helix-bg)",
    borderRadius: 8,
    padding: 10,
    minHeight: 200,
    border: isOver ? `2px solid ${color}` : "2px solid transparent",
    transition: "border-color 150ms, background 150ms",
  }

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: "6px 8px",
    borderRadius: 6,
    background: "var(--helix-surface)",
    borderLeft: `3px solid ${color}`,
    border: "1px solid var(--helix-line)",
    borderLeftWidth: 3,
    borderLeftColor: color,
  }

  const countBadgeStyle: CSSProperties = {
    backgroundColor: color,
    color: "#fff",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 7px",
    minWidth: 20,
    textAlign: "center",
  }

  return (
    <div ref={setNodeRef} style={columnStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--helix-ink)" }}>
          {estado}
        </span>
        <span style={countBadgeStyle}>{actividades.length}</span>
      </div>

      <div>
        {actividades.map((actividad) => (
          <TaskCard key={actividad.id} actividad={actividad} onEdit={() => onEdit(actividad)} />
        ))}

        {actividades.length === 0 && (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--helix-muted)", fontSize: 12, border: "2px dashed var(--helix-line)", borderRadius: 6, marginTop: 4 }}>
            Sin tareas
          </div>
        )}
      </div>
    </div>
  )
}
