import type { CSSProperties } from "react"
import type { HelixDashboardMetricas } from "@/types/helix"

interface MetricsGridProps {
  metricas: HelixDashboardMetricas
}

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: "green" | "red" | "orange" | "neutral" | "accent"
  showBar?: boolean
  barValue?: number
}

const cardStyle: CSSProperties = {
  background: "var(--helix-card-bg)",
  boxShadow: "var(--helix-shadow-card)",
  borderRadius: "10px",
  padding: "16px",
  minWidth: "120px",
  flex: "1 1 140px",
}

const accentColors: Record<string, string> = {
  green: "var(--helix-done)",
  red: "var(--helix-danger)",
  orange: "var(--helix-warning)",
  accent: "var(--helix-accent)",
  neutral: "var(--helix-ink)",
}

function KpiCard({ label, value, sub, accent = "neutral", showBar, barValue }: KpiCardProps) {
  const color = accentColors[accent]
  return (
    <div style={cardStyle}>
      <div
        style={{
          fontSize: "var(--helix-text-caption)",
          color: "var(--helix-muted)",
          fontWeight: 600,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--helix-text-h)",
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "var(--helix-text-tiny)",
            color: "var(--helix-muted)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
      {showBar && barValue !== undefined && (
        <div
          style={{
            marginTop: 8,
            height: 5,
            borderRadius: 3,
            background: "var(--helix-bar-track)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, barValue))}%`,
              background: color,
              borderRadius: 3,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}
    </div>
  )
}

export function MetricsGrid({ metricas }: MetricsGridProps) {
  const {
    total,
    completadas,
    enProgreso,
    vencidas,
    bloqueadas,
    puntosTotal,
    puntosCompletados,
    avanceGlobal,
  } = metricas

  const pctCompletadas = total === 0 ? 0 : Math.round((completadas / total) * 100)

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <KpiCard label="Total actividades" value={total} accent="neutral" />
      <KpiCard
        label="Completadas"
        value={completadas}
        sub={`${pctCompletadas}% del total`}
        accent={pctCompletadas > 50 ? "green" : "neutral"}
      />
      <KpiCard
        label="En progreso"
        value={enProgreso}
        accent="neutral"
      />
      <KpiCard
        label="Vencidas"
        value={vencidas}
        accent={vencidas > 0 ? "red" : "neutral"}
      />
      <KpiCard
        label="Bloqueadas"
        value={bloqueadas}
        accent={bloqueadas > 0 ? "orange" : "neutral"}
      />
      <KpiCard
        label="Puntos"
        value={`${puntosCompletados} / ${puntosTotal}`}
        sub="completados / total"
        accent="neutral"
      />
      <KpiCard
        label="Avance global"
        value={`${avanceGlobal}%`}
        accent="accent"
        showBar
        barValue={avanceGlobal}
      />
    </div>
  )
}
