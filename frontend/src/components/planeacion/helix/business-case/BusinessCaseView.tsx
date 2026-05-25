import { useState } from "react"
import { showHelixToast } from "../HelixToast"

// ─── Static content (mirrors app.js renderBusinessCase) ─────────────────────

const BUSINESS_CASE_TEXT = [
  "POR QUE USAR HELIX ZYMO",
  "",
  "Helix Zymo debe utilizarse porque conecta la ejecucion diaria con la lectura gerencial del proyecto. No solo administra tareas: convierte actividades, responsables, evidencias, costos, ROI, alertas y experiencia del cliente en informacion accionable para varias areas.",
  "",
  "Su nombre esta inspirado en la estructura del ADN: una helice ordenada, conectada y evolutiva. Cada subproyecto funciona como una cadena conectada de actividades, responsables, costos, decisiones, evidencias y aprendizajes.",
  "",
  "A diferencia de herramientas genericas, esta solucion esta pensada para adopcion transversal: operaciones puede registrar avances, lideres pueden controlar bloqueos, gerencia puede evaluar ROI y costos, y areas de servicio pueden anticipar impacto al cliente. Todo desde computador o celular, usando canales cotidianos como correo y WhatsApp.",
  "",
  "Valor agregado principal:",
  "- Gobierno multi-area: una sola vista para responsables de operaciones, proyectos, gerencia, servicio y areas de apoyo.",
  "- Trazabilidad: cada actividad conserva responsable, fecha, estado, costo, evidencia, comentarios y actualizaciones.",
  "- Comunicacion accionable: alertas por correo y WhatsApp para vencimientos, bloqueos, cambios y actualizaciones por subproyecto.",
  "- Control financiero: costos de inversion, optimizacion y ejecucion por subactividad, mas ROI por subproyecto.",
  "- Analitica gerencial: dashboard estadistico, semaforo, prediccion, riesgos, cumplimiento y costo por punto.",
  "- Experiencia del cliente: anticipa retrasos, comunica novedades y reduce perdida de informacion entre areas.",
  "- Adopcion practica: instructivos, chat IA de soporte, encuesta de satisfaccion y uso desde computador o celular.",
  "",
  "Conclusion:",
  "Conviene usar Helix Zymo cuando se necesita una herramienta simple pero robusta para coordinar varias areas, reducir dispersion, elevar trazabilidad y convertir el seguimiento operativo en decisiones gerenciales.",
].join("\n")

const COMPARISON_ROWS: [string, string, string][] = [
  ["Criterio", "Helix Zymo", "Herramientas genéricas"],
  ["Uso multi-área", "Operaciones, proyectos, gerencia, servicio y apoyo trabajan sobre la misma información.", "Suelen requerir permisos, tableros o configuraciones separadas."],
  ["Seguimiento operativo", "Scrum, Gantt, registros, evidencias, responsables y subproyectos integrados.", "Puede dispersarse entre módulos o vistas aisladas."],
  ["Decisión gerencial", "Informe ejecutivo con riesgos, costos, ROI, predicción y foco directivo.", "Normalmente exige tableros personalizados o exportaciones."],
  ["Comunicación", "Alertas por correo y WhatsApp para responsables de subproyecto.", "Requiere integraciones externas o automatizaciones pagas."],
  ["Control financiero", "Costos por subactividad y ROI por subproyecto en el flujo diario.", "No siempre conecta costo, avance y responsable en una sola lectura."],
  ["Adopción", "Chat IA, instructivos, encuesta y experiencia responsive.", "Mayor curva de aprendizaje y dependencia de configuración."],
]

const BENEFITS: [string, string][] = [
  ["Alineación", "Todas las áreas consultan el mismo estado, evitando versiones distintas del proyecto."],
  ["Decisión", "Gerencia ve riesgos, costos, ROI y acciones sin reconstruir información manualmente."],
  ["Responsabilidad", "Cada responsable queda vinculado a actividad, subproyecto, alerta y evidencia."],
  ["Experiencia del cliente", "La herramienta anticipa vencimientos y facilita comunicar cambios con oportunidad."],
  ["Control", "El avance se mide con puntos, fechas, costos, alertas, evidencias y satisfacción de uso."],
  ["Adopción", "Chat IA, instructivos y encuesta reducen fricción para usuarios de diferentes áreas."],
]

const AREA_VALUES: [string, string][] = [
  ["Operaciones", "Registro práctico de actividades, evidencias, costos y bloqueos."],
  ["Líderes de proyecto", "Control Scrum/Gantt, responsables, subproyectos, alertas y predicción."],
  ["Gerencia", "Dashboard estadístico, ROI, informe ejecutivo y decisiones requeridas."],
  ["Servicio / cliente interno", "Alertas oportunas, trazabilidad de compromisos y encuesta de satisfacción."],
  ["Finanzas / administración", "Lectura de inversión, optimización, ejecución y costo por punto."],
  ["Calidad / PMO", "Estandarización de seguimiento, instructivos, evidencias y gobierno del dato."],
]

const FUNCTIONAL_VALIDATION: [string, string][] = [
  ["Panel", "Mide avance, salud, estadística, carga, flujo y badges."],
  ["Scrum / Gantt", "Permite gestionar actividades, fechas, estados, evidencias y comentarios."],
  ["Estados", "Genera informe gerencial con costos, riesgos, ROI y decisiones."],
  ["Alertas", "Prepara mensajes por correo y WhatsApp para responsables y actualizaciones."],
  ["Soporte", "Incluye chat IA, instructivos descargables/cargables y encuesta de satisfacción."],
  ["Configuración", "Administra responsables, subproyectos, actividades y alertas automáticas."],
]

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = {
  background: "var(--helix-surface)",
  border: "1px solid var(--helix-border)",
  borderRadius: 10,
  padding: "22px 24px",
} as const

