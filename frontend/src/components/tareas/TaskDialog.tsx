import { useState, useEffect } from "react"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { useCreateTask, useUpdateTask, useAcceptTask } from "@/hooks/useTasks"
import { useTaskAISuggestions } from "@/hooks/useTaskAI"
import { useUploadTaskV2Attachment } from "@/hooks/useTaskV2Attachments"
import { useTaskToast } from "./TaskToast"
import { useAuthStore } from "@/store/authStore"
import type { Task, CreateTaskInput, UpdateTaskInput } from "@/types/task"
import { AttachmentExplorerV2 } from "./AttachmentExplorerV2"

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

function formatMin(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

interface TaskDialogProps {
  open: boolean
  teamId: number | null
  task?: Task | null
  onClose: () => void
}

export function TaskDialog({ open, teamId, task, onClose }: TaskDialogProps) {
  const { data: lists } = useTaskLists(teamId)
  const { data: members = [] } = useTeamMembers(teamId)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const acceptTask = useAcceptTask()
  const uploadAttachment = useUploadTaskV2Attachment()
  const { showToast } = useTaskToast()
  const { user } = useAuthStore()

  const isEdit = !!task
  // Task is assigned to the current user and pending acceptance
  const isAssignedToMe = isEdit && task && user && task.asignadoAId === user.id
  const isPendingAcceptance = isAssignedToMe && task?.aceptacion === "pendiente"

  const [adjuntosOpen, setAdjuntosOpen] = useState(false)
  // Archivos elegidos mientras se crea la tarea (aún no hay taskId) — se suben al guardar
  const [stagedFiles, setStagedFiles] = useState<File[]>([])

  const [form, setForm] = useState({
    titulo: "",
    descripcionTecnica: "",
    etiqueta: "",
    plataforma: "",
    estado: "",
    prioridad: "media",
    fecha: new Date().toISOString().slice(0, 10),
    horaInicio: "",
    horaFin: "",
    asignadoAId: "" as string | number,
    modalidad: "",
    duracionEstimadaMinutos: "" as string | number,
  })

  const { suggestions } = useTaskAISuggestions(form.titulo)

  // Pre-fill on edit, or reset on open for create
  useEffect(() => {
    if (!open) return
    setStagedFiles([])
    setAdjuntosOpen(false)
    if (task) {
      setForm({
        titulo: task.titulo,
        descripcionTecnica: task.descripcionTecnica ?? "",
        etiqueta: task.etiqueta,
        plataforma: task.plataforma,
        estado: task.estado,
        prioridad: task.prioridad,
        fecha: task.fecha.slice(0, 10),
        horaInicio: task.horaInicio ? task.horaInicio.slice(11, 16) : "",
        horaFin: task.horaCierre ? task.horaCierre.slice(11, 16) : "",
        asignadoAId: task.asignadoAId ?? "",
        modalidad: task.modalidad ?? "",
        duracionEstimadaMinutos: task.duracionEstimadaMinutos ?? "",
      })
    } else {
      setForm({
        titulo: "",
        descripcionTecnica: "",
        etiqueta: "",
        plataforma: "",
        estado: "",
        prioridad: "media",
        fecha: new Date().toISOString().slice(0, 10),
        horaInicio: "",
        horaFin: "",
        asignadoAId: "",
        modalidad: "",
        duracionEstimadaMinutos: "",
      })
    }
  }, [open, task])

  if (!open) return null

  const estados = lists?.estado ?? []
  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []
  const modalidades = lists?.modalidad ?? []
  const prioridades = lists?.prioridad ?? []

  const LABEL_STYLE = { fontSize: 11, fontWeight: 700, color: "#5c6374", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }
  const INPUT_STYLE = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d8dde8", fontSize: 13, boxSizing: "border-box" as const }

  function handleStageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const oversized = files.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (oversized) {
      showToast(`"${oversized.name}" supera el límite de 20 MB`, "error")
      e.target.value = ""
      return
    }
    setStagedFiles((prev) => [...prev, ...files])
    e.target.value = ""
  }

  async function handleSubmit() {
    if (!teamId || !form.titulo.trim()) {
      showToast("Completa el título y selecciona un equipo", "error")
      return
    }

    try {
      if (isEdit && task) {
        const input: UpdateTaskInput = {
          titulo: form.titulo,
          descripcionTecnica: form.descripcionTecnica || null,
          etiqueta: form.etiqueta,
          plataforma: form.plataforma,
          estado: form.estado,
          prioridad: form.prioridad,
          fecha: form.fecha,
          horaInicio: form.horaInicio ? `${form.fecha}T${form.horaInicio}:00` : null,
          horaCierre: form.horaFin ? `${form.fecha}T${form.horaFin}:00` : null,
          asignadoAId: form.asignadoAId ? Number(form.asignadoAId) : null,
          modalidad: form.modalidad || null,
          duracionEstimadaMinutos: form.duracionEstimadaMinutos ? Number(form.duracionEstimadaMinutos) : null,
          version: task.version,
        }
        await updateTask.mutateAsync({ taskId: task.id, input })
        showToast("Tarea actualizada", "success")
      } else {
        const input: CreateTaskInput = {
          teamId,
          titulo: form.titulo,
          descripcionTecnica: form.descripcionTecnica || undefined,
          etiqueta: form.etiqueta || etiquetas[0]?.value,
          plataforma: form.plataforma || plataformas[0]?.value,
          estado: form.estado || estados[0]?.value,
          prioridad: form.prioridad || prioridades[0]?.value,
          fecha: form.fecha,
          horaInicio: form.horaInicio ? `${form.fecha}T${form.horaInicio}:00` : undefined,
          horaCierre: form.horaFin ? `${form.fecha}T${form.horaFin}:00` : undefined,
          asignadoAId: form.asignadoAId ? Number(form.asignadoAId) : undefined,
          modalidad: form.modalidad || undefined,
          duracionEstimadaMinutos: form.duracionEstimadaMinutos ? Number(form.duracionEstimadaMinutos) : null,
        }
        const created = await createTask.mutateAsync(input)
        if (stagedFiles.length > 0) {
          try {
            for (const file of stagedFiles) {
              await uploadAttachment.mutateAsync({ taskId: created.id, file })
            }
            showToast("Tarea creada con adjuntos", "success")
          } catch {
            showToast("Tarea creada, pero un adjunto falló al subir. Ábrela y vuelve a intentar.", "error")
          }
        } else {
          showToast("Tarea creada", "success")
        }
      }
      onClose()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status
      if (status === 409) {
        showToast("La tarea fue modificada por otra sesión. Recarga la página.", "error")
      } else {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        showToast(msg ?? "Error al guardar la tarea", "error")
      }
    }
  }

  const isPending = createTask.isPending || updateTask.isPending

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        width: "min(600px, 95vw)",
        maxHeight: "90vh",
        overflow: "auto",
        padding: 28,
        boxShadow: "0 24px 60px rgba(18,20,32,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#121420" }}>
            {isEdit ? "Editar tarea" : "Nueva tarea"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, color: "#9aa5b8", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Título */}
          <div>
            <div style={LABEL_STYLE}>Título *</div>
            <input
              style={INPUT_STYLE}
              placeholder="Título de la tarea (mín. 3 caracteres)"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
            {/* AI suggestions */}
            {suggestions && "available" in suggestions && suggestions.available && (
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {suggestions.etiqueta_sugerida && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, etiqueta: suggestions.etiqueta_sugerida! }))}
                    style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#ede9fe", color: "#5b21b6", border: "none", cursor: "pointer" }}
                  >
                    IA: {suggestions.etiqueta_sugerida}
                  </button>
                )}
                {suggestions.plataforma_sugerida && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, plataforma: suggestions.plataforma_sugerida! }))}
                    style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#dbeafe", color: "#1e40af", border: "none", cursor: "pointer" }}
                  >
                    IA: {suggestions.plataforma_sugerida}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <div style={LABEL_STYLE}>Descripción técnica</div>
            <textarea
              style={{ ...INPUT_STYLE, minHeight: 80, resize: "vertical" }}
              placeholder="Descripción técnica de la tarea…"
              value={form.descripcionTecnica}
              onChange={(e) => setForm((f) => ({ ...f, descripcionTecnica: e.target.value }))}
            />
          </div>

          {/* Row: etiqueta + plataforma */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={LABEL_STYLE}>Etiqueta</div>
              <select
                style={INPUT_STYLE}
                value={form.etiqueta}
                onChange={(e) => setForm((f) => ({ ...f, etiqueta: e.target.value }))}
              >
                <option value="">Seleccionar…</option>
                {etiquetas.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <div style={LABEL_STYLE}>Plataforma</div>
              <select
                style={INPUT_STYLE}
                value={form.plataforma}
                onChange={(e) => setForm((f) => ({ ...f, plataforma: e.target.value }))}
              >
                <option value="">Seleccionar…</option>
                {plataformas.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: estado + prioridad */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={LABEL_STYLE}>Estado</div>
              <select
                style={INPUT_STYLE}
                value={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">Seleccionar…</option>
                {estados.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <div style={LABEL_STYLE}>Prioridad</div>
              <select
                style={INPUT_STYLE}
                value={form.prioridad}
                onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
              >
                <option value="">Seleccionar…</option>
                {prioridades.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: fecha + asignado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={LABEL_STYLE}>Fecha *</div>
              <input
                type="date"
                style={INPUT_STYLE}
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div>
              <div style={LABEL_STYLE}>Asignado a</div>
              <select
                style={INPUT_STYLE}
                value={form.asignadoAId}
                onChange={(e) => setForm((f) => ({ ...f, asignadoAId: e.target.value }))}
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.userNombre ?? `Usuario ${m.userId}`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: hora inicio + hora fin */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={LABEL_STYLE}>Hora inicio</div>
              <input
                type="time"
                style={INPUT_STYLE}
                value={form.horaInicio}
                onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))}
              />
            </div>
            <div>
              <div style={LABEL_STYLE}>Hora fin</div>
              <input
                type="time"
                style={INPUT_STYLE}
                value={form.horaFin}
                onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))}
              />
            </div>
          </div>

          {/* Modalidad */}
          {modalidades.length > 0 && (
            <div>
              <div style={LABEL_STYLE}>Modalidad</div>
              <select
                style={INPUT_STYLE}
                value={form.modalidad}
                onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))}
              >
                <option value="">Sin modalidad</option>
                {modalidades.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Tiempo real registrado */}
        {isEdit && task && task.tiempoTotalMinutos != null && (
          <div style={{
            marginTop: 18,
            padding: "12px 16px",
            borderRadius: 8,
            background: "#f8f9fd",
            border: "1px solid #e8ebf4",
            display: "flex",
            gap: 24,
            alignItems: "center",
            fontSize: 13,
            color: "#3f4652",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#9aa5b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tiempo real</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#121420" }}>{formatMin(task.tiempoTotalMinutos)}</span>
            </div>
          </div>
        )}

        {/* Aceptar / rechazar tarea asignada */}
        {isPendingAcceptance && task && (
          <div style={{
            marginTop: 18,
            padding: "12px 16px",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fbbf24",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div style={{ fontSize: 13, color: "#92400e", fontWeight: 500 }}>
              Esta tarea te fue asignada. ¿La aceptas?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await acceptTask.mutateAsync({ taskId: task.id, aceptacion: "rechazada" })
                  showToast("Tarea rechazada", "error")
                  onClose()
                }}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#ef4444", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
              >
                Rechazar
              </button>
              <button
                onClick={async () => {
                  await acceptTask.mutateAsync({ taskId: task.id, aceptacion: "aceptada" })
                  showToast("Tarea aceptada", "success")
                }}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* Estado de aceptación si ya fue procesada */}
        {isEdit && task && task.aceptacion !== "pendiente" && task.asignadoAId && (
          <div style={{
            marginTop: 12,
            padding: "6px 12px",
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            background: task.aceptacion === "aceptada" ? "#d1fae5" : "#fee2e2",
            color: task.aceptacion === "aceptada" ? "#065f46" : "#991b1b",
          }}>
            {task.aceptacion === "aceptada" ? "✓ Aceptada por el responsable" : "✗ Rechazada por el responsable"}
          </div>
        )}

        {/* Adjuntos elegidos antes de guardar (solo creación) */}
        {!isEdit && stagedFiles.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {stagedFiles.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "#f4f6fa",
                  border: "1px solid #e8ebf4",
                  fontSize: 12,
                  color: "#3f4652",
                }}
              >
                📎 {file.name}
                <button
                  onClick={() => setStagedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ border: "none", background: "none", color: "#9aa5b8", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                  aria-label={`Quitar ${file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24, alignItems: "center" }}>
          {isEdit && task ? (
            <button
              onClick={() => setAdjuntosOpen(true)}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "1px solid #d8dde8",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#3f4652",
                marginRight: "auto",
              }}
            >
              📎 Adjuntos
            </button>
          ) : (
            <label
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "1px solid #d8dde8",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#3f4652",
                marginRight: "auto",
              }}
            >
              📎 Adjuntos{stagedFiles.length > 0 ? ` (${stagedFiles.length})` : ""}
              <input type="file" multiple onChange={handleStageFiles} style={{ display: "none" }} />
            </label>
          )}
          <button
            onClick={onClose}
            style={{ padding: "9px 22px", borderRadius: 8, border: "1px solid #d8dde8", background: "#fff", fontSize: 13, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || form.titulo.trim().length < 3}
            style={{
              padding: "9px 22px",
              borderRadius: 8,
              border: "none",
              background: form.titulo.trim().length < 3 ? "#f0f2f7" : "#ef3340",
              color: form.titulo.trim().length < 3 ? "#9aa5b8" : "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: form.titulo.trim().length < 3 ? "default" : "pointer",
            }}
          >
            {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tarea"}
          </button>
        </div>
      </div>

      {isEdit && task && adjuntosOpen && (
        <AttachmentExplorerV2
          taskId={task.id}
          taskTitulo={task.titulo}
          open={adjuntosOpen}
          onClose={() => setAdjuntosOpen(false)}
        />
      )}
    </div>
  )
}
