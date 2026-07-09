import { useState, useEffect } from "react"
import { Paperclip } from "lucide-react"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { useCreateTask, useUpdateTask, useAcceptTask } from "@/hooks/useTasks"
import { useTaskAISuggestions } from "@/hooks/useTaskAI"
import { useUploadTaskV2Attachment } from "@/hooks/useTaskV2Attachments"
import { useTaskToast } from "./TaskToast"
import { useAuthStore } from "@/store/authStore"
import type { Task, CreateTaskInput, UpdateTaskInput } from "@/types/task"
import { AttachmentExplorerV2 } from "./AttachmentExplorerV2"
import { StagedAttachmentsPortal } from "./StagedAttachmentsPortal"
import { FormSelect } from "./FormSelect"

function formatMin(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"
const INPUT =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-zinc-400"

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
  const isAssignedToMe = isEdit && task && user && task.asignadoAId === user.id
  const isPendingAcceptance = isAssignedToMe && task?.aceptacion === "pendiente"

  const [adjuntosOpen, setAdjuntosOpen] = useState(false)
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

  const toOpts = (arr: { value: string; label: string }[]) =>
    arr.map((o) => ({ value: o.value, label: o.label }))

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
  const canSave = form.titulo.trim().length >= 3

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="w-[min(600px,95vw)] max-h-[90vh] overflow-auto rounded-xl border border-zinc-200 bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="m-0 text-[17px] font-bold text-zinc-900">
            {isEdit ? "Editar tarea" : "Nueva tarea"}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-zinc-400 transition hover:text-zinc-700"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Título */}
          <div>
            <div className={LABEL}>Título *</div>
            <input
              className={INPUT}
              placeholder="Título de la tarea (mín. 3 caracteres)"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
            {/* AI suggestions */}
            {suggestions && "available" in suggestions && suggestions.available && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.etiqueta_sugerida && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, etiqueta: suggestions.etiqueta_sugerida! }))}
                    className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    IA: {suggestions.etiqueta_sugerida}
                  </button>
                )}
                {suggestions.plataforma_sugerida && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, plataforma: suggestions.plataforma_sugerida! }))}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-100"
                  >
                    IA: {suggestions.plataforma_sugerida}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <div className={LABEL}>Descripción técnica</div>
            <textarea
              className={`${INPUT} min-h-[80px] resize-y`}
              placeholder="Descripción técnica de la tarea…"
              value={form.descripcionTecnica}
              onChange={(e) => setForm((f) => ({ ...f, descripcionTecnica: e.target.value }))}
            />
          </div>

          {/* Row: etiqueta + plataforma */}
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Etiqueta" value={form.etiqueta} onChange={(v) => setForm((f) => ({ ...f, etiqueta: v }))} options={toOpts(etiquetas)} />
            <FormSelect label="Plataforma" value={form.plataforma} onChange={(v) => setForm((f) => ({ ...f, plataforma: v }))} options={toOpts(plataformas)} />
          </div>

          {/* Row: estado + prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Estado" value={form.estado} onChange={(v) => setForm((f) => ({ ...f, estado: v }))} options={toOpts(estados)} />
            <FormSelect label="Prioridad" value={form.prioridad} onChange={(v) => setForm((f) => ({ ...f, prioridad: v }))} options={toOpts(prioridades)} />
          </div>

          {/* Row: fecha + asignado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={LABEL}>Fecha *</div>
              <input
                type="date"
                className={INPUT}
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <FormSelect
              label="Asignado a"
              value={String(form.asignadoAId ?? "")}
              onChange={(v) => setForm((f) => ({ ...f, asignadoAId: v }))}
              options={members.map((m) => ({ value: String(m.userId), label: m.userNombre ?? `Usuario ${m.userId}` }))}
              noneLabel="Sin asignar"
            />
          </div>

          {/* Row: hora inicio + hora fin */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={LABEL}>Hora inicio</div>
              <input
                type="time"
                className={INPUT}
                value={form.horaInicio}
                onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))}
              />
            </div>
            <div>
              <div className={LABEL}>Hora fin</div>
              <input
                type="time"
                className={INPUT}
                value={form.horaFin}
                onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))}
              />
            </div>
          </div>

          {/* Modalidad */}
          {modalidades.length > 0 && (
            <FormSelect
              label="Modalidad"
              value={form.modalidad}
              onChange={(v) => setForm((f) => ({ ...f, modalidad: v }))}
              options={toOpts(modalidades)}
              noneLabel="Sin modalidad"
            />
          )}
        </div>

        {/* Tiempo real registrado */}
        {isEdit && task && task.tiempoTotalMinutos != null && (
          <div className="mt-4 flex items-center gap-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-zinc-500">Tiempo real</span>
              <span className="font-mono text-[15px] font-bold text-zinc-900">{formatMin(task.tiempoTotalMinutos)}</span>
            </div>
          </div>
        )}

        {/* Aceptar / rechazar tarea asignada */}
        {isPendingAcceptance && task && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[13px] font-medium text-zinc-700">
              Esta tarea te fue asignada. ¿La aceptas?
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await acceptTask.mutateAsync({ taskId: task.id, aceptacion: "rechazada" })
                  showToast("Tarea rechazada", "error")
                  onClose()
                }}
                className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
              >
                Rechazar
              </button>
              <button
                onClick={async () => {
                  await acceptTask.mutateAsync({ taskId: task.id, aceptacion: "aceptada" })
                  showToast("Tarea aceptada", "success")
                }}
                className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition hover:brightness-95"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* Estado de aceptación si ya fue procesada */}
        {isEdit && task && task.aceptacion !== "pendiente" && task.asignadoAId && (
          <div
            className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-bold ${
              task.aceptacion === "aceptada"
                ? "bg-primary/10 text-primary"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {task.aceptacion === "aceptada" ? "✓ Aceptada por el responsable" : "✗ Rechazada por el responsable"}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={() => setAdjuntosOpen(true)}
            className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <Paperclip size={15} /> Adjuntos{!isEdit && stagedFiles.length > 0 ? ` (${stagedFiles.length})` : ""}
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-5 py-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !canSave}
            className="rounded-md bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:cursor-default disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
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

      {!isEdit && adjuntosOpen && (
        <StagedAttachmentsPortal
          files={stagedFiles}
          onChange={setStagedFiles}
          taskTitulo={form.titulo}
          open={adjuntosOpen}
          onClose={() => setAdjuntosOpen(false)}
        />
      )}
    </div>
  )
}
