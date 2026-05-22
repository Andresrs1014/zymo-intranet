import { Trophy, Zap, Star, Users, CheckCircle } from "lucide-react"
import type { HelixInsignia } from "@/types/helix"
import type { CSSProperties } from "react"

interface BadgesPanelProps {
  insignias: HelixInsignia[]
}

type IconName = "Trophy" | "Zap" | "Star" | "Users"

const TIPO_ICONS: Record<string, IconName> = {
  cumplimiento: "Trophy",
  velocidad: "Zap",
  calidad: "Star",
  colaboracion: "Users",
}

const ICON_MAP = { Trophy, Zap, Star, Users }

function BadgeCard({ insignia }: { insignia: HelixInsignia }) {
  const iconName: IconName = TIPO_ICONS[insignia.tipo] ?? "Star"
  const IconComp = ICON_MAP[iconName]

  const obtainedStyle: CSSProperties = insignia.obtenida
    ? {
        border: "2px solid var(--helix-done)",
        background: "var(--helix-ok-bg)",
      }
    : {
        border: "2px dashed var(--helix-line)",
        background: "var(--helix-surface-2)",
      }

  const iconColor = insignia.obtenida ? "var(--helix-done)" : "var(--helix-muted)"
  const titleColor = insignia.obtenida ? "var(--helix-ink)" : "var(--helix-muted)"

  return (
    <div
      style={{
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...obtainedStyle,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconComp size={20} color={iconColor} />
        <span
          style={{
            fontSize: "var(--helix-text-body-sm)",
            fontWeight: 700,
            color: titleColor,
            flex: 1,
          }}
        >
          {insignia.titulo}
        </span>
        {insignia.obtenida && (
          <CheckCircle size={16} color="var(--helix-done)" />
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: "var(--helix-text-tiny)",
          color: "var(--helix-muted)",
          lineHeight: "var(--helix-lh-normal)",
        }}
      >
        {insignia.descripcion}
      </p>

      {/* Valor mini bar */}
      <div>
        <div
          style={{
            height: 5,
            borderRadius: 3,
            background: "var(--helix-bar-track)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, insignia.valor))}%`,
              background: insignia.obtenida ? "var(--helix-done)" : "var(--helix-muted)",
              borderRadius: 3,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <span
          style={{
            fontSize: "var(--helix-text-micro)",
            color: "var(--helix-muted)",
            marginTop: 2,
            display: "block",
          }}
        >
          {insignia.valor}%
        </span>
      </div>
    </div>
  )
}

export function BadgesPanel({ insignias }: BadgesPanelProps) {
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
        Insignias
      </h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {insignias.map((ins) => (
          <BadgeCard key={ins.tipo} insignia={ins} />
        ))}
      </div>
    </div>
  )
}
