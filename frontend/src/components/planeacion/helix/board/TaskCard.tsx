import type { CSSProperties } from "react"
import { useDraggable } from "@dnd-kit/core"
import type { HelixActividad } from "@/types/helix"

interface TaskCardProps {
  actividad: HelixActividad
}

const PRIORIDAD_STYLES: Record<string, CSSProperties> = {
  Alta: {
    backgroundColor: "#fef2f2",
    color: "#ef4444",
    border: "1px solid #fecaca",
  },
  Media: {
    backgroundColor: "#fffbeb",
    color: "#f59e0b",
    border: "1px solid #fde68a",
  },
  Baja: {
    backgroundColor: "#f9fafb",
    color: "#6b7280",
    border: "1px solid #e5e7eb",
  },
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
    })
  } catch {
    return dateStr
  }
}

export function TaskCard({ actividad }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: actividad.id.toString() })

  const cardStyle: CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderLeft: actividad.bloqueada ? "3px solid #ef3340" : "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "8px",
    cursor: isDragging ? "grabbing" : "grab",
    boxShadow: isDragging
      ? "0 10px 24px rgba(0,0,0,0.15)"
      : "0 2px 6px rgba(0,0,0,0.04)",
    opacity: isDragging ? 0.85 : 1,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition: isDragging ? undefined : "box-shadow 160ms, transform 160ms",
    userSelect: "none",
  }

  const prioridadStyle: CSSProperties = {
    ...PRIORIDAD_STYLES[actividad.prioridad],
    display: "inline-flex",
    alignItems: "center",
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: "999px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }

  const badgeStyle: CSSProperties = {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    backgroundColor: actividad.responsableColor || "#6b7280",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }

  const pointsBadgeStyle: CSSProperties = {
    backgroundColor: "#f3f4f6",
    color: "#374151",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 5px",
  }

  const avancePercent = Math.min(100, Math.max(0, actividad.avance))

  return (
    <div ref={setNodeRef} style={cardStyle} {...listeners} {...attributes}>
      {/* Header row: nombre + responsable badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: "13px",
            color: "#111827",
            lineHeight: "1.3",
            flex: 1,
          }}
        >
          {actividad.nombre}
        </span>
        <div
          style={badgeStyle}
          title={actividad.responsableNombre}
          aria-label={actividad.responsableNombre}
        >
          {actividad.responsableInitials}
        </div>
      </div>

      {/* Prioridad chip */}
      <div style={{ marginBottom: "8px" }}>
        <span style={prioridadStyle}>{actividad.prioridad}</span>
      </div>

      {/* Avance progress bar */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            color: "#6b7280",
            marginBottom: "3px",
          }}
        >
          <span>Avance</span>
          <span>{avancePercent}%</span>
        </div>
        <div
          style={{
            background: "#e5e7eb",
            borderRadius: "999px",
            height: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${avancePercent}%`,
              height: "100%",
              borderRadius: "999px",
              background:
                avancePercent >= 100
                  ? "#10b981"
                  : avancePercent >= 50
                  ? "#3b82f6"
                  : "#f59e0b",
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      {/* Footer: fecha + puntos */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#6b7280",
        }}
      >
        <span>📅 {formatDate(actividad.fechaFin)}</span>
        <span style={pointsBadgeStyle}>{actividad.puntos} pts</span>
      </div>

      {/* Blocked indicator */}
      {actividad.bloqueada && (
        <div
          style={{
            marginTop: "6px",
            fontSize: "10px",
            color: "#ef3340",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          🔒 Bloqueada
        </div>
      )}
    </div>
  )
}
