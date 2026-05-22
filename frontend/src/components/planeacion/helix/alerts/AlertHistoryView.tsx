import type { CSSProperties } from "react"
import { useHelixAlertas } from "@/hooks/useHelixAlertas"

const CANAL_COLORS: Record<string, string> = {
  auto: "rgba(99,102,241,0.25)",
  whatsapp: "rgba(31,157,106,0.25)",
  email: "rgba(59,130,246,0.25)",
}

const CANAL_TEXT_COLORS: Record<string, string> = {
  auto: "#a5b4fc",
  whatsapp: "#6ee7b7",
  email: "#93c5fd",
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function AlertHistoryView() {
  const { data, loading, error, refetch } = useHelixAlertas()

  const containerStyle: CSSProperties = {
    padding: "16px",
    color: "var(--helix-text, #e2e8f0)",
  }

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  }

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--helix-text, #e2e8f0)",
  }

  const refetchBtnStyle: CSSProperties = {
    padding: "4px 12px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.07)",
    color: "var(--helix-text-muted, #94a3b8)",
    fontSize: "0.78rem",
    cursor: "pointer",
    fontFamily: "inherit",
  }

  const itemStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "var(--helix-surface-2, rgba(255,255,255,0.04))",
    border: "1px solid var(--helix-border, rgba(255,255,255,0.08))",
    marginBottom: "8px",
  }

  const emptyStyle: CSSProperties = {
    textAlign: "center",
    padding: "40px 0",
    color: "var(--helix-text-muted, #94a3b8)",
    fontSize: "0.9rem",
  }

  const errorStyle: CSSProperties = {
    color: "#f87171",
    fontSize: "0.85rem",
    padding: "12px",
    background: "rgba(239,68,68,0.1)",
    borderRadius: "6px",
    border: "1px solid rgba(239,68,68,0.2)",
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>Historial de Alertas</h3>
        <button style={refetchBtnStyle} onClick={refetch}>
          Actualizar
        </button>
      </div>

      {loading && (
        <p style={{ color: "var(--helix-text-muted, #94a3b8)", fontSize: "0.85rem" }}>
          Cargando...
        </p>
      )}

      {error && <p style={errorStyle}>{error}</p>}

      {!loading && !error && data !== null && data.length === 0 && (
        <p style={emptyStyle}>No hay alertas registradas.</p>
      )}

      {!loading &&
        !error &&
        data?.map((alerta) => {
          const canal = alerta.canal ?? "auto"
          const badgeStyle: CSSProperties = {
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "4px",
            background: CANAL_COLORS[canal] ?? "rgba(255,255,255,0.1)",
            color: CANAL_TEXT_COLORS[canal] ?? "#e2e8f0",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }

          const cambioStyle: CSSProperties = {
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "var(--helix-text, #e2e8f0)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }

          const metaStyle: CSSProperties = {
            fontSize: "0.78rem",
            color: "var(--helix-text-muted, #94a3b8)",
            marginTop: "2px",
          }

          const dateStyle: CSSProperties = {
            fontSize: "0.75rem",
            color: "var(--helix-text-muted, #94a3b8)",
            whiteSpace: "nowrap",
            flexShrink: 0,
            marginLeft: "auto",
          }

          return (
            <div key={alerta.id} style={itemStyle}>
              <span style={badgeStyle}>{canal.toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...cambioStyle, margin: 0 }}>{alerta.cambio}</p>
                {alerta.actividadNombre && (
                  <p style={{ ...metaStyle, margin: "2px 0 0" }}>
                    {alerta.actividadNombre}
                    {alerta.subproyectoNombre
                      ? ` — ${alerta.subproyectoNombre}`
                      : ""}
                  </p>
                )}
              </div>
              <span style={dateStyle}>{formatDate(alerta.createdAt)}</span>
            </div>
          )
        })}
    </div>
  )
}
