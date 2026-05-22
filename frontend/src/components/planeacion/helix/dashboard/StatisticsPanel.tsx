import type { HelixEstadisticasResponsable } from "@/types/helix"

interface StatisticsPanelProps {
  estadisticas: HelixEstadisticasResponsable[]
}

export function StatisticsPanel({ estadisticas }: StatisticsPanelProps) {
  const sorted = [...estadisticas].sort((a, b) => b.completadas - a.completadas)

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
        Estadísticas por responsable
      </h4>

      {sorted.length === 0 ? (
        <p style={{ fontSize: "var(--helix-text-small)", color: "var(--helix-muted)" }}>
          Sin datos
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--helix-text-small)",
            }}
          >
            <thead>
              <tr>
                {["Responsable", "Total", "Completadas", "Avance prom.", "Puntos"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: "left",
                        padding: "6px 10px",
                        fontSize: "var(--helix-text-tiny)",
                        fontWeight: 700,
                        color: "var(--helix-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid var(--helix-line)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={row.responsableId}
                  style={{
                    background: idx % 2 === 0 ? "transparent" : "var(--helix-surface-2)",
                  }}
                >
                  <td
                    style={{
                      padding: "7px 10px",
                      fontWeight: 600,
                      color: "var(--helix-ink)",
                    }}
                  >
                    {row.responsableNombre}
                  </td>
                  <td style={{ padding: "7px 10px", color: "var(--helix-muted)" }}>
                    {row.total}
                  </td>
                  <td style={{ padding: "7px 10px", color: "var(--helix-done)", fontWeight: 700 }}>
                    {row.completadas}
                  </td>
                  <td style={{ padding: "7px 10px", color: "var(--helix-muted)" }}>
                    {row.avancePromedio}%
                  </td>
                  <td style={{ padding: "7px 10px", color: "var(--helix-muted)" }}>
                    {row.puntosCompletados}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
