import type { HelixActividadBloqueada } from "@/types/helix"

interface BlockersPanelProps {
  bloqueadas: HelixActividadBloqueada[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
}

export function BlockersPanel({ bloqueadas }: BlockersPanelProps) {
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
        Actividades bloqueadas
      </h4>

      {bloqueadas.length === 0 ? (
        <div
          style={{
            padding: "24px 0",
            textAlign: "center",
            fontSize: "var(--helix-text-body-sm)",
            color: "var(--helix-muted)",
          }}
        >
          Sin bloqueos activos 🎉
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bloqueadas.map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--helix-danger-bg)",
                border: "1px solid rgba(239,51,64,0.18)",
                flexWrap: "wrap",
              }}
            >
              {/* Responsable avatar */}
              <div
                title={b.responsableNombre}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: b.responsableColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "var(--helix-text-tiny)",
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {b.responsableInitials}
              </div>

              {/* Name & subproject */}
              <div style={{ flex: 1, minWidth: 100 }}>
                <div
                  style={{
                    fontSize: "var(--helix-text-body-sm)",
                    fontWeight: 700,
                    color: "var(--helix-ink)",
                  }}
                >
                  {b.nombre}
                </div>
                <div
                  style={{
                    fontSize: "var(--helix-text-tiny)",
                    color: "var(--helix-muted)",
                  }}
                >
                  {b.subproyectoNombre} · vence {formatDate(b.fechaFin)}
                </div>
              </div>

              {/* Mini progress bar */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 60 }}>
                <div
                  style={{
                    width: 60,
                    height: 5,
                    borderRadius: 3,
                    background: "var(--helix-bar-track)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${b.avance}%`,
                      background: "var(--helix-warning)",
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "var(--helix-text-micro)",
                    color: "var(--helix-muted)",
                  }}
                >
                  {b.avance}%
                </span>
              </div>

              {/* Bloqueada badge */}
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "var(--helix-r-full)",
                  background: "var(--helix-danger)",
                  color: "#fff",
                  fontSize: "var(--helix-text-micro)",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                Bloqueada
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
