import type { CSSProperties } from "react"
import { useDraggable } from "@dnd-kit/core"
import { Pencil } from "lucide-react"
import type { HelixActividad } from "@/types/helix"

interface TaskCardProps {
  actividad: HelixActividad
  onEdit?: () => void
}

const PRIORIDAD_STYLES: Record<string, CSSProperties> = {
  Alta:  { background: "var(--helix-danger-bg)",  color: "var(--helix-danger-text)",  border: "1px solid rgba(239,51,64,0.25)" },
  Media: { background: "var(--helix-warning-bg)", color: "var(--helix-warning-text)", border: "1px solid rgba(245,158,11,0.25)" },
  Baja:  { background: "var(--helix-bg)",         color: "var(--helix-muted)",         border: "1px solid var(--helix-line)" },
}

const AVANCE_COLOR = (pct: number): string =>
  pct >= 100 ? "var(--helix-ok-text)"      :
  pct >= 50  ? "var(--helix-accent)"        :
               "var(--helix-warning-text)"

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
  } catch {
    return dateStr
  }
}

export function TaskCard({ actividad, onEdit }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: actividad.id.toString() })

  const cardStyle: CSSProperties = {
    background: "var(--helix-surface)",
    border: "1px solid var(--helix-line)",
    borderLeft: actividad.bloqueada ? "3px solid var(--helix-accent)" : "1px solid var(--helix-line)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    cursor: isDragging ? "grabbing" : "grab",
    boxShadow: isDragging ? "0 10px 24px rgba(0,0,0,0.15)" : "0 2px 6px rgba(0,0,0,0.04)",
    opacity: isDragging ? 0.85 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging ? undefined : "box-shadow 160ms, transform 160ms",
    userSelect: "none",
  }

  const prioridadStyle: CSSProperties = {
    ...PRIORIDAD_STYLES[actividad.prioridad],
    display: "inline-flex",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }

  const badgeStyle: CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: "50%",
    backgroundColor: actividad.responsableColor || "var(--helix-muted)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }

  const pointsBadgeStyle: CSSProperties = {
    background: "var(--helix-bg)",
    color: "var(--helix-ink)",
    border: "1px solid var(--helix-line)",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 5px",
  }

  const avancePct = Math.min(100, Math.max(0, actividad.avance))

  return (
    <div ref={setNodeRef} style={cardStyle} {...listeners} {...attributes}>
      {/* Header: name + edit + avatar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--helix-ink)", lineHeight: 1.3, flex: 1 }}>
          {actividad.nombre}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {onEdit !== undefined && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Editar actividad"
              aria-label="Editar actividad"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 4, display: "flex", alignItems: "center", color: "var(--helix-muted)", opacity: 0.7, transition: "opacity 160ms, color 160ms" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.opacity = "1"; el.style.color = "var(--helix-ink)" }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.opacity = "0.7"; el.style.color = "var(--helix-muted)" }}
            >
              <Pencil size={12} />
            </button>
          )}
          <div style={badgeStyle} title={actividad.responsableNombre} aria-label={actividad.responsableNombre}>
            {actividad.responsableInitials}
          </div>
        </div>
      </div>

      {/* Prioridad chip */}
      <div style={{ marginBottom: 8 }}>
        <span style={prioridadStyle}>{actividad.prioridad}</span>
      </div>

      {/* Avance bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--helix-muted)", marginBottom: 3 }}>
          <span>Avance</span>
          <span>{avancePct}%</span>
        </div>
        <div style={{ background: "var(--helix-line)", borderRadius: 999, height: 4, overflow: "hidden" }}>
          <div style={{ width: `${avancePct}%`, height: "100%", borderRadius: 999, background: AVANCE_COLOR(avancePct), transition: "width 300ms ease" }} />
        </div>
      </div>

      {/* Footer: date + points */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--helix-muted)" }}>
        <span>📅 {formatDate(actividad.fechaFin)}</span>
        <span style={pointsBadgeStyle}>{actividad.puntos} pts</span>
      </div>

      {actividad.bloqueada && (
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--helix-accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
          🔒 Bloqueada
        </div>
      )}
    </div>
  )
}
