import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicketConfigLists, useTicketAreaPrefixes, useTicketCodePreview, useCreateTicket,
  useSyncMasterData,
} from "@/hooks/useTickets"
import { currentDateValue } from "@/lib/ticketWork"
import { extractErrorMessage } from "@/lib/ticketErrors"
import { canConfigTickets } from "@/lib/permissions"
import { useAuthStore } from "@/store/authStore"
import { useTicketToast } from "./TicketToast"

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"
const INPUT =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
const SECTION_TITLE = "mb-3 text-[13px] font-bold uppercase tracking-[0.04em] text-zinc-700"

// El campo "cliente" del schema original se reusa para cualquier ticket
// interno, con la etiqueta ajustada según el tipo elegido (ver spec F1).
const CLIENT_LABEL_BY_TYPE: Record<string, string> = {
  "Mantenimiento de instalaciones": "Ubicación / activo afectado",
  "Faltante o inconsistencia": "Ubicación / referencia afectada",
  "Capacitación de personal": "Área o equipo capacitado",
  "Novedad de proceso": "Proceso afectado",
  "Corrección de procedimiento": "Procedimiento afectado",
  OKR: "Objetivo / iniciativa relacionada",
}

function clientLabelFor(type: string): string {
  return CLIENT_LABEL_BY_TYPE[type] ?? "Cliente"
}

// Fiel al header "1 Radicar · 2 Gestionar · 3 Cerrar" del ZymoAlly original
// (index.html, pqr-stage-grid) — mismo contenido, estilo propio (shadcn Card).
const STAGES = [
  { n: 1, label: "Radicar", detail: "Registra cliente, impacto, responsables, descripción y evidencias.", active: true },
  { n: 2, label: "Gestionar", detail: "Actualiza estado, acciones efectuadas y avance documental.", active: false },
  { n: 3, label: "Cerrar", detail: "Valida evidencia, tiempo objetivo y comunicación al cliente.", active: false },
] as const

const EMPTY_FORM = {
  type: "", area: "", areaPrefix: "", client: "", platform: "", supervisor: "",
  analyst: "", coordinator: "", owner: "", phone: "", email: "", date: currentDateValue(),
  dueDate: "", status: "", priority: "", impact: "", channel: "", managementCriteria: "",
  description: "", actionsInitial: "",
}

