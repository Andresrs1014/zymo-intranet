import type { HelixCargaResponsable } from "@/types/helix"

interface WorkloadPanelProps {
  carga: HelixCargaResponsable[]
}

export function WorkloadPanel({ carga }: WorkloadPanelProps) {
  return (
    <div
      style={{
        background: "var(--helix-card-bg)",
        boxShadow: "var(--helix-shadow-card)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h4
        style={{
          margin: "0 0 12px",
          fontSize: "var(--helix-text-body-def)",
          fontWeight: 700,
          color: "var(--helix-ink)",
        }}
      >
        Carga por responsable
      </h4>

      {carga.length === 0 ? (
        <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-muted)" }}>
          Sin datos
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {carga.map((r) => {
            const pct =
              r.total === 0 ? 0 : Math.round((r.completadas / r.total) * 100)
            return (
              <div
                key={r.responsableId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {/* Avatar */}
                <div
                  title={r.responsableNombre}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: r.responsableColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "var(--helix-text-tiny)",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {r.responsableInitials}
                </div>

                {/* Info + bar */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--helix-text-body-sm)",
                        fontWeight: 700,
                        color: "var(--helix-ink)",
                      }}
                    >
                      {r.responsableNombre}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--helix-text-tiny)",
                        color: "var(--helix-muted)",
                      }}
                    >
                      {r.completadas}/{r.total} · {r.avancePromedio}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--helix-bar-track)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "var(--helix-done)",
                        borderRadius: 3,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>

                  {/* Stats row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 3,
                      fontSize: "var(--helix-text-micro)",
                      color: "var(--helix-muted)",
                    }}
                  >
                    <span>Total: {r.total}</span>
                    <span>Completadas: {r.completadas}</span>
                    <span>En curso: {r.enProgreso}</span>
                    <span>Avance: {r.avancePromedio}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