const eyebrow = {
  margin: "0 0 6px",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "var(--helix-accent)",
}

const cardTitle = {
  margin: "0 0 10px",
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--helix-ink)",
  lineHeight: 1.3,
}

const cardBody = {
  margin: 0,
  fontSize: "0.875rem",
  color: "var(--helix-muted)",
  lineHeight: 1.65,
}

const sectionTitle = {
  margin: "0 0 14px",
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--helix-ink)",
}

const benefitCard = {
  padding: "12px 14px",
  borderRadius: 8,
  background: "var(--helix-bg, #f8fafc)",
  border: "1px solid var(--helix-border)",
  marginBottom: 8,
} as const

// ─── Component ───────────────────────────────────────────────────────────────

export function BusinessCaseView() {
  const [text, setText] = useState(BUSINESS_CASE_TEXT)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(
      () => showHelixToast("Argumento copiado al portapapeles", "success"),
      () => showHelixToast("No se pudo copiar", "error"),
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--helix-ink)" }}>
            Por qué usar esta herramienta
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "var(--helix-muted)" }}>
            Argumento ejecutivo para justificar adopción frente a otras plataformas de gestión.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "none",
            background: "var(--helix-accent)",
            color: "#fff",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Copiar argumento
        </button>
      </div>

      {/* Value panels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={card}>
          <p style={eyebrow}>Propuesta de valor</p>
          <h3 style={cardTitle}>Gestión de proyectos alineada a Zymo, no una plantilla genérica.</h3>
          <p style={cardBody}>
            Esta herramienta concentra planeación Scrum, seguimiento Gantt, evidencias, observaciones, alertas por correo y WhatsApp, análisis de riesgo e insignias de cumplimiento en una sola experiencia simple para computador y celular.
          </p>
        </div>
        <div style={card}>
          <p style={eyebrow}>Diferencial clave</p>
          <h3 style={cardTitle}>Menos fricción, más trazabilidad.</h3>
          <p style={cardBody}>
            El equipo puede gestionar tareas, registrar evidencias, capturar observaciones recibidas por WhatsApp y generar estados ejecutivos sin saltar entre varias herramientas.
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {COMPARISON_ROWS.map(([criterio, helix, generica], i) => (
                <tr
                  key={criterio}
                  style={{
                    background: i === 0
                      ? "linear-gradient(135deg, #1e2128, #2b2f3a)"
                      : i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <td style={{
                    padding: "12px 18px",
                    fontWeight: i === 0 ? 700 : 600,
                    color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--helix-muted)",
                    borderBottom: "1px solid var(--helix-border)",
                    whiteSpace: "nowrap",
                    width: "18%",
                    fontSize: i === 0 ? "0.72rem" : "0.85rem",
                    textTransform: i === 0 ? "uppercase" : "none",
                    letterSpacing: i === 0 ? "0.06em" : "normal",
                  }}>
                    {criterio}
                  </td>
                  <td style={{
                    padding: "12px 18px",
                    color: i === 0 ? "#22c55e" : "var(--helix-ink)",
                    fontWeight: i === 0 ? 700 : 500,
                    borderBottom: "1px solid var(--helix-border)",
                    fontSize: i === 0 ? "0.72rem" : "0.85rem",
                    textTransform: i === 0 ? "uppercase" : "none",
                    letterSpacing: i === 0 ? "0.06em" : "normal",
                  }}>
                    {helix}
                  </td>
                  <td style={{
                    padding: "12px 18px",
                    color: i === 0 ? "rgba(255,255,255,0.5)" : "var(--helix-muted)",
                    fontWeight: i === 0 ? 700 : 400,
                    borderBottom: "1px solid var(--helix-border)",
                    fontSize: i === 0 ? "0.72rem" : "0.85rem",
                    textTransform: i === 0 ? "uppercase" : "none",
                    letterSpacing: i === 0 ? "0.06em" : "normal",
                  }}>
                    {generica}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Benefits + Area value */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={card}>
          <h3 style={sectionTitle}>Beneficios esperados</h3>
          {BENEFITS.map(([title, body]) => (
            <div key={title} style={benefitCard}>
              <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--helix-ink)", marginBottom: 3 }}>{title}</strong>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--helix-muted)", lineHeight: 1.5 }}>{body}</p>
            </div>
          ))}
        </div>
        <div style={card}>
          <h3 style={sectionTitle}>Valor por área</h3>
          {AREA_VALUES.map(([title, body]) => (
            <div key={title} style={benefitCard}>
              <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--helix-ink)", marginBottom: 3 }}>{title}</strong>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--helix-muted)", lineHeight: 1.5 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Business case text + Functional validation */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={card}>
          <h3 style={sectionTitle}>Texto listo para presentar</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 260,
              resize: "vertical",
              padding: "12px",
              borderRadius: 6,
              border: "1px solid var(--helix-border)",
              background: "var(--helix-bg, #f8fafc)",
              color: "var(--helix-ink)",
              fontSize: "0.8rem",
              lineHeight: 1.65,
              fontFamily: "monospace",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={card}>
          <h3 style={sectionTitle}>Validación funcional</h3>
          {FUNCTIONAL_VALIDATION.map(([title, body]) => (
            <div key={title} style={{ ...benefitCard, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(34,197,94,0.15)",
                border: "1.5px solid #22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                color: "#22c55e",
                fontWeight: 900,
                marginTop: 1,
              }}>✓</span>
              <div>
                <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--helix-ink)", marginBottom: 2 }}>{title}</strong>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--helix-muted)", lineHeight: 1.5 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
