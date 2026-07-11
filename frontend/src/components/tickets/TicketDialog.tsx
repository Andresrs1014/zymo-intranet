import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormSelect } from "@/components/tareas/FormSelect"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicketConfigLists, useTicketAreaPrefixes, useTicketCodePreview, useCreateTicket,
} from "@/hooks/useTickets"
import { currentDateValue } from "@/lib/ticketWork"
import { extractErrorMessage } from "@/lib/ticketErrors"

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"
const INPUT =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"

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

const EMPTY_FORM = {
  type: "", area: "", areaPrefix: "", client: "", platform: "", supervisor: "",
  analyst: "", coordinator: "", phone: "", email: "", date: currentDateValue(),
  dueDate: "", priority: "", impact: "", channel: "", managementCriteria: "",
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
  const { data: preview } = useTicketCodePreview(form.date, form.areaPrefix)

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

  const canSubmit = Boolean(
    form.type && form.area && form.date && form.priority && lists?.statuses?.[0]?.value
  )

  async function handleSubmit() {
    const status = lists?.statuses?.[0]?.value
    if (!canSubmit || !status) return
    setError(null)
    try {
      await createTicket.mutateAsync({ ...form, status, evidence: files })
      setDialogOpen(false)
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo crear el ticket. Revisa los campos requeridos."))
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <FormSelect
            label="Tipo *"
            value={form.type}
            onChange={(v) => set("type", v)}
            options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
          />
          <FormSelect
            label="Área *"
            value={form.area}
            onChange={handleAreaChange}
            options={areas.map((a) => ({ value: a.area, label: a.area }))}
          />

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
            options={(lists?.supervisors ?? []).map((s) => ({ value: s.value, label: s.label }))}
            noneLabel="Sin asignar"
          />
          <FormSelect
            label="Analista"
            value={form.analyst}
            onChange={(v) => set("analyst", v)}
            options={(lists?.analysts ?? []).map((a) => ({ value: a.value, label: a.label }))}
            noneLabel="Sin asignar"
          />
          <FormSelect
            label="Coordinador"
            value={form.coordinator}
            onChange={(v) => set("coordinator", v)}
            options={(lists?.coordinators ?? []).map((c) => ({ value: c.value, label: c.label }))}
            noneLabel="Sin asignar"
          />

          <div>
            <label className={LABEL}>Teléfono</label>
            <input className={INPUT} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Correo</label>
            <input className={INPUT} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div>
            <label className={LABEL}>Fecha *</label>
            <input type="date" className={INPUT} value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Fecha compromiso</label>
            <input type="date" className={INPUT} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </div>

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
          <FormSelect
            label="Criterio de gestión"
            value={form.managementCriteria}
            onChange={(v) => set("managementCriteria", v)}
            options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
          />

          <div className="sm:col-span-2">
            <label className={LABEL}>Código</label>
            <input className={`${INPUT} bg-zinc-50 font-mono`} value={preview?.code ?? "…"} readOnly />
          </div>

          <div className="sm:col-span-2">
            <label className={LABEL}>Descripción</label>
            <textarea className={INPUT} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Acción inicial (opcional)</label>
            <textarea className={INPUT} rows={2} value={form.actionsInitial} onChange={(e) => set("actionsInitial", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Evidencia</label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </div>
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
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createTicket.isPending || !canSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-95 disabled:opacity-50"
          >
            {createTicket.isPending ? "Creando…" : "Crear ticket"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
