import type { CSSProperties } from "react"
import type { HelixEstadoCount, HelixProximoHito } from "@/types/helix"
import { ESTADO_COLORS } from "./dashboardConstants"

interface SprintHealthProps {
  distribucion: HelixEstadoCount[]
  proximosHitos: HelixProximoHito[]
}

function diasBadgeStyle(dias: number): CSSProperties {
  if (dias <= 2) return { background: "var(--helix-danger-bg)", color: "var(--helix-danger-text)" }
  if (dias <= 5) return { background: "var(--helix-warning-bg)", color: "var(--helix-warning-text)" }
  return { background: "var(--helix-ok-bg)", color: "var(--helix-ok-text)" }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
}

export function SprintHealth({ distribucion, proximosHitos }: SprintHealthProps) {
  const total = distribucion.reduce((s, e) => s + e.count, 0)

  return (
    <div
      style={{
        background: "var(--helix-card-bg)",
        boxShadow: "var(--helix-shadow-card)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Distribution bar chart */}
      <div>
        <h4
          style={{
            margin: "0 0 10px",
            fontSize: "var(--helix-text-body-def)",
            fontWeight: 700,
            color: "var(--helix-ink)",
          }}
        >
          Distribución de estados
        </h4>

        {total === 0 ? (
          <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-muted)" }}>
            Sin actividades
          </p>
        ) : (
          <>
            {/* Stacked bar */}
            <div
              style={{
                display: "flex",
                height: 18,
                borderRadius: 6,
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              {distribucion.map((e) => (
                <div
                  key={e.estado}
                  title={`${e.estado}: ${e.count}`}
                  style={{
                    width: `${(e.count / total) * 100}%`,
                    background: ESTADO_COLORS[e.estado] ?? "#9ca3af",
                    transition: "width 0.4s ease",
                  }}
                />
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px" }}>
              {distribucion.map((e) => (
                <div
                  key={e.estado}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "var(--helix-text-tiny)",
                    color: "var(--helix-muted)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: ESTADO_COLORS[e.estado] ?? "#9ca3af",
                    }}
                  />
                  {e.estado} ({e.count})
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Upcoming milestones */}
      <div>
        <h4
          style={{
            margin: "0 0 10px",
            fontSize: "var(--helix-text-body-def)",
            fontWeight: 700,
            color: "var(--helix-ink)",
          }}
        >
          Próximos hitos (7 días)
        </h4>
        {proximosHitos.length === 0 ? (
          <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-muted)" }}>
            Sin hitos próximos
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proximosHitos.map((h) => (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--helix-surface-2)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div
                    style={{
                      fontSize: "var(--helix-text-body-sm)",
                      fontWeight: 700,
                      color: "var(--helix-ink)",
                    }}
                  >
                    {h.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--helix-text-tiny)",
                      color: "var(--helix-muted)",
                    }}
                  >
                    {h.subproyectoNombre} · {h.responsableNombre}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "var(--helix-text-tiny)",
                    color: "var(--helix-muted)",
                  }}
                >
                  {formatDate(h.fechaFin)}
                </div>
                <div
                  style={{
                    padding: "2px 8px",
                    borderRadius: "var(--helix-r-full)",
                    fontSize: "var(--helix-text-tiny)",
                    fontWeight: 700,
                    ...diasBadgeStyle(h.diasRestantes),
                  }}
                >
                  {h.diasRestantes}d
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
