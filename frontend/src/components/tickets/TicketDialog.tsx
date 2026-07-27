import { useEffect, useState } from "react"
import { Paperclip } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { Combobox, MultiCombobox, type ComboboxOption } from "@/components/ui/Combobox"
import { StagedAttachmentsPortal } from "@/components/tareas/StagedAttachmentsPortal"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { useTicketsUI } from "@/context/TicketsContext"
import {
  useTicketConfigLists, useTicketAreaPrefixes, useTicketCodePreview, useCreateTicket,
} from "@/hooks/useTickets"
import { currentDateValue } from "@/lib/ticketWork"
import { extractErrorMessage } from "@/lib/ticketErrors"
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

// Mismo Combobox que ya usan los filtros de la lista (buscador propio, scroll
// normal) en vez del Select de Radix — sin flechas de scroll arriba/abajo en
// listas largas (Supervisor/Coordinador con decenas de personas del Directorio).
function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <Combobox
        options={options}
        value={value || null}
        onChange={(v) => onChange(v ? String(v) : "")}
        placeholder={placeholder ?? "Seleccionar…"}
      />
    </div>
  )
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
  analysts: [] as string[], coordinator: "", manager: "", owner: "", date: currentDateValue(),
  status: "", priority: "", impact: "", channel: "", managementCriteria: "",
  description: "",
}

