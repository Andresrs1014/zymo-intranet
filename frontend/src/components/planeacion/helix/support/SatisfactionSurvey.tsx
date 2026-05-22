import { useState } from "react"
import { helixApi } from "@/lib/helixApi"

type Rol = "Desarrollador" | "Gestor" | "Directivo" | "Otro"

interface SurveyForm {
  nombre: string
  rol: Rol | ""
  satisfaccion: number
  facilidad: number
  utilidad: number
  nps: number | ""
  comentario: string
}

const ROL_OPTIONS: Rol[] = ["Desarrollador", "Gestor", "Directivo", "Otro"]

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            fontSize: 22,
            padding: 0,
            color: star <= value ? "#f5a623" : "var(--helix-border)",
            lineHeight: 1,
          }}
        >
          {star <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  )
}

const INITIAL_FORM: SurveyForm = {
  nombre: "",
  rol: "",
  satisfaccion: 0,
  facilidad: 0,
  utilidad: 0,
  nps: "",
  comentario: "",
}

export function SatisfactionSurvey() {
  const [form, setForm] = useState<SurveyForm>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SurveyForm, string>>>({})

  function validate(): boolean {
    const errors: Partial<Record<keyof SurveyForm, string>> = {}
    if (!form.nombre.trim()) errors.nombre = "Requerido"
    if (!form.rol) errors.rol = "Requerido"
    if (form.satisfaccion === 0) errors.satisfaccion = "Selecciona una calificación"
    if (form.facilidad === 0) errors.facilidad = "Selecciona una calificación"
    if (form.utilidad === 0) errors.utilidad = "Selecciona una calificación"
    if (form.nps === "" || form.nps < 0 || form.nps > 10)
      errors.nps = "Ingresa un valor entre 0 y 10"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      await helixApi.post("/api/encuestas", {
        nombre: form.nombre.trim(),
        rol: form.rol,
        satisfaccion: form.satisfaccion,
        facilidad: form.facilidad,
        utilidad: form.utilidad,
        nps: Number(form.nps),
        comentario: form.comentario.trim() || undefined,
      })
      setSubmitted(true)
    } catch {
      // Silent fail — survey submission is non-critical
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "var(--helix-muted)",
    marginBottom: 4,
    fontWeight: 500,
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid var(--helix-border)",
    background: "var(--helix-bg)",
    color: "var(--helix-ink)",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  }

  const errorStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--helix-accent)",
    marginTop: 3,
  }

  if (submitted) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "var(--helix-ink)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>¡Gracias por tu respuesta!</p>
        <p style={{ fontSize: 12, color: "var(--helix-muted)", marginTop: 4 }}>
          Tu opinión nos ayuda a mejorar Helix.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Nombre */}
      <div>
        <label style={labelStyle}>Nombre</label>
        <input
          type="text"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          disabled={submitting}
          style={inputStyle}
          placeholder="Tu nombre"
        />
        {fieldErrors.nombre && <p style={errorStyle}>{fieldErrors.nombre}</p>}
      </div>

      {/* Rol */}
      <div>
        <label style={labelStyle}>Rol</label>
        <select
          value={form.rol}
          onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
          disabled={submitting}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">Selecciona…</option>
          {ROL_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {fieldErrors.rol && <p style={errorStyle}>{fieldErrors.rol}</p>}
      </div>

      {/* Satisfacción */}
      <div>
        <label style={labelStyle}>Satisfacción general</label>
        <StarRating
          value={form.satisfaccion}
          onChange={(v) => setForm((f) => ({ ...f, satisfaccion: v }))}
          disabled={submitting}
        />
        {fieldErrors.satisfaccion && <p style={errorStyle}>{fieldErrors.satisfaccion}</p>}
      </div>

      {/* Facilidad */}
      <div>
        <label style={labelStyle}>Facilidad de uso</label>
        <StarRating
          value={form.facilidad}
          onChange={(v) => setForm((f) => ({ ...f, facilidad: v }))}
          disabled={submitting}
        />
        {fieldErrors.facilidad && <p style={errorStyle}>{fieldErrors.facilidad}</p>}
      </div>

      {/* Utilidad */}
      <div>
        <label style={labelStyle}>Utilidad para tu trabajo</label>
        <StarRating
          value={form.utilidad}
          onChange={(v) => setForm((f) => ({ ...f, utilidad: v }))}
          disabled={submitting}
        />
        {fieldErrors.utilidad && <p style={errorStyle}>{fieldErrors.utilidad}</p>}
      </div>

      {/* NPS */}
      <div>
        <label style={labelStyle}>¿Recomendarías Helix a otro equipo? (0–10)</label>
        <input
          type="number"
          min={0}
          max={10}
          value={form.nps}
          onChange={(e) => {
            const raw = e.target.value
            setForm((f) => ({ ...f, nps: raw === "" ? "" : Number(raw) }))
          }}
          disabled={submitting}
          style={{ ...inputStyle, width: 80 }}
          placeholder="0–10"
        />
        {fieldErrors.nps && <p style={errorStyle}>{fieldErrors.nps}</p>}
      </div>

      {/* Comentario */}
      <div>
        <label style={labelStyle}>Comentario (opcional)</label>
        <textarea
          value={form.comentario}
          onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
          disabled={submitting}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="¿Qué mejorarías?"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "8px 20px",
          borderRadius: 6,
          border: "none",
          background: "var(--helix-accent)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.7 : 1,
          alignSelf: "flex-start",
        }}
      >
        {submitting ? "Enviando…" : "Enviar encuesta"}
      </button>
    </form>
  )
}
