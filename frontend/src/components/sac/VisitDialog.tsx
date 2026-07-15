import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Combobox } from "@/components/ui/Combobox"
import { useSacUI } from "@/context/SacContext"
import { useCreateVisit, useSacConfigLists } from "@/hooks/useSac"
import { useTicketToast } from "@/components/tickets/TicketToast"
import { extractErrorMessage } from "@/lib/ticketErrors"

const LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"
const INPUT =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"

function currentDateValue(): string {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = {
  client: "", commercial: "", contact: "", outcome: "", nextDate: "",
  quality: 3, clientMood: 3, opportunity: 3, urgency: 1,
  observations: "", actionPlan: "",
}

function ScaleField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-md border text-sm font-semibold transition ${
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function VisitDialog() {
  const { visitDialogOpen, setVisitDialogOpen } = useSacUI()
  const { data: lists } = useSacConfigLists()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const createVisit = useCreateVisit()
  const { showToast } = useTicketToast()

  useEffect(() => {
    if (visitDialogOpen) {
      setForm(EMPTY_FORM)
      setError(null)
    }
  }, [visitDialogOpen])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const canSubmit = Boolean(form.client.trim())

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    try {
      await createVisit.mutateAsync({
        date: currentDateValue(),
        client: form.client,
        commercial: form.commercial || undefined,
        contact: form.contact || undefined,
        outcome: form.outcome || undefined,
        nextDate: form.nextDate || undefined,
        quality: form.quality,
        clientMood: form.clientMood,
        opportunity: form.opportunity,
        urgency: form.urgency,
        observations: form.observations || undefined,
        actionPlan: form.actionPlan || undefined,
      })
      setVisitDialogOpen(false)
      showToast("Reporte de visita registrado", "success")
    } catch (err) {
      setError(extractErrorMessage(err, "No se pudo registrar el reporte de visita."))
    }
  }

  return (
    <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reporte de visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Cliente *</label>
              <input className={INPUT} value={form.client} onChange={(e) => set("client", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Comercial</label>
              <input className={INPUT} value={form.commercial} onChange={(e) => set("commercial", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Contacto</label>
              <input className={INPUT} value={form.contact} onChange={(e) => set("contact", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Próxima fecha</label>
              <input type="date" className={INPUT} value={form.nextDate} onChange={(e) => set("nextDate", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Resultado</label>
              <Combobox
                options={(lists?.visitOutcomes ?? []).map((o) => ({ value: o.value, label: o.label }))}
                value={form.outcome || null}
                onChange={(v) => set("outcome", v ? String(v) : "")}
                placeholder="Seleccionar…"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ScaleField label="Calidad" value={form.quality} onChange={(v) => set("quality", v)} />
            <ScaleField label="Ánimo del cliente" value={form.clientMood} onChange={(v) => set("clientMood", v)} />
            <ScaleField label="Oportunidad" value={form.opportunity} onChange={(v) => set("opportunity", v)} />
            <ScaleField label="Urgencia" value={form.urgency} onChange={(v) => set("urgency", v)} />
          </div>

          <div>
            <label className={LABEL}>Observaciones</label>
            <textarea className={INPUT} rows={3} value={form.observations} onChange={(e) => set("observations", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Plan de acción</label>
            <textarea className={INPUT} rows={2} value={form.actionPlan} onChange={(e) => set("actionPlan", e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-[#a8172f]">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
          <button
            type="button"
            onClick={() => setVisitDialogOpen(false)}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <ShimmerButton type="button" onClick={handleSubmit} disabled={createVisit.isPending || !canSubmit}>
            {createVisit.isPending ? "Guardando…" : "Guardar reporte"}
          </ShimmerButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