export function TicketDialog() {
  const { dialogOpen, setDialogOpen } = useTicketsUI()
  const { data: lists } = useTicketConfigLists()
  const { data: areas = [] } = useTicketAreaPrefixes()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createTicket = useCreateTicket()
  const { data: preview } = useTicketCodePreview(form.date, form.areaPrefix)
  const { showToast } = useTicketToast()
  const currentUser = useAuthStore((s) => s.user)

  // Cliente real (directorio T&C) — vive en vivo, separado de `form.client`
  // (que sigue guardando el nombre, texto plano, para no romper tickets viejos
  // ni los tipos que reusan el campo "cliente" con otro significado, ver
  // clientLabelFor). El id solo se usa para resolver analista/coordinador/
  // supervisor automáticamente.
  const [clientesDirectorio, setClientesDirectorio] = useState<{ id: number; nombre: string }[]>([])
  const [clienteId, setClienteId] = useState<number | null>(null)

  // Supervisor/Analista(s)/Coordinador se eligen del Directorio real (no de
  // texto libre) — así el correo de contacto siempre existe, sin depender de
  // que alguien lo llene a mano en otra pantalla. Cada select solo muestra
  // personas curadas para ese rol específico en Configuración de Tickets
  // (`?rol=supervisor|analista|coordinador`, con cargo asignado, filtrables
  // por área ahí) — no cualquier persona activa del Directorio.
  // `form.supervisor`/`form.coordinator`/`form.analysts` guardan el id
  // (string) de la persona mientras se edita; al enviar se resuelve a
  // nombre+correo (ver handleSubmit).
  type PersonaDirectorio = { id: number; nombre: string; email: string }
  const [supervisoresOptions, setSupervisoresOptions] = useState<PersonaDirectorio[]>([])
  const [analistasOptions, setAnalistasOptions] = useState<PersonaDirectorio[]>([])
  const [coordinadoresOptions, setCoordinadoresOptions] = useState<PersonaDirectorio[]>([])
  const [jerarquiaSugerida, setJerarquiaSugerida] = useState<{
    analistas: PersonaDirectorio[]; coordinadores: PersonaDirectorio[]; supervisores: PersonaDirectorio[]
  } | null>(null)

  useEffect(() => {
    if (!dialogOpen) return
    api.get("/operativo/clientes/lista-simple").then(({ data }) => {
      setClientesDirectorio(Array.isArray(data) ? data : [])
    }).catch(() => setClientesDirectorio([]))
    api.get("/operativo/personas/lista-simple", { params: { rol: "supervisor" } }).then(({ data }) => {
      setSupervisoresOptions(Array.isArray(data) ? data : [])
    }).catch(() => setSupervisoresOptions([]))
    api.get("/operativo/personas/lista-simple", { params: { rol: "analista" } }).then(({ data }) => {
      setAnalistasOptions(Array.isArray(data) ? data : [])
    }).catch(() => setAnalistasOptions([]))
    api.get("/operativo/personas/lista-simple", { params: { rol: "coordinador" } }).then(({ data }) => {
      setCoordinadoresOptions(Array.isArray(data) ? data : [])
    }).catch(() => setCoordinadoresOptions([]))
  }, [dialogOpen])

  useEffect(() => {
    if (!clienteId) { setJerarquiaSugerida(null); return }
    let cancelled = false
    api.get(`/operativo/clientes/${clienteId}/jerarquia-tickets`).then(({ data }) => {
      if (cancelled) return
      setJerarquiaSugerida(data)
      setForm((f) => ({
        ...f,
        analysts: data.analistas.length ? data.analistas.map((a: PersonaDirectorio) => String(a.id)) : f.analysts,
        coordinator: data.coordinadores[0] ? String(data.coordinadores[0].id) : f.coordinator,
        supervisor: data.supervisores[0] ? String(data.supervisores[0].id) : f.supervisor,
      }))
    }).catch(() => { if (!cancelled) setJerarquiaSugerida(null) })
    return () => { cancelled = true }
  }, [clienteId])

  function handleClienteChange(idStr: string) {
    const id = idStr ? Number(idStr) : null
    setClienteId(id)
    const cliente = clientesDirectorio.find((c) => c.id === id)
    set("client", cliente?.nombre ?? "")
  }

  useEffect(() => {
    if (dialogOpen) {
      // "Quien genera ticket" ya no se escribe a mano — es quien está
      // diligenciando el formulario en ese momento.
      setForm({ ...EMPTY_FORM, owner: currentUser?.full_name || currentUser?.email || "" })
      setFiles([])
      setError(null)
      setClienteId(null)
      setJerarquiaSugerida(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleAreaChange(areaName: string) {
    const match = areas.find((a) => a.area === areaName)
    setForm((f) => ({ ...f, area: areaName, areaPrefix: match?.prefix ?? "" }))
  }

  const canSubmit = Boolean(form.type && form.area && form.date && form.status && form.priority)

  function personaById(options: PersonaDirectorio[], id: string) {
    return options.find((p) => String(p.id) === id)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    try {
      const supervisorPersona = personaById(supervisoresOptions, form.supervisor)
      const coordinadorPersona = personaById(coordinadoresOptions, form.coordinator)
      const analistaPersonas = form.analysts
        .map((id) => personaById(analistasOptions, id))
        .filter((p): p is PersonaDirectorio => Boolean(p))
      await createTicket.mutateAsync({
        ...form,
        supervisor: supervisorPersona?.nombre ?? "",
        supervisorEmail: supervisorPersona?.email,
        coordinator: coordinadorPersona?.nombre ?? "",
        coordinatorEmail: coordinadorPersona?.email,
        analysts: analistaPersonas.map((p) => p.nombre),
        analystEmails: analistaPersonas.map((p) => p.email),
        evidence: files,
      })
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
          <DialogTitle>Nuevo ticket</DialogTitle>
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
              {clientLabelFor(form.type) === "Cliente" ? (
                <SelectField
                  label="Cliente"
                  value={clienteId ? String(clienteId) : ""}
                  onChange={handleClienteChange}
                  options={clientesDirectorio.map((c) => ({ value: String(c.id), label: c.nombre }))}
                />
              ) : (
                <div>
                  <label className={LABEL}>{clientLabelFor(form.type)}</label>
                  <input className={INPUT} value={form.client} onChange={(e) => set("client", e.target.value)} />
                </div>
              )}
              <SelectField
                label="Plataforma"
                value={form.platform}
                onChange={(v) => set("platform", v)}
                options={(lists?.platforms ?? []).map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Sin plataforma"
              />
              <SelectField
                label="Supervisor"
                value={form.supervisor}
                onChange={(v) => set("supervisor", v)}
                options={supervisoresOptions.map((p) => ({ value: String(p.id), label: p.nombre }))}
                placeholder="Sin asignar"
              />
              <div>
                <label className={LABEL}>Analistas</label>
                <MultiCombobox
                  values={form.analysts}
                  onChange={(vs) => set("analysts", vs.map(String))}
                  options={analistasOptions.map((p) => ({ value: String(p.id), label: p.nombre }))}
                  placeholder="Sin asignar"
                />
              </div>
              <SelectField
                label="Coordinador"
                value={form.coordinator}
                onChange={(v) => set("coordinator", v)}
                options={coordinadoresOptions.map((p) => ({ value: String(p.id), label: p.nombre }))}
                placeholder="Sin asignar"
              />
              {jerarquiaSugerida && (
                <p className="col-span-full text-xs text-zinc-500">
                  Sugerido desde el directorio — analista(s): <strong>{jerarquiaSugerida.analistas.map((a) => a.nombre).join(", ") || "sin asignar"}</strong>,
                  {" "}coordinador: <strong>{jerarquiaSugerida.coordinadores[0]?.nombre ?? "sin asignar"}</strong>,
                  {" "}supervisor: <strong>{jerarquiaSugerida.supervisores[0]?.nombre ?? "sin asignar"}</strong>.
                </p>
              )}
              <SelectField
                label="¿Quién gestiona el ticket?"
                value={form.manager}
                onChange={(v) => set("manager", v)}
                options={(lists?.managers ?? []).map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Sin asignar"
              />
              <div>
                <label className={LABEL}>Quien genera ticket</label>
                <input className={`${INPUT} bg-zinc-50 text-zinc-500`} value={form.owner} readOnly />
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
              <SelectField
                label="Área *"
                value={form.area}
                onChange={handleAreaChange}
                options={areas.map((a) => ({ value: a.area, label: a.area }))}
              />
              <div>
                <label className={LABEL}>Código estimado</label>
                <input className={`${INPUT} bg-zinc-50 font-mono`} value={preview?.code ?? "…"} readOnly />
              </div>
              <SelectField
                label="Tipo *"
                value={form.type}
                onChange={(v) => set("type", v)}
                options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
              />
              <SelectField
                label="Estado *"
                value={form.status}
                onChange={(v) => set("status", v)}
                options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
              />
              <SelectField
                label="Prioridad *"
                value={form.priority}
                onChange={(v) => set("priority", v)}
                options={(lists?.priorities ?? []).map((p) => ({ value: p.value, label: p.label }))}
              />
              <SelectField
                label="Impacto"
                value={form.impact}
                onChange={(v) => set("impact", v)}
                options={(lists?.impacts ?? []).map((i) => ({ value: i.value, label: i.label }))}
              />
              <SelectField
                label="Canal"
                value={form.channel}
                onChange={(v) => set("channel", v)}
                options={(lists?.channels ?? []).map((c) => ({ value: c.value, label: c.label }))}
              />
            </div>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Descripción y soporte</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Criterio de gestión"
                value={form.managementCriteria}
                onChange={(v) => set("managementCriteria", v)}
                options={(lists?.managementCriteria ?? []).map((m) => ({ value: m.value, label: m.label }))}
              />
              <div className="sm:col-span-2">
                <label className={LABEL}>Descripción</label>
                <textarea className={INPUT} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        {error && <p className="text-sm text-[#a8172f]">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
          <button
            type="button"
            onClick={() => setAttachmentsOpen(true)}
            className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
          >
            <Paperclip size={15} /> Evidencias{files.length > 0 ? ` (${files.length})` : ""}
          </button>
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

      {attachmentsOpen && (
        <StagedAttachmentsPortal
          files={files}
          onChange={setFiles}
          title={form.client || "Nuevo ticket"}
          open={attachmentsOpen}
          onClose={() => setAttachmentsOpen(false)}
        />
      )}
    </Dialog>
  )
}
