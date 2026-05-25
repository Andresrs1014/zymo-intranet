import type { ReactNode } from "react"
import { Zap, TrendingUp, Award } from "lucide-react"
import type { PortfolioMetrics } from "./computePortfolioMetrics"

interface ArgumentCardsProps {
  metrics: PortfolioMetrics
}

interface Argument {
  icon: ReactNode
  title: string
  body: string
  accent: string
}

function buildArguments(m: PortfolioMetrics): Argument[] {
  return [
    {
      icon: <Zap size={22} />,
      title: "Eficiencia Operativa",
      body: `Con un avance global del ${m.avancePortfolio}%, el portafolio optimiza recursos y reduce costos operativos al enfocar esfuerzo en actividades de mayor impacto.`,
      accent: "#5461c8",
    },
    {
      icon: <TrendingUp size={22} />,
      title: "Crecimiento Sostenible",
      body: `${m.proyectosAltoROI} de ${m.totalProyectos} proyectos tienen alto potencial de retorno. El portafolio está diseñado para crecer de forma estructurada y medible.`,
      accent: "#22c55e",
    },
    {
      icon: <Award size={22} />,
      title: "Ventaja Competitiva",
      body: `Un ROI de portafolio del ${m.roiPortfolio}% representa una ventaja estratégica frente al mercado, consolidando la posición de Zymo en innovación y resultados.`,
      accent: "#ef3340",
    },
  ]
}

export function ArgumentCards({ metrics }: ArgumentCardsProps) {
  const args = buildArguments(metrics)

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16,
        marginBottom: 28,
      }}
    >
      {args.map((a) => (
        <div
          key={a.title}
          style={{
            background: "var(--helix-surface)",
            border: "1px solid var(--helix-border)",
            borderRadius: 10,
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: a.accent + "18",
              color: a.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {a.icon}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "var(--helix-ink)",
            }}
          >
            {a.title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--helix-muted)",
              lineHeight: 1.6,
            }}
          >
            {a.body}
          </p>
        </div>
      ))}
    </div>
  )
}
