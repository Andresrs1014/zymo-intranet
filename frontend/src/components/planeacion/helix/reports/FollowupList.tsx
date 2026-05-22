import React from "react"

export interface SeguimientoItem {
  actividadId: number
  actividadNombre: string
  responsableNombre: string
  subproyectoNombre: string
  tipo: "vencida" | "bloqueada" | "riesgo" | "sin_avance"
  descripcion: string
  diasRetraso?: number
  avance: number
  fechaFin: string
}

const TIPO_COLOR: Record<SeguimientoItem["tipo"], string> = {
  vencida: "#ef4444",
  bloqueada: "#f97316",
  riesgo: "#eab308",
  sin_avance: "#6b7280",
}

const TIPO_LABEL: Record<SeguimientoItem["tipo"], string> = {
  vencida: "Vencida",
  bloqueada: "Bloqueada",
  riesgo: "En riesgo",
  sin_avance: "Sin avance",
}

interface FollowupListProps {
  items: SeguimientoItem[]
  loading: boolean
}

export function FollowupList({ items, loading }: FollowupListProps) {
  if (loading) {
    return (
      <div
        style={{
          color: "var(--helix-muted)",
          fontSize: "0.875rem",
          fontStyle: "italic",
          padding: 20,
        }}
      >
        Cargando seguimientos…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "var(--helix-muted)",
          fontSize: "0.95rem",
        }}
      >
        No hay seguimientos pendientes ✅
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => {
        const color = TIPO_COLOR[item.tipo]
        return (
          <div
            key={`${item.tipo}-${item.actividadId}`}
            style={{
              display: "flex",
              background: "var(--helix-surface)",
              border: "1px solid var(--helix-border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* colored left strip */}
            <div
              style={{
                width: 4,
                background: color,
                flexShrink: 0,
              }}
            />
            <div style={{ padding: "14px 16px", flex: 1, minWidth: 0 }}>
              {/* Activity name */}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "var(--helix-ink)",
                  marginBottom: 2,
                }}
              >
                {item.actividadNombre}
              </div>
              {/* Subproject */}
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--helix-muted)",
                  marginBottom: 8,
                }}
              >
                {item.subproyectoNombre}
              </div>
              {/* Responsible + tipo badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--helix-muted)",
                  }}
                >
                  {item.responsableNombre}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    background: color + "22",
                    color: color,
                    border: `1px solid ${color}44`,
                  }}
                >
                  {TIPO_LABEL[item.tipo]}
                </span>
              </div>
              {/* Description */}
              <div
                style={{
                  fontSize: "0.83rem",
                  color: "var(--helix-muted)",
                }}
              >
                {item.descripcion}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
