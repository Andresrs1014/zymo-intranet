import { useState, useEffect, type CSSProperties, type FormEvent, type ChangeEvent } from "react"
import type { HelixActividad } from "@/types/helix"
import type { HelixActividadCreate } from "@/hooks/useHelixActividades"
import { useHelixSubproyectos } from "@/hooks/useHelixSubproyectos"
import { useHelixUsuarios } from "@/hooks/useHelixUsuarios"

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  actividad?: HelixActividad
  onSaved: () => void
  createActividad: (data: HelixActividadCreate) => Promise<void>
  updateActividad: (id: number, data: Partial<HelixActividadCreate>) => Promise<void>
}

const ESTADOS = ["Backlog", "Planificado", "En curso", "Revision", "Terminado"] as const
const PRIORIDADES = ["Alta", "Media", "Baja"] as const

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface FormState {
  nombre: string
  subproyectoId: string
  responsableId: string
  prioridad: string
  estado: string
  fechaInicio: string
  fechaFin: string
  avance: string
  puntos: string
  bloqueada: boolean
  costoInversion: string
  costoOptimizacion: string
  costoEjecucion: string
}

function buildInitialForm(actividad?: HelixActividad): FormState {
  if (actividad) {
    return {
      nombre: actividad.nombre,
      subproyectoId: String(actividad.subproyectoId),
      responsableId: String(actividad.responsableId),
      prioridad: actividad.prioridad,
      estado: actividad.estado,
      fechaInicio: actividad.fechaInicio.slice(0, 10),
      fechaFin: actividad.fechaFin.slice(0, 10),
      avance: String(actividad.avance),
      puntos: String(actividad.puntos),
      bloqueada: actividad.bloqueada,
      costoInversion: actividad.costoInversion ? String(actividad.costoInversion) : "",
      costoOptimizacion: actividad.costoOptimizacion ? String(actividad.costoOptimizacion) : "",
      costoEjecucion: actividad.costoEjecucion ? String(actividad.costoEjecucion) : "",
    }
  }
  return {
    nombre: "",
    subproyectoId: "",
    responsableId: "",
    prioridad: "Media",
    estado: "Backlog",
    fechaInicio: todayISO(),
    fechaFin: todayISO(),
    avance: "0",
    puntos: "3",
    bloqueada: false,
    costoInversion: "",
    costoOptimizacion: "",
    costoEjecucion: "",
  }
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
}

const cardStyle: CSSProperties = {
  background: "var(--helix-surface, #ffffff)",
  borderRadius: "var(--helix-r-large, 12px)",
  boxShadow: "var(--helix-shadow-default, 0 18px 42px rgba(35,38,45,0.12))",
  border: "var(--helix-border-default, 1px solid #d8dde8)",
  width: "100%",
  maxWidth: "560px",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 24px",
  borderBottom: "1px solid var(--helix-line, #d8dde8)",
  flexShrink: 0,
}

const bodyStyle: CSSProperties = {
  padding: "20px 24px",
  overflowY: "auto",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
}

const footerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "10px",
  padding: "14px 24px",
  borderTop: "1px solid var(--helix-line, #d8dde8)",
  flexShrink: 0,
}

const fieldGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
}

const labelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--helix-muted, #5c6374)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--helix-line, #d8dde8)",
  borderRadius: "var(--helix-r-soft, 6px)",
  fontSize: "13px",
  color: "var(--helix-ink, #121420)",
  background: "var(--helix-surface, #ffffff)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 160ms",
}

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
}

const sectionToggleStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--helix-accent, #ef3340)",
  padding: "4px 0",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const cancelBtnStyle: CSSProperties = {
  padding: "8px 18px",
  borderRadius: "var(--helix-r-soft, 6px)",
  border: "1px solid var(--helix-line, #d8dde8)",
  background: "var(--helix-surface, #ffffff)",
  color: "var(--helix-muted, #5c6374)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
}

