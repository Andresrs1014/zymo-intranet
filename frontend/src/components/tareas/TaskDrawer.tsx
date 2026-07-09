import { useEffect, useMemo, useState } from "react"
import { X, Paperclip, Check, Ban, Loader2 } from "lucide-react"
import { useTask as useTaskQuery, useUpdateTask, useAcceptTask, useTaskHistory } from "@/hooks/useTasks"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { useAuthStore } from "@/store/authStore"
import { useTaskToast } from "./TaskToast"
import { AttachmentExplorerV2 } from "./AttachmentExplorerV2"
import { TaskStatusPill } from "./TaskStatusPill"
import { isOverdue } from "@/lib/taskWork"
import type { Task, UpdateTaskInput, ActivityAction, ListConfig } from "@/types/task"

function fmtMin(min: number | null | undefined): string {
  if (!min) return "—"
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const ACTION_LABEL: Record<ActivityAction, string> = {
  creacion: "Creó la tarea",
  cambio_estado: "Cambió el estado",
  edicion: "Editó la tarea",
  eliminacion: "Eliminó la tarea",
  asignacion: "Reasignó",
  adjunto_subido: "Subió un adjunto",
  adjunto_eliminado: "Eliminó un adjunto",
}

type DrawerTab = "detalle" | "actividad" | "adjuntos"

// ── Estilos de campo oscuros ──────────────────────────────────────────────────
const FIELD =
  "w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-[13px] text-zinc-100 " +
  "outline-none transition focus:border-[#ef3340]/60 focus:bg-white/[.06] placeholder:text-zinc-500"
const LABEL = "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.07em] text-zinc-500"

interface Props {
  task: Task | null
  onClose: () => void
}

export function TaskDrawer({ task, onClose }: Props) {
  const targetId = task?.id ?? null

  // Datos frescos: refleja aceptar/editar sin cerrar el drawer (el prop es un snapshot).
  const { data: liveTask } = useTaskQuery(targetId)
  const t = liveTask ?? task

  const teamId = t?.teamId ?? null
  const { data: lists } = useTaskLists(teamId)
  const { data: members = [] } = useTeamMembers(teamId)
  const { data: history = [], isLoading: historyLoading } = useTaskHistory(
    targetId,
  )

  const updateTask = useUpdateTask()
  const acceptTask = useAcceptTask()
  const { showToast } = useTaskToast()
  const { user } = useAuthStore()

  const [tab, setTab] = useState<DrawerTab>("detalle")
  const [adjuntosOpen, setAdjuntosOpen] = useState(false)
  const [form, setForm] = useState({
    titulo: "",
    descripcionTecnica: "",
    etiqueta: "",
    plataforma: "",
    estado: "",
    prioridad: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
    asignadoAId: "" as string | number,
    modalidad: "",
    duracionEstimadaMinutos: "" as string | number,
  })

  // Semilla del formulario solo cuando cambia la tarea objetivo (evita pisar la edición).
  useEffect(() => {
    if (!task) return
    setTab("detalle")
    setAdjuntosOpen(false)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  const estadoConfig: ListConfig | undefined = useMemo(
    () => lists?.estado?.find((e) => e.value === t?.estado),
    [lists, t?.estado],
  )
  const prioConfig = useMemo(
    () => lists?.prioridad?.find((p) => p.value === t?.prioridad),
    [lists, t?.prioridad],
  )

  if (!task || !t) return null

  const estados = lists?.estado ?? []
  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []
  const modalidades = lists?.modalidad ?? []
  const prioridades = lists?.prioridad ?? []

  const done = (estadoConfig?.isFinal ?? false) || (estadoConfig?.isCanceled ?? false)
  const vencida = !done && isOverdue(t)

  const isPendingForMe =
    !!user && t.asignadoAId === user.id && t.aceptacion === "pendiente"

  const est = t.duracionEstimadaMinutos ?? 0
  const real = t.tiempoTotalMinutos ?? 0
  const overrun = est > 0 && real > est
  const ratio = est > 0 ? Math.min(real / est, 1.5) : real > 0 ? 1.5 : 0

  async function handleAccept(aceptacion: "aceptada" | "rechazada") {
    if (!t) return
    try {
      await acceptTask.mutateAsync({ taskId: t.id, aceptacion })
      showToast(aceptacion === "aceptada" ? "Tarea aceptada" : "Tarea rechazada", aceptacion === "aceptada" ? "success" : "error")
      if (aceptacion === "rechazada") onClose()
    } catch {
      showToast("No se pudo registrar tu respuesta", "error")
    }
  }

  async function handleSave() {
    if (!t) return
    if (form.titulo.trim().length < 3) {
      showToast("El título debe tener al menos 3 caracteres", "error")
      return
    }
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
      duracionEstimadaMinutos: form.duracionEstimadaMinutos
        ? Number(form.duracionEstimadaMinutos)
        : null,
      version: t.version,
    }
    try {
      await updateTask.mutateAsync({ taskId: t.id, input })
      showToast("Cambios guardados", "success")
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        showToast("La tarea fue modificada por otra sesión. Recarga la página.", "error")
      } else {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        showToast(msg ?? "Error al guardar la tarea", "error")
      }
    }
  }

  const asignadoNombre = t.asignadoANombre ?? "Sin asignar"

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="relative flex h-full w-[460px] max-w-[96vw] flex-col border-l border-white/10 bg-[#161a22] text-zinc-100 shadow-2xl animate-in slide-in-from-right-8 fade-in duration-300"
        role="dialog"
        aria-label={`Detalle de tarea: ${t.titulo}`}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2">
              <TaskStatusPill
                estadoLabel={estadoConfig?.label ?? t.estado}
                estadoColor={estadoConfig?.color}
                aceptacion={t.aceptacion}
                vencida={vencida}
              />
            </div>
            <h2 className="text-[15px] font-bold leading-snug text-white">{t.titulo}</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {asignadoNombre} · asignada por {t.subidoPorNombre}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {prioConfig && (
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: `${prioConfig.color ?? "#8a94a6"}20`,
                  color: prioConfig.color ?? "#8a94a6",
                }}
              >
                {prioConfig.label}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Barra de aceptación fijada arriba */}
        {isPendingForMe && (
          <div className="flex items-center gap-2 border-b border-amber-400/20 bg-amber-400/10 px-6 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="mr-auto text-[13px] font-medium text-amber-200">
              Te asignaron esta tarea. ¿La aceptas?
            </span>
            <button
              onClick={() => handleAccept("rechazada")}
              disabled={acceptTask.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              <Ban size={13} /> Rechazar
            </button>
            <button
              onClick={() => handleAccept("aceptada")}
              disabled={acceptTask.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,.4)] transition hover:-translate-y-px active:translate-y-0 disabled:opacity-50"
            >
              {acceptTask.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Aceptar
            </button>
          </div>
        )}

        {/* Medidor Estimado vs Real */}
        <section className="border-b border-white/10 px-6 py-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-zinc-500">
              Estimado vs real
            </span>
            <span className="font-mono text-sm text-zinc-200">
              {fmtMin(real)} <span className="text-zinc-600">/ {fmtMin(est)}</span>
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${overrun ? "bg-[#ef3340]" : "bg-emerald-500"}`}
              style={{ width: `${(ratio / 1.5) * 100}%` }}
            />
            {est > 0 && (
              <span
                className="absolute top-0 h-full w-px bg-zinc-300/50"
                style={{ left: "66.6%" }}
                title="Estimado"
              />
            )}
          </div>
          {overrun && (
            <p className="mt-2 font-mono text-xs font-medium text-[#ff6b75]">
              +{fmtMin(real - est)} sobre lo estimado ({Math.round((real / est - 1) * 100)}%)
            </p>
          )}
          {!est && !real && (
            <p className="mt-2 text-xs text-zinc-500">Sin tiempo estimado ni registrado.</p>
          )}
        </section>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-white/10 px-4">
          {(["detalle", "actividad", "adjuntos"] as DrawerTab[]).map((key) => {
            const labels = { detalle: "Detalle", actividad: "Actividad", adjuntos: "Adjuntos" }
            const active = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-3 py-2.5 text-[13px] font-semibold transition ${active ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                {labels[key]}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#ef3340]" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Contenido de tab */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "detalle" && (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className={LABEL}>Título</label>
                <input
                  className={FIELD}
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL}>Descripción técnica</label>
                <textarea
                  className={`${FIELD} min-h-[72px] resize-y`}
                  value={form.descripcionTecnica}
                  onChange={(e) => setForm((f) => ({ ...f, descripcionTecnica: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Etiqueta</label>
                  <select className={FIELD} value={form.etiqueta} onChange={(e) => setForm((f) => ({ ...f, etiqueta: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {etiquetas.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Plataforma</label>
                  <select className={FIELD} value={form.plataforma} onChange={(e) => setForm((f) => ({ ...f, plataforma: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {plataformas.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Estado</label>
                  <select className={FIELD} value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {estados.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Prioridad</label>
                  <select className={FIELD} value={form.prioridad} onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {prioridades.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Fecha</label>
                  <input type="date" className={FIELD} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>Asignado a</label>
                  <select className={FIELD} value={form.asignadoAId} onChange={(e) => setForm((f) => ({ ...f, asignadoAId: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {members.map((m) => <option key={m.userId} value={m.userId}>{m.userNombre ?? `Usuario ${m.userId}`}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Hora inicio</label>
                  <input type="time" className={FIELD} value={form.horaInicio} onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>Hora fin</label>
                  <input type="time" className={FIELD} value={form.horaFin} onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>Est. (min)</label>
                  <input
                    type="number"
                    min={0}
                    className={`${FIELD} font-mono`}
                    value={form.duracionEstimadaMinutos}
                    onChange={(e) => setForm((f) => ({ ...f, duracionEstimadaMinutos: e.target.value }))}
                  />
                </div>
              </div>

              {modalidades.length > 0 && (
                <div>
                  <label className={LABEL}>Modalidad</label>
                  <select className={FIELD} value={form.modalidad} onChange={(e) => setForm((f) => ({ ...f, modalidad: e.target.value }))}>
                    <option value="">Sin modalidad</option>
                    {modalidades.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {tab === "actividad" && (
            <div className="flex flex-col gap-3">
              {historyLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                  <Loader2 size={15} className="animate-spin" /> Cargando actividad…
                </div>
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">Sin actividad registrada.</p>
              ) : (
                <ol className="relative flex flex-col gap-4 border-l border-white/10 pl-5">
                  {history.map((log) => (
                    <li key={log.id} className="relative">
                      <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#161a22] bg-[#ef3340]" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold text-zinc-100">
                          {ACTION_LABEL[log.accion] ?? log.accion}
                        </span>
                        <time className="shrink-0 font-mono text-[11px] text-zinc-500">
                          {new Date(log.fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </div>
                      <p className="text-xs text-zinc-400">{log.userNombre}</p>
                      {log.detalle && <p className="mt-0.5 text-xs text-zinc-500">{log.detalle}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab === "adjuntos" && (
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-sm text-zinc-400">
                {t.attachments?.length
                  ? `${t.attachments.length} archivo${t.attachments.length === 1 ? "" : "s"} adjunto${t.attachments.length === 1 ? "" : "s"}.`
                  : "Esta tarea aún no tiene adjuntos."}
              </p>
              <button
                onClick={() => setAdjuntosOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[.04] px-4 py-2 text-[13px] font-semibold text-zinc-100 transition hover:bg-white/[.08]"
              >
                <Paperclip size={15} /> Abrir explorador de adjuntos
              </button>
            </div>
          )}
        </div>

        {/* Footer: guardar (solo en Detalle) */}
        {tab === "detalle" && (
          <footer className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/12 px-4 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-white/5"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              disabled={updateTask.isPending || form.titulo.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ef3340] px-5 py-2 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(239,51,64,.35)] transition hover:-translate-y-px active:translate-y-0 disabled:cursor-default disabled:opacity-40"
            >
              {updateTask.isPending && <Loader2 size={14} className="animate-spin" />}
              Guardar cambios
            </button>
          </footer>
        )}
      </aside>

      {adjuntosOpen && (
        <AttachmentExplorerV2
          taskId={t.id}
          taskTitulo={t.titulo}
          open={adjuntosOpen}
          onClose={() => setAdjuntosOpen(false)}
        />
      )}
    </div>
  )
}
