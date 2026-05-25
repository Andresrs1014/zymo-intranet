import { useState, useEffect, useRef, type CSSProperties, type FormEvent, type ChangeEvent } from "react"
import { z } from "zod"
import type { HelixActividad, HelixEvidencia } from "@/types/helix"
import type { HelixActividadCreate } from "@/hooks/useHelixActividades"
import { useHelixSubproyectos } from "@/hooks/useHelixSubproyectos"
import { useHelixUsuarios } from "@/hooks/useHelixUsuarios"
import { helixApi } from "@/lib/helixApi"
import { useHelixToast } from "../HelixToast"

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

const TaskSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  subproyectoId: z.string().min(1, "Selecciona un subproyecto"),
  responsableId: z.string().min(1, "Selecciona un responsable"),
  prioridad: z.enum(["Alta", "Media", "Baja"]),
  estado: z.enum(["Backlog", "Planificado", "En curso", "Revision", "Terminado"]),
  fechaInicio: z.string().min(1, "Fecha de inicio requerida"),
  fechaFin: z.string().min(1, "Fecha de fin requerida"),
  avance: z.string().refine((v) => {
    const n = parseInt(v, 10)
    return !isNaN(n) && n >= 0 && n <= 100
  }, "Entre 0 y 100"),
  puntos: z.string().refine((v) => parseInt(v, 10) > 0, "Debe ser positivo"),
})

type TaskSchemaFields = z.infer<typeof TaskSchema>
type FieldErrors = Partial<Record<keyof TaskSchemaFields, string>>

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const BACKEND_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_HELIX_API_URL ?? "http://localhost:3001"
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

function isImageFile(nombre: string): boolean {
  const ext = nombre.toLowerCase().slice(nombre.lastIndexOf("."))
  return IMAGE_EXTS.includes(ext)
}

// ---- Styles ----
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

const fieldErrorStyle: CSSProperties = {
  fontSize: "11px",
  color: "var(--helix-danger, #ef3340)",
}

const FOCUS_OUTLINE = "2px solid var(--helix-accent, #ef3340)"

function focusStyle(focused: boolean): CSSProperties {
  return focused ? { outline: FOCUS_OUTLINE, outlineOffset: "-1px", borderColor: "var(--helix-accent, #ef3340)" } : {}
}

