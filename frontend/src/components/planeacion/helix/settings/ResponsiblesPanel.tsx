import type { CSSProperties } from "react"
import { useHelixUsuarios } from "@/hooks/useHelixUsuarios"
import type { HelixUsuario } from "@/types/helix"

// ─── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  padding: "24px",
}

const headerStyle: CSSProperties = {
  marginBottom: "20px",
}

const titleStyle: CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--helix-ink)",
  margin: "0 0 4px",
}

const subtitleStyle: CSSProperties = {
  fontSize: "var(--helix-text-caption)",
  color: "var(--helix-muted)",
  margin: 0,
  lineHeight: "var(--helix-lh-relaxed)",
}

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
}

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  background: "var(--helix-surface)",
  border: "var(--helix-border-default)",
  borderRadius: "var(--helix-r-large)",
  boxShadow: "var(--helix-shadow-task)",
}

const infoBannerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "12px 16px",
  background: "rgba(0,168,200,0.08)",
  border: "1px solid rgba(0,168,200,0.24)",
  borderRadius: "var(--helix-r-regular)",
  marginBottom: "20px",
  fontSize: "var(--helix-text-body-sm)",
  color: "var(--helix-muted)",
  lineHeight: "var(--helix-lh-relaxed)",
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ usuario }: { usuario: HelixUsuario }) {
  const initials = usuario.initials ?? usuario.full_name.slice(0, 2).toUpperCase()
  const bgColor = usuario.color ?? "var(--helix-ai)"

  return (
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "var(--helix-r-full)",
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: "var(--helix-text-caption)",
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: "var(--helix-font)",
      }}
    >
      {initials}
    </div>
  )
}

// ─── ResponsiblesPanel ────────────────────────────────────────────────────────

export function ResponsiblesPanel() {
  const { usuarios, loading, error } = useHelixUsuarios()

  if (loading) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "var(--helix-muted)", fontSize: "var(--helix-text-body)" }}>
          Cargando responsables...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "var(--helix-danger)", fontSize: "var(--helix-text-body)" }}>
          Error: {error}
        </p>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>Responsables ({usuarios.length})</h3>
        <p style={subtitleStyle}>
          Usuarios activos disponibles para asignar actividades en el módulo Helix.
        </p>
      </div>

      {/* Info banner */}
      <div style={infoBannerStyle}>
        <span style={{ flexShrink: 0, fontSize: "1rem" }}>ℹ️</span>
        <span>
          Los responsables son los usuarios de la intranet. Para agregar o eliminar responsables,
          gestiona los usuarios desde Administración.
        </span>
      </div>

      {/* User list */}
      {usuarios.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 24px",
            color: "var(--helix-muted)",
            fontSize: "var(--helix-text-body)",
          }}
        >
          No hay usuarios registrados.
        </div>
      ) : (
        <div style={listStyle}>
          {usuarios.map((usuario) => (
            <div key={usuario.id} style={cardStyle}>
              <UserAvatar usuario={usuario} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: "0 0 2px",
                    fontSize: "var(--helix-text-body-def)",
                    fontWeight: 600,
                    color: "var(--helix-ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {usuario.full_name}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--helix-text-caption)",
                    color: "var(--helix-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {usuario.email}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
