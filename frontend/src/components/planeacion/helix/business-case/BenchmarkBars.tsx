import type { HelixROI } from "@/types/helix"
import type { PortfolioMetrics } from "./computePortfolioMetrics"

interface BenchmarkBarsProps {
  data: HelixROI[]
  metrics: PortfolioMetrics
}

const CLASIFICACION_COLOR: Record<HelixROI["clasificacion"], string> = {
  "Alto potencial": "#22c55e",
  "Potencial favorable": "#ef3340",
  "Retorno controlado": "#f59e0b",
  "Revisar alcance": "#ef4444",
}

export function BenchmarkBars({ data, metrics }: BenchmarkBarsProps) {
  if (data.length === 0) return null

  const sorted = [...data].sort((a, b) => b.roi - a.roi)
  const maxRoi = Math.max(...sorted.map((d) => d.roi), metrics.roiPortfolio, 1)

  return (
    <div
      style={{
        background: "var(--helix-surface)",
        border: "1px solid var(--helix-border)",
        borderRadius: 10,
        padding: "20px 24px",
        marginBottom: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2
          style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--helix-ink)" }}
        >
          Comparativa ROI por Proyecto
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--helix-muted)" }}>
          <div
            style={{
              width: 20,
              height: 2,
              background: "#5461c8",
              borderRadius: 1,
              position: "relative",
            }}
          />
          Promedio portafolio: {metrics.roiPortfolio}%
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((row) => {
          const color = CLASIFICACION_COLOR[row.clasificacion]
          const pct = Math.round((row.roi / maxRoi) * 100)
          const avgPct = Math.round((metrics.roiPortfolio / maxRoi) * 100)

          return (
            <div key={row.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "var(--helix-ink)", fontWeight: 500 }}>{row.nombre}</span>
                <span style={{ fontWeight: 700, color }}>{row.roi}%</span>
              </div>
              <div
                style={{
                  position: "relative",
                  height: 10,
                  background: "var(--helix-border)",
                  borderRadius: 5,
                  overflow: "visible",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 5,
                    transition: "width 0.4s ease",
                  }}
                />
                {/* Portfolio average marker */}
                <div
                  style={{
                    position: "absolute",
                    top: -3,
                    left: `${avgPct}%`,
                    width: 2,
                    height: 16,
                    background: "#5461c8",
                    borderRadius: 1,
                    transform: "translateX(-50%)",
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
