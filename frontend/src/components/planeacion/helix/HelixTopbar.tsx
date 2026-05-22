import type { CSSProperties } from "react"
import { useHelix, type HelixView } from "@/context/HelixContext"
import { helixApi } from "@/lib/helixApi"

const VIEW_TITLES: Record<HelixView, string> = {
  dashboard: "Panel de control",
  board: "Scrum Board",
  gantt: "Gantt",
  reports: "Estados",
  businessCase: "Valor / ROI",
  support: "Soporte",
  settings: "Configuración",
}

const BASE_BTN: CSSProperties = {
  minHeight: "40px",
  border: "1px solid",
  borderRadius: "8px",
  font: "inherit",
  cursor: "pointer",
  fontWeight: 800,
}

const ICON_BTN: CSSProperties = {
  ...BASE_BTN,
  width: "42px",
  padding: 0,
  borderColor: "rgba(255,255,255,0.32)",
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
}

const WA_BTN: CSSProperties = {
  ...ICON_BTN,
  borderColor: "rgba(31,157,106,0.55)",
  background: "rgba(31,157,106,0.2)",
}

const PRIMARY_BTN: CSSProperties = {
  ...BASE_BTN,
  padding: "0 16px",
  fontWeight: 900,
  borderColor: "#fff",
  background: "#fff",
  color: "#3f4652",
  boxShadow: "0 10px 24px rgba(239,51,64,0.2)",
}

export function HelixTopbar() {
  const { activeView, onNewTask } = useHelix()
  const title = VIEW_TITLES[activeView]

  function handleEmailAlert() {
    helixApi.post("/api/alertas/email").catch(() => undefined)
  }

  function handleWhatsAppAlert() {
    helixApi.post("/api/alertas/whatsapp").catch(() => undefined)
  }

  function handleAutoAlert() {
    helixApi.post("/api/alertas/auto").catch(() => undefined)
  }

  return (
    <header
      style={{
        padding: "18px",
        borderRadius: "8px",
        marginBottom: "26px",
        background:
          "linear-gradient(135deg, rgba(38,42,49,0.98), rgba(96,101,112,0.96) 58%, rgba(239,51,64,0.9))",
        boxShadow: "0 18px 42px rgba(23,26,31,0.2)",
        border: "1px solid rgba(255,255,255,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.55)",
            marginBottom: "2px",
          }}
        >
          Gestión estructurada
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "1.35rem",
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          style={ICON_BTN}
          title="Generar alertas por correo"
          aria-label="Generar alertas por correo"
          onClick={handleEmailAlert}
        >
          @
        </button>
        <button
          style={WA_BTN}
          title="Alertas WhatsApp"
          aria-label="Alertas WhatsApp"
          onClick={handleWhatsAppAlert}
        >
          WA
        </button>
        <button
          style={ICON_BTN}
          title="Ver alertas automáticas"
          aria-label="Ver alertas automáticas"
          onClick={handleAutoAlert}
        >
          !
        </button>
        <button
          style={PRIMARY_BTN}
          onClick={onNewTask}
        >
          Nueva tarea
        </button>
      </div>
    </header>
  )
}
