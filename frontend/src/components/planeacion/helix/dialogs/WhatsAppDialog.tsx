import { useEffect, useState, type CSSProperties } from "react"

export interface AlertaGenerada {
  actividadId: number
  actividadNombre: string
  subproyectoNombre: string
  responsableNombre: string
  tipo: "vencida" | "bloqueada" | "riesgo"
  mensaje: string
  destinatarios: string[]
}

interface WhatsAppDialogProps {
  open: boolean
  onClose: () => void
  alertas: AlertaGenerada[]
}

const TIPO_BADGE_COLORS: Record<AlertaGenerada["tipo"], string> = {
  vencida: "#ef3340",
  bloqueada: "#f97316",
  riesgo: "#eab308",
}

const TIPO_LABELS: Record<AlertaGenerada["tipo"], string> = {
  vencida: "VENCIDA",
  bloqueada: "BLOQUEADA",
  riesgo: "EN RIESGO",
}

function MessageCard({ alerta }: { alerta: AlertaGenerada }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(alerta.mensaje).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const badgeStyle: CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    background: TIPO_BADGE_COLORS[alerta.tipo],
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    marginBottom: "6px",
  }

  const cardStyle: CSSProperties = {
    background: "var(--helix-surface-2, rgba(255,255,255,0.04))",
    border: "1px solid var(--helix-border, rgba(255,255,255,0.1))",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "10px",
  }

  const preStyle: CSSProperties = {
    margin: "8px 0 10px",
    padding: "10px",
    background: "rgba(0,0,0,0.15)",
    borderRadius: "6px",
    fontFamily: "monospace",
    fontSize: "0.8rem",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--helix-text, #e2e8f0)",
  }

  const copyBtnStyle: CSSProperties = {
    padding: "4px 12px",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "6px",
    background: copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
    color: copied ? "#86efac" : "var(--helix-text-muted, #94a3b8)",
    fontSize: "0.78rem",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.2s",
  }

  return (
    <div style={cardStyle}>
      <span style={badgeStyle}>{TIPO_LABELS[alerta.tipo]}</span>
      <div
        style={{
          fontWeight: 700,
          fontSize: "0.9rem",
          color: "var(--helix-text, #e2e8f0)",
          marginBottom: "2px",
        }}
      >
        {alerta.actividadNombre}
      </div>
      <pre style={preStyle}>{alerta.mensaje}</pre>
      <button style={copyBtnStyle} onClick={handleCopy}>
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  )
}

export function WhatsAppDialog({ open, onClose, alertas }: WhatsAppDialogProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  }

  const cardStyle: CSSProperties = {
    maxWidth: "600px",
    width: "100%",
    background: "var(--helix-surface, #1e2229)",
    borderRadius: "12px",
    padding: "24px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
  }

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  }

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--helix-text, #e2e8f0)",
  }

  const closeBtnStyle: CSSProperties = {
    width: "32px",
    height: "32px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.07)",
    color: "var(--helix-text-muted, #94a3b8)",
    cursor: "pointer",
    fontSize: "1rem",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  }

  const scrollAreaStyle: CSSProperties = {
    overflowY: "auto",
    flex: 1,
    marginBottom: "16px",
  }

  const footerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
  }

  const footerBtnStyle: CSSProperties = {
    padding: "8px 20px",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.08)",
    color: "var(--helix-text, #e2e8f0)",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  }

  const emptyStyle: CSSProperties = {
    textAlign: "center",
    padding: "40px 0",
    color: "var(--helix-text-muted, #94a3b8)",
    fontSize: "0.95rem",
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Mensajes de Alerta WhatsApp</h2>
          <button
            style={closeBtnStyle}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div style={scrollAreaStyle}>
          {alertas.length === 0 ? (
            <p style={emptyStyle}>No hay alertas activas ✅</p>
          ) : (
            alertas.map((alerta) => (
              <MessageCard key={alerta.actividadId} alerta={alerta} />
            ))
          )}
        </div>

        <div style={footerStyle}>
          <button style={footerBtnStyle} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
