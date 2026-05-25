import type { HelixROI } from "@/types/helix"

interface RoiGridProps {
  data: HelixROI[]
  loading: boolean
}

const CLASIFICACION_COLOR: Record<HelixROI["clasificacion"], string> = {
  "Alto potencial": "#22c55e",
  "Potencial favorable": "var(--helix-accent)",
  "Retorno controlado": "#f59e0b",
  "Revisar alcance": "var(--helix-danger)",
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

export function RoiGrid({ data, loading }: RoiGridProps) {
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
        Cargando ROI…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "var(--helix-muted)",
          fontSize: "0.95rem",
        }}
      >
        No hay datos de ROI disponibles.
      </div>
    )
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 16,
      }}
    >
      {data.map((item) => {
        const color = CLASIFICACION_COLOR[item.clasificacion]
        const progressPct = Math.min(100, Math.max(0, item.avancePromedio))

        return (
          <div
            key={item.id}
            style={{
              background: "var(--helix-surface)",
              border: "1px solid var(--helix-border)",
              borderRadius: 10,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Subproject name */}
            <div
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--helix-ink)",
                lineHeight: 1.3,
              }}
            >
              {item.nombre}
            </div>

            {/* ROI large number */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color,
                  lineHeight: 1,
                }}
              >
                {item.roi}%
              </span>
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
                }}
              >
                {item.clasificacion}
              </span>
            </div>

            {/* Inversión / Retorno */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--helix-muted)",
                    marginBottom: 2,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Inversión
                </div>
                <div
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "var(--helix-ink)",
                  }}
                >
                  {formatCOP(item.inversionEst)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--helix-muted)",
                    marginBottom: 2,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Retorno esp.
                </div>
                <div
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "var(--helix-ink)",
                  }}
                >
                  {formatCOP(item.retornoEsp)}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "var(--helix-muted)",
                  marginBottom: 4,
                }}
              >
                <span>Avance</span>
                <span>{progressPct}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "var(--helix-border)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: color,
                    borderRadius: 3,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* Activities count */}
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--helix-muted)",
              }}
            >
              Actividades:{" "}
              <strong style={{ color: "var(--helix-ink)" }}>
                {item.actividadesTerminadas}/{item.totalActividades}
              </strong>{" "}
              completadas
            </div>
          </div>
        )
      })}
    </div>
  )
}
