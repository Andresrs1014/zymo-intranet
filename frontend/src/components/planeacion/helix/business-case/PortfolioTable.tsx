import type { HelixROI } from "@/types/helix"

interface PortfolioTableProps {
  data: HelixROI[]
}

const CLASIFICACION_COLOR: Record<HelixROI["clasificacion"], string> = {
  "Alto potencial": "#22c55e",
  "Potencial favorable": "#ef3340",
  "Retorno controlado": "#f59e0b",
  "Revisar alcance": "#ef4444",
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

export function PortfolioTable({ data }: PortfolioTableProps) {
  const sorted = [...data].sort((a, b) => b.roi - a.roi)

  return (
    <div
      style={{
        background: "var(--helix-surface)",
        border: "1px solid var(--helix-border)",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 28,
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--helix-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2
          style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--helix-ink)" }}
        >
          Detalle por Proyecto
        </h2>
        <span style={{ fontSize: "0.75rem", color: "var(--helix-muted)" }}>
          Ordenado por ROI descendente
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr style={{ background: "var(--helix-bg, #f8fafc)" }}>
              {["Proyecto", "ROI", "Clasificación", "Inversión", "Retorno", "Margen", "Avance", "Actividades"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--helix-muted)",
                      borderBottom: "1px solid var(--helix-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const color = CLASIFICACION_COLOR[row.clasificacion]
              const isEven = idx % 2 === 0

              return (
                <tr
                  key={row.id}
                  style={{
                    background: isEven ? "transparent" : "rgba(0,0,0,0.02)",
                    transition: "background 120ms",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 600,
                      color: "var(--helix-ink)",
                      borderBottom: "1px solid var(--helix-border)",
                    }}
                  >
                    {row.nombre}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 800,
                      fontSize: "1rem",
                      color,
                      borderBottom: "1px solid var(--helix-border)",
                    }}
                  >
                    {row.roi}%
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--helix-border)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: color + "22",
                        color,
                        border: `1px solid ${color}44`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.clasificacion}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--helix-ink)",
                      borderBottom: "1px solid var(--helix-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCOP(row.inversionEst)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--helix-ink)",
                      borderBottom: "1px solid var(--helix-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCOP(row.retornoEsp)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--helix-ink)",
                      borderBottom: "1px solid var(--helix-border)",
                    }}
                  >
                    {row.margen}%
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--helix-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          background: "var(--helix-border)",
                          borderRadius: 3,
                          overflow: "hidden",
                          minWidth: 60,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, row.avancePromedio)}%`,
                            background: color,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--helix-muted)", whiteSpace: "nowrap" }}>
                        {row.avancePromedio}%
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--helix-muted)",
                      borderBottom: "1px solid var(--helix-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.actividadesTerminadas}/{row.totalActividades}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