export function TaskDialog({ open, onClose, actividad, onSaved, createActividad, updateActividad }: TaskDialogProps) {
  const { subproyectos } = useHelixSubproyectos()
  const { usuarios } = useHelixUsuarios()
  const { showToast } = useHelixToast()

  const [form, setForm] = useState<FormState>(() => buildInitialForm(actividad))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [costosOpen, setCostosOpen] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Evidencias state
  const [evidencias, setEvidencias] = useState<HelixEvidencia[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const isEdit = actividad !== undefined

  // Reset form when dialog opens or actividad changes
  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(actividad))
      setFieldErrors({})
      setApiError(null)
      setSaving(false)
      setCostosOpen(false)
      setFocusedField(null)
      setEvidencias(actividad?.evidencias ?? [])
      setUploadProgress(null)
      setSelectedFile(null)
    }
  }, [open, actividad])

  if (!open) return null

  const title = isEdit ? "Editar actividad" : "Nueva actividad"

  function setField(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleTextChange(field: keyof FormState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setField(field, e.target.value)
    }
  }

  function validate(): boolean {
    const parsed = TaskSchema.safeParse({
      nombre: form.nombre,
      subproyectoId: form.subproyectoId,
      responsableId: form.responsableId,
      prioridad: form.prioridad,
      estado: form.estado,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      avance: form.avance,
      puntos: form.puntos,
    })

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      const errs: FieldErrors = {}
      for (const [k, v] of Object.entries(flat)) {
        if (v && v.length > 0) {
          errs[k as keyof TaskSchemaFields] = v[0]
        }
      }
      // Extra cross-field validation for date ordering
      if (!errs.fechaFin && form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
        errs.fechaFin = "Debe ser igual o posterior a Fecha Inicio"
      }
      setFieldErrors(errs)
      return false
    }

    // Cross-field check when base schema passes
    if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
      setFieldErrors({ fechaFin: "Debe ser igual o posterior a Fecha Inicio" })
      return false
    }

    setFieldErrors({})
    return true
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

  // ---- Evidencias handlers ----
  async function handleUpload() {
    if (!selectedFile || !actividad) return
    // -1 signals indeterminate (no fake %)
    setUploadProgress(-1)

    try {
      const fd = new FormData()
      fd.append("archivo", selectedFile)
      const res = await helixApi.post<HelixEvidencia>(`/api/actividades/${actividad.id}/evidencias`, fd, {
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
          }
        },
      })
      setUploadProgress(100)
      setTimeout(() => setUploadProgress(null), 600)
      setEvidencias((prev) => [...prev, res.data])
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      showToast("Evidencia subida correctamente", "success")
    } catch {
      setUploadProgress(null)
      showToast("Error al subir la evidencia", "error")
    }
  }

  async function handleDeleteEvidencia(evidenciaId: number) {
    if (!actividad) return
    try {
      await helixApi.delete(`/api/actividades/${actividad.id}/evidencias/${evidenciaId}`)
      setEvidencias((prev) => prev.filter((e) => e.id !== evidenciaId))
      showToast("Evidencia eliminada", "info")
    } catch {
      showToast("Error al eliminar la evidencia", "error")
    }
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
                  borderColor: fieldErrors.nombre ? "var(--helix-danger, #ef3340)" : undefined,
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
              {fieldErrors.nombre && (
                <span style={fieldErrorStyle}>{fieldErrors.nombre}</span>
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
                    borderColor: fieldErrors.subproyectoId ? "var(--helix-danger, #ef3340)" : undefined,
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
                {fieldErrors.subproyectoId && (
                  <span style={fieldErrorStyle}>{fieldErrors.subproyectoId}</span>
                )}
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-responsable" style={labelStyle}>Responsable *</label>
                <select
                  id="td-responsable"
                  style={{
                    ...inputStyle,
                    borderColor: fieldErrors.responsableId ? "var(--helix-danger, #ef3340)" : undefined,
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
                {fieldErrors.responsableId && (
                  <span style={fieldErrorStyle}>{fieldErrors.responsableId}</span>
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
                    borderColor: fieldErrors.fechaInicio ? "var(--helix-danger, #ef3340)" : undefined,
                    ...focusStyle(focusedField === "fechaInicio"),
                  }}
                  type="date"
                  value={form.fechaInicio}
                  onChange={handleTextChange("fechaInicio")}
                  onFocus={() => setFocusedField("fechaInicio")}
                  onBlur={() => setFocusedField(null)}
                />
                {fieldErrors.fechaInicio && (
                  <span style={fieldErrorStyle}>{fieldErrors.fechaInicio}</span>
                )}
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-fecha-fin" style={labelStyle}>Fecha Fin *</label>
                <input
                  id="td-fecha-fin"
                  style={{
                    ...inputStyle,
                    borderColor: fieldErrors.fechaFin ? "var(--helix-danger, #ef3340)" : undefined,
                    ...focusStyle(focusedField === "fechaFin"),
                  }}
                  type="date"
                  value={form.fechaFin}
                  onChange={handleTextChange("fechaFin")}
                  min={form.fechaInicio}
                  onFocus={() => setFocusedField("fechaFin")}
                  onBlur={() => setFocusedField(null)}
                />
                {fieldErrors.fechaFin && (
                  <span style={fieldErrorStyle}>{fieldErrors.fechaFin}</span>
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
                    borderColor: fieldErrors.avance ? "var(--helix-danger, #ef3340)" : undefined,
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
                {fieldErrors.avance && (
                  <span style={fieldErrorStyle}>{fieldErrors.avance}</span>
                )}
              </div>

              <div style={fieldGroupStyle}>
                <label htmlFor="td-puntos" style={labelStyle}>Puntos</label>
                <input
                  id="td-puntos"
                  style={{
                    ...inputStyle,
                    borderColor: fieldErrors.puntos ? "var(--helix-danger, #ef3340)" : undefined,
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
                {fieldErrors.puntos && (
                  <span style={fieldErrorStyle}>{fieldErrors.puntos}</span>
                )}
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

            {/* Evidencias — only when editing */}
            {isEdit && (
              <div style={{ borderTop: "1px solid var(--helix-line, #d8dde8)", paddingTop: 14 }}>
                <div style={{ ...labelStyle, marginBottom: 10, display: "block" }}>Evidencias</div>

                {/* Existing evidencias list */}
                {evidencias.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {evidencias.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          background: "var(--helix-surface-2, #eef1f6)",
                          borderRadius: 6,
                          border: "1px solid var(--helix-line, #d8dde8)",
                        }}
                      >
                        {isImageFile(ev.nombre) && (
                          <img
                            src={`${BACKEND_URL}/uploads/${ev.ruta}`}
                            alt={ev.nombre}
                            style={{
                              width: 32,
                              height: 32,
                              objectFit: "cover",
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--helix-ink, #121420)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ev.nombre}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--helix-muted, #5c6374)" }}>
                            {formatFileSize(ev.tamanio)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvidencia(ev.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--helix-muted, #5c6374)",
                            fontSize: 16,
                            padding: "2px 4px",
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          aria-label="Eliminar evidencia"
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload area */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
                    style={{ flex: 1, fontSize: 12 }}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadProgress !== null}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "1px solid var(--helix-line, #d8dde8)",
                      background: "var(--helix-surface, #ffffff)",
                      color: "var(--helix-ink, #121420)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: !selectedFile || uploadProgress !== null ? "not-allowed" : "pointer",
                      opacity: !selectedFile || uploadProgress !== null ? 0.55 : 1,
                      flexShrink: 0,
                    }}
                  >
                    Subir archivo
                  </button>
                </div>

                {/* Progress bar */}
                {uploadProgress !== null && (
                  <div
                    style={{
                      marginTop: 8,
                      height: 4,
                      background: "var(--helix-line, #d8dde8)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    {uploadProgress === -1 ? (
                      // Indeterminate — no total size reported
                      <div
                        style={{
                          height: "100%",
                          width: "40%",
                          background: "var(--helix-accent, #ef3340)",
                          borderRadius: 2,
                          animation: "helix-spin-progress 1.2s ease-in-out infinite",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          width: `${uploadProgress}%`,
                          background: "var(--helix-accent, #ef3340)",
                          transition: "width 120ms linear",
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
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