export function TicketDialog() {
  const { dialogOpen, setDialogOpen } = useTicketsUI()
  const { data: lists } = useTicketConfigLists()
  const { data: areas = [] } = useTicketAreaPrefixes()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const createTicket = useCreateTicket()
  const syncMasterData = useSyncMasterData()
  const { data: preview } = useTicketCodePreview(form.date, form.areaPrefix)
  const { showToast } = useTicketToast()
  const user = useAuthStore((s) => s.user)
  const canSync = user ? canConfigTickets(user.role, user.app_permissions) : false

  async function handleSync() {
    try {
      const r = await syncMasterData.mutateAsync()
      const created = r.areas.created + r.platforms.created + r.personas.created
      const updated = r.areas.updated + r.platforms.updated + r.personas.updated
      showToast(`Datos maestros sincronizados: ${created} nuevos, ${updated} actualizados`, "success")
    } catch (err) {
      showToast(extractErrorMessage(err, "No se pudo sincronizar los datos maestros."), "error")
    }
  }

  useEffect(() => {
    if (dialogOpen) {
      setForm(EMPTY_FORM)
      setFiles([])
      setError(null)
    }
  }, [dialogOpen])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleAreaChange(areaName: string) {
    const match = areas.find((a) => a.area === areaName)
    setForm((f) => ({ ...f, area: areaName, areaPrefix: match?.prefix ?? "" }))
  }

  const canSubmit = Boolean(form.type && form.area && form.date && form.status && form.priority)

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    try {
      await createTicket.mutateAsync({ ...form, evidence: files })
      setDialogOpen(false)
      showToast("Ticket creado satisfactoriamente", "success")
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo crear el ticket. Revisa los campos requeridos."))
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Nuevo ticket</DialogTitle>
            {canSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncMasterData.isPending}
                className="mr-6 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {syncMasterData.isPending ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="mb-2 grid gap-3 sm:grid-cols-3">
          {STAGES.map((stage) => (
            <Card
              key={stage.n}
              className={stage.active ? "border-primary/40 bg-primary/5 shadow-sm" : "border-zinc-200 shadow-none"}
            >
              <CardContent className="p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      stage.active ? "bg-primary text-primary-foreground" : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {stage.n}
                  </span>
                  <strong className="text-sm text-zinc-900">{stage.label}</strong>
                </div>
                <p className="text-xs leading-snug text-zinc-500">{stage.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6 py-2">
          <section>
            <h3 className={SECTION_TITLE}>Cliente y responsables</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>{clientLabelFor(form.type)}</label>
                <input className={INPUT} value={form.client} onChange={(e) => set("client", e.target.value)} />
              </div>
              <FormSelect
                label="Plataforma"
                value={form.platform}
                onChange={(v) => set("platform", v)}
                options={(lists?.platforms ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin plataforma"
              />
              <FormSelect
                label="Supervisor"
                value={form.supervisor}
                onChange={(v) => set("supervisor", v)}
                options={(lists?.personas ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin asignar"
              />
              <FormSelect
                label="Analista"
                value={form.analyst}
                onChange={(v) => set("analyst", v)}
                options={(lists?.personas ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin asignar"
              />
              <FormSelect
                label="Coordinador"
                value={form.coordinator}
                onChange={(v) => set("coordinator", v)}
                options={(lists?.personas ?? []).map((p) => ({ value: p.value, label: p.label }))}
                noneLabel="Sin asignar"
              />
              <div>
                <label className={LABEL}>Quien genera ticket</label>
                <input className={INPUT} value={form.owner} onChange={(e) => set("owner", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Teléfono</label>
                <input className={INPUT} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Correo</label>
                <input className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Clasificación y compromiso</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Fecha *</label>
                <input type="date" className={INPUT} value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Fecha compromiso</label>
                <input type="date" className={INPUT} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              </div>
              <FormSelect
                label="Área *"
                value={form.area}
                onChange={handleAreaChange}
                options={areas.map((a) => ({ value: a.area, label: a.area }))}
              />
              <div>
                <label className={LABEL}>Código estimado</label>
                <input className={`${INPUT} bg-zinc-50 font-mono`} value={preview?.code ?? "…"} readOnly />
              </div>
              <FormSelect
                label="Tipo *"
                value={form.type}
                onChange={(v) => set("type", v)}
                options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
              />
              <FormSelect
                label="Estado *"
                value={form.status}
                onChange={(v) => set("status", v)}
                options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
              />
              <FormSelect
                label="Prioridad *"
                value={form.priority}
                onChange={(v) => set("priority", v)}
                options={(lists?.priorities ?? []).map((p) => ({ value: p.value, label: p.label }))}
              />
              <FormSelect
                label="Impacto"
                value={form.impact}
                onChange={(v) => set("impact", v)}
                options={(lists?.impacts ?? []).map((i) => ({ value: i.value, label: i.label }))}
              />
              <FormSelect
                label="Canal"
                value={form.channel}
                onChange={(v) => set("channel", v)}
                options={(lists?.channels ?? []).map((c) => ({ value: c.value, label: c.label }))}
              />
            </div>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Descripción, acciones y soporte</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect
                label="Criterio de gestión"
                value={form.managementCriteria}
                onChange={(v) => set("managementCriteria", v)}
                options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
              />
              <div className="sm:col-span-2">
                <label className={LABEL}>Descripción</label>
                <textarea className={INPUT} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Acciones efectuadas</label>
                <textarea className={INPUT} rows={2} value={form.actionsInitial} onChange={(e) => set("actionsInitial", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Evidencias</label>
                <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              </div>
            </div>
          </section>
        </div>

        {error && <p className="text-sm text-[#a8172f]">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
          <button
            type="button"
            onClick={() => setDialogOpen(false)}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <ShimmerButton
            type="button"
            onClick={handleSubmit}
            disabled={createTicket.isPending || !canSubmit}
          >
            {createTicket.isPending ? "Creando…" : "Crear ticket"}
          </ShimmerButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
