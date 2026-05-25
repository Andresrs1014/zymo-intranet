import type { PortfolioMetrics } from "./computePortfolioMetrics"

interface SummaryCardsProps {
  metrics: PortfolioMetrics
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

interface CardData {
  label: string
  value: string
  sub: string
  accent: string
}

function buildCards(m: PortfolioMetrics): CardData[] {
  return [
    {
      label: "Inversión Total",
      value: formatCOP(m.totalInversion),
      sub: `${m.totalProyectos} proyecto${m.totalProyectos !== 1 ? "s" : ""}`,
      accent: "#5461c8",
    },
    {
      label: "Retorno Esperado",
      value: formatCOP(m.totalRetorno),
      sub: `Margen prom. ${m.margenPromedio}%`,
      accent: "#22c55e",
    },
    {
      label: "ROI del Portafolio",
      value: `${m.roiPortfolio}%`,
      sub: `${m.proyectosAltoROI} con alto potencial`,
      accent: "#ef3340",
    },
    {
      label: "Avance Global",
      value: `${m.avancePortfolio}%`,
      sub: `${m.proyectosEnRiesgo} en revisión`,
      accent: "#f59e0b",
    },
  ]
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const cards = buildCards(metrics)

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 28,
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: "var(--helix-surface)",
            border: "1px solid var(--helix-border)",
            borderRadius: 10,
            padding: "20px 22px",
            borderTop: `3px solid ${c.accent}`,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "var(--helix-muted)",
            }}
          >
            {c.label}
          </p>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "1.5rem",
              fontWeight: 800,
              color: c.accent,
              lineHeight: 1.1,
            }}
          >
            {c.value}
          </p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--helix-muted)" }}>
            {c.sub}
          </p>
        </div>
      ))}
    </div>
  )
}