const saveBtnStyle: CSSProperties = {
  padding: "8px 20px",
  borderRadius: "var(--helix-r-soft, 6px)",
  border: "none",
  background: "var(--helix-accent, #ef3340)",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "var(--helix-shadow-btn, 0 10px 24px rgba(239,51,64,0.18))",
}

const saveBtnDisabledStyle: CSSProperties = {
  ...saveBtnStyle,
  opacity: 0.55,
  cursor: "not-allowed",
}

const closeBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "18px",
  color: "var(--helix-muted, #5c6374)",
  lineHeight: 1,
  padding: "2px 6px",
  borderRadius: "4px",
}

const errorStyle: CSSProperties = {
  background: "var(--helix-danger-bg, rgba(239,51,64,0.12))",
  color: "var(--helix-danger-text, #a21220)",
  border: "1px solid rgba(239,51,64,0.22)",
  borderRadius: "var(--helix-r-soft, 6px)",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 500,
}

const FOCUS_OUTLINE = "2px solid var(--helix-accent, #ef3340)"

function focusStyle(focused: boolean): CSSProperties {
  return focused ? { outline: FOCUS_OUTLINE, outlineOffset: "-1px", borderColor: "var(--helix-accent, #ef3340)" } : {}
}

export function TaskDialog({ open, onClose, actividad, onSaved, createActividad, updateActividad }: TaskDialogProps) {
  const { subproyectos } = useHelixSubproyectos()
  const { usuarios } = useHelixUsuarios()

  const [form, setForm] = useState<FormState>(() => buildInitialForm(actividad))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [costosOpen, setCostosOpen] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Reset form when dialog opens or actividad changes
  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(actividad))
      setErrors({})
      setApiError(null)
      setSaving(false)
      setCostosOpen(false)
      setFocusedField(null)
    }
  }, [open, actividad])

  if (!open) return null

  const isEdit = actividad !== undefined
  const title = isEdit ? "Editar actividad" : "Nueva actividad"

  function setField(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleTextChange(field: keyof FormState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setField(field, e.target.value)
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {}

    if (!form.nombre.trim()) newErrors.nombre = "Requerido"
    if (!form.subproyectoId) newErrors.subproyectoId = "Requerido"
    if (!form.responsableId) newErrors.responsableId = "Requerido"
    if (!form.fechaInicio) newErrors.fechaInicio = "Requerido"
    if (!form.fechaFin) newErrors.fechaFin = "Requerido"
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
      newErrors.fechaFin = "Debe ser igual o posterior a Fecha Inicio"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setApiError(null)
    setSaving(true)

    const payload: HelixActividadCreate = {
      subproyectoId: Number(form.subproyectoId),
      responsableId: Number(form.responsableId),
      nombre: form.nombre.trim(),
      estado: form.estado,
      prioridad: form.prioridad,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      avance: Number(form.avance),
      puntos: Number(form.puntos),
      bloqueada: form.bloqueada,
    }

    if (form.costoInversion !== "") payload.costoInversion = Number(form.costoInversion)
    if (form.costoOptimizacion !== "") payload.costoOptimizacion = Number(form.costoOptimizacion)
    if (form.costoEjecucion !== "") payload.costoEjecucion = Number(form.costoEjecucion)

    try {
      if (isEdit && actividad) {
        await updateActividad(actividad.id, payload)
      } else {
        await createActividad(payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar la actividad"
      setApiError(msg)
    } finally {
      setSaving(false)
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={cardStyle} role="dialog" aria-modal="true" aria-label={title}>
        {/* Header */}
        <div style={headerStyle}>
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--helix-ink, #121420)",
            }}
          >
            {title}
          </h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Cerrar" type="button">
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={bodyStyle}>
            {apiError && <div style={errorStyle}>{apiError}</div>}

            {/* Nombre */}
            <div style={fieldGroupStyle}>
              <label htmlFor="td-nombre" style={labelStyle}>Nombre *</label>
              <input
                id="td-nombre"
                style={{
                  ...inputStyle,
                  borderColor: errors.nombre ? "var(--helix-danger, #ef3340)" : undefined,
                  ...focusStyle(focusedField === "nombre"),
                }}
                type="text"
                value={form.nombre}
                onChange={handleTextChange("nombre")}
                placeholder="Nombre de la actividad"
                autoFocus
                onFocus={() => setFocusedField("nombre")}
                onBlur={() => setFocusedField(null)}
              />
              {errors.nombre && (
                <span style={{ fontSize: "11px", color: "var(--helix-danger, #ef3340)" }}>
                  {errors.nombre}
                </span>
              )}
            </div>

            {/* Subproyecto + Responsable */}
            <div style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label htmlFor="td-subproyecto" style={labelStyle}>Subproyecto *</label>
                <select
                  id="td-subproyecto"
                  style={{
                    ...inputStyle,
                    borderColor: errors.subproyectoId ? "var(--helix-danger, #ef3340)" : undefined,
                    ...focusStyle(focusedField === "subproyecto"),
                  }}
                  value={form.subproyectoId}
                  onChange={handleTextChange("subproyectoId")}
                  onFocus={() => setFocusedField("subproyecto")}
                  onBlur={() => setFocusedField(null)}
                >
                  <option value="">Seleccionar...</option>
                  {subproyectos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {errors.subproyectoId && (
                  <span style={{ fontSize: "11px", color: "var(--helix-danger, #ef3340)" }}>
                    {errors.subproyectoId}
                  </span>
                )}
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-responsable" style={labelStyle}>Responsable *</label>
                <select
                  id="td-responsable"
                  style={{
                    ...inputStyle,
                    borderColor: errors.responsableId ? "var(--helix-danger, #ef3340)" : undefined,
                    ...focusStyle(focusedField === "responsable"),
                  }}
                  value={form.responsableId}
                  onChange={handleTextChange("responsableId")}
                  onFocus={() => setFocusedField("responsable")}
                  onBlur={() => setFocusedField(null)}
                >
                  <option value="">Seleccionar...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
                {errors.responsableId && (
                  <span style={{ fontSize: "11px", color: "var(--helix-danger, #ef3340)" }}>
                    {errors.responsableId}
                  </span>
                )}
              </div>
            </div>

            {/* Prioridad + Estado */}
            <div style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label htmlFor="td-prioridad" style={labelStyle}>Prioridad</label>
                <select
                  id="td-prioridad"
                  style={{
                    ...inputStyle,
                    ...focusStyle(focusedField === "prioridad"),
                  }}
                  value={form.prioridad}
                  onChange={handleTextChange("prioridad")}
                  onFocus={() => setFocusedField("prioridad")}
                  onBlur={() => setFocusedField(null)}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-estado" style={labelStyle}>Estado</label>
                <select
                  id="td-estado"
                  style={{
                    ...inputStyle,
                    ...focusStyle(focusedField === "estado"),
                  }}
                  value={form.estado}
                  onChange={handleTextChange("estado")}
                  onFocus={() => setFocusedField("estado")}
                  onBlur={() => setFocusedField(null)}
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fechas */}
            <div style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label htmlFor="td-fecha-inicio" style={labelStyle}>Fecha Inicio *</label>
                <input
                  id="td-fecha-inicio"
                  style={{
                    ...inputStyle,
                    borderColor: errors.fechaInicio ? "var(--helix-danger, #ef3340)" : undefined,
                    ...focusStyle(focusedField === "fechaInicio"),
                  }}
                  type="date"
                  value={form.fechaInicio}
                  onChange={handleTextChange("fechaInicio")}
                  onFocus={() => setFocusedField("fechaInicio")}
                  onBlur={() => setFocusedField(null)}
                />
                {errors.fechaInicio && (
                  <span style={{ fontSize: "11px", color: "var(--helix-danger, #ef3340)" }}>
                    {errors.fechaInicio}
                  </span>
                )}
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-fecha-fin" style={labelStyle}>Fecha Fin *</label>
                <input
                  id="td-fecha-fin"
                  style={{
                    ...inputStyle,
                    borderColor: errors.fechaFin ? "var(--helix-danger, #ef3340)" : undefined,
                    ...focusStyle(focusedField === "fechaFin"),
                  }}
                  type="date"
                  value={form.fechaFin}
                  onChange={handleTextChange("fechaFin")}
                  min={form.fechaInicio}
                  onFocus={() => setFocusedField("fechaFin")}
                  onBlur={() => setFocusedField(null)}
                />
                {errors.fechaFin && (
                  <span style={{ fontSize: "11px", color: "var(--helix-danger, #ef3340)" }}>
                    {errors.fechaFin}
                  </span>
                )}
              </div>
            </div>

            {/* Avance + Puntos */}
            <div style={rowStyle}>
              <div style={fieldGroupStyle}>
                <label htmlFor="td-avance" style={labelStyle}>Avance (%)</label>
                <input
                  id="td-avance"
                  style={{
                    ...inputStyle,
                    ...focusStyle(focusedField === "avance"),
                  }}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.avance}
                  onChange={handleTextChange("avance")}
                  onFocus={() => setFocusedField("avance")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-puntos" style={labelStyle}>Puntos</label>
                <input
                  id="td-puntos"
                  style={{
                    ...inputStyle,
                    ...focusStyle(focusedField === "puntos"),
                  }}
                  type="number"
                  min={0}
                  step={1}
                  value={form.puntos}
                  onChange={handleTextChange("puntos")}
                  onFocus={() => setFocusedField("puntos")}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Bloqueada */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="bloqueada-check"
                type="checkbox"
                checked={form.bloqueada}
                onChange={(e) => setField("bloqueada", e.target.checked)}
                style={{ width: "14px", height: "14px", accentColor: "var(--helix-accent, #ef3340)", cursor: "pointer" }}
              />
              <label
                htmlFor="bloqueada-check"
                style={{ fontSize: "13px", color: "var(--helix-ink, #121420)", cursor: "pointer" }}
              >
                Actividad bloqueada
              </label>
            </div>

            {/* Costos (collapsible) */}
            <div>
              <button
                type="button"
                style={sectionToggleStyle}
                onClick={() => setCostosOpen((v) => !v)}
              >
                <span>{costosOpen ? "▾" : "▸"}</span>
                Costos (opcional)
              </button>

              {costosOpen && (
                <div style={{ ...rowStyle, marginTop: "10px", gridTemplateColumns: "1fr 1fr 1fr" }}>
                  <div style={fieldGroupStyle}>
                    <label htmlFor="td-costo-inversion" style={labelStyle}>Inversión</label>
                    <input
                      id="td-costo-inversion"
                      style={{
                        ...inputStyle,
                        ...focusStyle(focusedField === "costoInversion"),
                      }}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={form.costoInversion}
                      onChange={handleTextChange("costoInversion")}
                      onFocus={() => setFocusedField("costoInversion")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                  <div style={fieldGroupStyle}>
                    <label htmlFor="td-costo-optimizacion" style={labelStyle}>Optimización</label>
                    <input
                      id="td-costo-optimizacion"
                      style={{
                        ...inputStyle,
                        ...focusStyle(focusedField === "costoOptimizacion"),
                      }}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={form.costoOptimizacion}
                      onChange={handleTextChange("costoOptimizacion")}
                      onFocus={() => setFocusedField("costoOptimizacion")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                  <div style={fieldGroupStyle}>
                    <label htmlFor="td-costo-ejecucion" style={labelStyle}>Ejecución</label>
                    <input
                      id="td-costo-ejecucion"
                      style={{
                        ...inputStyle,
                        ...focusStyle(focusedField === "costoEjecucion"),
                      }}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={form.costoEjecucion}
                      onChange={handleTextChange("costoEjecucion")}
                      onFocus={() => setFocusedField("costoEjecucion")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <button type="button" style={cancelBtnStyle} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              style={saving ? saveBtnDisabledStyle : saveBtnStyle}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
