import { useEffect, useMemo, useState } from "react"
import { Paperclip, Check, Ban, Loader2 } from "lucide-react"
import { useTask as useTaskQuery, useUpdateTask, useAcceptTask, useTaskHistory } from "@/hooks/useTasks"
import { useTask as useTaskContext } from "@/context/TaskContext"
import { useTaskLists } from "@/hooks/useTaskLists"
import { useTeamMembers } from "@/hooks/useTaskTeams"
import { useAuthStore } from "@/store/authStore"
import { useTaskToast } from "./TaskToast"
import { AttachmentExplorerV2 } from "./AttachmentExplorerV2"
import { TaskStatusPill } from "./TaskStatusPill"
import { FormSelect } from "./FormSelect"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

const FIELD =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 " +
  "outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-zinc-400"
const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"

interface Props {
  task: Task | null
  onClose: () => void
}

export function TaskDrawer({ task, onClose }: Props) {
  const targetId = task?.id ?? null
  const { sidebarWidth } = useTaskContext()

  // Datos frescos: refleja aceptar/editar sin cerrar el drawer (el prop es un snapshot).
  const { data: liveTask } = useTaskQuery(targetId)
  const t = liveTask ?? task

  const teamId = t?.teamId ?? null
  const { data: lists } = useTaskLists(teamId)
  const { data: members = [] } = useTeamMembers(teamId)
  const { data: history = [], isLoading: historyLoading } = useTaskHistory(targetId)

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
    esMultiDia: false,
    fechaFin: "",
    horaInicio: "",
    horaFin: "",
    asignadoAId: "" as string | number,
    modalidad: "",
  })

  // Semilla del formulario solo cuando cambia la tarea objetivo (evita pisar la edición).
  useEffect(() => {
    if (!task) return
    setTab("detalle")
    setAdjuntosOpen(false)
    const fechaInicio = task.fecha.slice(0, 10)
    const fechaCierre = task.horaCierre ? task.horaCierre.slice(0, 10) : fechaInicio
    const esMultiDia = fechaCierre !== fechaInicio
    setForm({
      titulo: task.titulo,
      descripcionTecnica: task.descripcionTecnica ?? "",
      etiqueta: task.etiqueta,
      plataforma: task.plataforma,
      estado: task.estado,
      prioridad: task.prioridad,
      fecha: fechaInicio,
      esMultiDia,
      fechaFin: esMultiDia ? fechaCierre : "",
      horaInicio: task.horaInicio ? task.horaInicio.slice(11, 16) : "",
      horaFin: task.horaCierre ? task.horaCierre.slice(11, 16) : "",
      asignadoAId: task.asignadoAId ?? "",
      modalidad: task.modalidad ?? "",
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
  const toOpts = (arr: ListConfig[]) => arr.map((o) => ({ value: o.value, label: o.label }))

  const done = (estadoConfig?.isFinal ?? false) || (estadoConfig?.isCanceled ?? false)
  const vencida = !done && isOverdue(t)

  const isPendingForMe =
    !!user && t.asignadoAId === user.id && t.aceptacion === "pendiente"

  const real = t.tiempoTotalMinutos ?? 0

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
    // Si la tarea dura más de un día, "hora fin" cae en fechaFin en vez de en fecha.
    const fechaCierre = form.esMultiDia && form.fechaFin ? form.fechaFin : form.fecha
    const input: UpdateTaskInput = {
      titulo: form.titulo,
      descripcionTecnica: form.descripcionTecnica || null,
      etiqueta: form.etiqueta,
      plataforma: form.plataforma,
      estado: form.estado,
      prioridad: form.prioridad,
      fecha: form.fecha,
      horaInicio: form.horaInicio ? `${form.fecha}T${form.horaInicio}:00` : null,
      horaCierre: form.horaFin ? `${fechaCierre}T${form.horaFin}:00` : null,
      asignadoAId: form.asignadoAId ? Number(form.asignadoAId) : null,
      modalidad: form.modalidad || null,
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
    <>
      <Sheet open onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          // Ancho real: `left` en style inline (gana sí o sí sobre `w-3/4`/`sm:max-w-sm`
          // de la variante base del Sheet, que si no se sobreescribe con la misma
          // especificidad deja el panel angosto y pegado a la izquierda). Sigue el
          // ancho actual del sidebar (expandido o colapsado) para no desalinearse.
          className="flex flex-col gap-0 border-l border-zinc-200 bg-white p-0 text-zinc-900"
          style={{ left: sidebarWidth, right: 0, width: "auto", maxWidth: "none" }}
        >
          {/* Header */}
          <SheetHeader className="space-y-0 border-b border-zinc-200 px-6 py-5 pr-14 text-left">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TaskStatusPill
                estadoLabel={estadoConfig?.label ?? t.estado}
                estadoColor={estadoConfig?.color}
                aceptacion={t.aceptacion}
                vencida={vencida}
              />
              {prioConfig && (
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: `${prioConfig.color ?? "#71717a"}18`, color: prioConfig.color ?? "#71717a" }}
                >
                  {prioConfig.label}
                </span>
              )}
            </div>
            <SheetTitle className="text-[15px] font-bold leading-snug text-zinc-900">{t.titulo}</SheetTitle>
            <p className="mt-1 text-xs text-zinc-500">
              {asignadoNombre} · asignada por {t.subidoPorNombre}
            </p>
          </SheetHeader>

          {/* Barra de aceptación fijada arriba */}
          {isPendingForMe && (
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-6 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="mr-auto text-[13px] font-medium text-zinc-700">
                Te asignaron esta tarea. ¿La aceptas?
              </span>
              <button
                onClick={() => handleAccept("rechazada")}
                disabled={acceptTask.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                <Ban size={13} /> Rechazar
              </button>
              <button
                onClick={() => handleAccept("aceptada")}
                disabled={acceptTask.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:opacity-50"
              >
                {acceptTask.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aceptar
              </button>
            </div>
          )}

          {/* Tiempo real registrado */}
          {real > 0 && (
            <section className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
                Tiempo real
              </span>
              <span className="font-mono text-sm font-bold text-zinc-900">{fmtMin(real)}</span>
            </section>
          )}

          {/* Tabs */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as DrawerTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b border-zinc-200 px-4 pt-3 pb-3">
              <TabsList>
                <TabsTrigger value="detalle">Detalle</TabsTrigger>
                <TabsTrigger value="actividad">Actividad</TabsTrigger>
                <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <TabsContent value="detalle" className="mt-0">
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
                    <FormSelect label="Etiqueta" value={form.etiqueta} onChange={(v) => setForm((f) => ({ ...f, etiqueta: v }))} options={toOpts(etiquetas)} />
                    <FormSelect label="Plataforma" value={form.plataforma} onChange={(v) => setForm((f) => ({ ...f, plataforma: v }))} options={toOpts(plataformas)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormSelect label="Estado" value={form.estado} onChange={(v) => setForm((f) => ({ ...f, estado: v }))} options={toOpts(estados)} />
                    <FormSelect label="Prioridad" value={form.prioridad} onChange={(v) => setForm((f) => ({ ...f, prioridad: v }))} options={toOpts(prioridades)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Fecha</label>
                      <input type="date" className={FIELD} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
                    </div>
                    <FormSelect
                      label="Asignado a"
                      value={String(form.asignadoAId ?? "")}
                      onChange={(v) => setForm((f) => ({ ...f, asignadoAId: v }))}
                      options={members.map((m) => ({ value: String(m.userId), label: m.userNombre ?? `Usuario ${m.userId}` }))}
                      noneLabel="Sin asignar"
                    />
                  </div>

                  {/* Tarea de varios días */}
                  <div>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-zinc-600">
                      <input
                        type="checkbox"
                        checked={form.esMultiDia}
                        onChange={(e) => setForm((f) => ({ ...f, esMultiDia: e.target.checked }))}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-primary focus:ring-primary/30"
                      />
                      Esta tarea dura más de un día
                    </label>
                    {form.esMultiDia && (
                      <div className="mt-2">
                        <label className={LABEL}>Fecha fin</label>
                        <input
                          type="date"
                          className={FIELD}
                          min={form.fecha}
                          value={form.fechaFin}
                          onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Hora inicio</label>
                      <input type="time" className={FIELD} value={form.horaInicio} onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className={LABEL}>Hora fin</label>
                      <input type="time" className={FIELD} value={form.horaFin} onChange={(e) => setForm((f) => ({ ...f, horaFin: e.target.value }))} />
                    </div>
                  </div>

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
              </TabsContent>

              <TabsContent value="actividad" className="mt-0">
                <div className="flex flex-col gap-3">
                  {historyLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                      <Loader2 size={15} className="animate-spin" /> Cargando actividad…
                    </div>
                  ) : history.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">Sin actividad registrada.</p>
                  ) : (
                    <ol className="relative flex flex-col gap-4 border-l border-zinc-200 pl-5">
                      {history.map((log) => (
                        <li key={log.id} className="relative">
                          <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-semibold text-zinc-800">
                              {ACTION_LABEL[log.accion] ?? log.accion}
                            </span>
                            <time className="shrink-0 font-mono text-[11px] text-zinc-400">
                              {new Date(log.fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </time>
                          </div>
                          <p className="text-xs text-zinc-500">{log.userNombre}</p>
                          {log.detalle && <p className="mt-0.5 text-xs text-zinc-500">{log.detalle}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="adjuntos" className="mt-0">
                <div className="flex flex-col items-start gap-3 py-2">
                  <p className="text-sm text-zinc-600">
                    {t.attachments?.length
                      ? `${t.attachments.length} archivo${t.attachments.length === 1 ? "" : "s"} adjunto${t.attachments.length === 1 ? "" : "s"}.`
                      : "Esta tarea aún no tiene adjuntos."}
                  </p>
                  <button
                    onClick={() => setAdjuntosOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <Paperclip size={15} /> Abrir explorador de adjuntos
                  </button>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Footer: guardar (solo en Detalle) */}
          {tab === "detalle" && (
            <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cerrar
              </button>
              <button
                onClick={handleSave}
                disabled={updateTask.isPending || form.titulo.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:cursor-default disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
              >
                {updateTask.isPending && <Loader2 size={14} className="animate-spin" />}
                Guardar cambios
              </button>
            </footer>
          )}
        </SheetContent>
      </Sheet>

      {adjuntosOpen && (
        <AttachmentExplorerV2
          taskId={t.id}
          taskTitulo={t.titulo}
          open={adjuntosOpen}
          onClose={() => setAdjuntosOpen(false)}
        />
      )}
    </>
  )
}
