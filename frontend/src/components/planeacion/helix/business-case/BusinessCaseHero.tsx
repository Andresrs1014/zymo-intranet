import type { PortfolioMetrics } from "./computePortfolioMetrics"

interface BusinessCaseHeroProps {
  metrics: PortfolioMetrics
}

function roiLabel(roi: number): { text: string; color: string } {
  if (roi >= 80) return { text: "Alto potencial", color: "#22c55e" }
  if (roi >= 30) return { text: "Potencial favorable", color: "#ef3340" }
  if (roi >= 0) return { text: "Retorno controlado", color: "#f59e0b" }
  return { text: "Revisar portafolio", color: "#ef4444" }
}

export function BusinessCaseHero({ metrics }: BusinessCaseHeroProps) {
  const { text, color } = roiLabel(metrics.roiPortfolio)

  return (
    <div
      className="helix-no-print-hide"
      style={{
        background: "linear-gradient(135deg, #1e2128 0%, #2b2f3a 100%)",
        borderRadius: 14,
        padding: "36px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        marginBottom: 28,
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.5)",
            marginBottom: 6,
          }}
        >
          Caso de Negocio
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.2,
          }}
        >
          Portafolio Helix Zymo
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.9rem",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Análisis de valor e impacto de los proyectos activos
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div
          style={{
            textAlign: "center",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "16px 28px",
            border: `1px solid ${color}44`,
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 900,
              color,
              lineHeight: 1,
            }}
          >
            {metrics.roiPortfolio}%
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "rgba(255,255,255,0.55)",
              marginTop: 4,
            }}
          >
            ROI Portafolio
          </div>
        </div>

        <div
          style={{
            display: "inline-block",
            padding: "8px 18px",
            borderRadius: 20,
            fontSize: "0.78rem",
            fontWeight: 700,
            background: color + "22",
            color,
            border: `1px solid ${color}66`,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  )
}
