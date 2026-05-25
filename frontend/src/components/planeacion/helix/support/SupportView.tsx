import { useState } from "react"
import { AIChat } from "./AIChat"
import { SatisfactionSurvey } from "./SatisfactionSurvey"
import { InstructivosPanel } from "./InstructivosPanel"

export function SupportView() {
  const [surveyOpen, setSurveyOpen] = useState(false)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 20,
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      {/* Page header */}
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: "var(--helix-ink)",
          }}
        >
          Soporte y Asistente IA
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--helix-muted)",
          }}
        >
          Consulta el estado de tus proyectos con el Agente Helix o deja tu opinión sobre la plataforma.
        </p>
      </div>

      {/* AI Chat section */}
      <section>
        <h3
          style={{
            margin: "0 0 10px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--helix-ink)",
          }}
        >
          Chat con Helix IA
        </h3>
        <AIChat />
      </section>

      {/* Instructivos de uso */}
      <InstructivosPanel />

      {/* Satisfaction survey — collapsible */}
      <section
        style={{
          border: "1px solid var(--helix-border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setSurveyOpen((o) => !o)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--helix-surface)",
            border: "none",
            cursor: "pointer",
            color: "var(--helix-ink)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Encuesta de satisfacción</span>
          <span
            style={{
              fontSize: 12,
              color: "var(--helix-muted)",
              transform: surveyOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              display: "inline-block",
            }}
          >
            ▼
          </span>
        </button>

        {surveyOpen && (
          <div
            style={{
              padding: 20,
              background: "var(--helix-bg)",
              borderTop: "1px solid var(--helix-border)",
            }}
          >
            <SatisfactionSurvey />
          </div>
        )}
      </section>
    </div>
  )
}
