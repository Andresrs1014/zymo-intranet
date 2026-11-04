import { useEffect, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { useTickets, useTicketConfigLists, useTicketAreaPrefixes } from "@/hooks/useTickets"
import { useTicketsUI } from "@/context/TicketsContext"
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox"
import { api } from "@/lib/api"
import { impactAgeStatus, daysOpen, priorityTone, formatSlaHours } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

const FILTER_LABEL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500"

interface FilterFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  className?: string
}

// Reusa el Combobox existente (buscador propio + scroll natural en la lista)
// en vez de un Select de Radix: con 10+ opciones (Tipo, Supervisor…) el Select
// muestra flechas de scroll arriba/abajo — el usuario las encontró poco
// intuitivas. Acá se escribe para filtrar, sin flechas.
function FilterField({ label, value, onChange, options, className }: FilterFieldProps) {
  return (
    <div className={className}>
      <label className={FILTER_LABEL}>{label}</label>
      <Combobox
        options={options}
        value={value || null}
        onChange={(v) => onChange(v ? String(v) : "")}
        placeholder="Todos"
      />
    </div>
  )
}

const EMPTY_FILTERS = { status: "", type: "", area: "", priority: "", impact: "", supervisor: "", search: "" }

export function ListView() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const { data: lists } = useTicketConfigLists()
  const { data: areas = [] } = useTicketAreaPrefixes()
  const { data: tickets = [], isLoading } = useTickets({
    status: filters.status || undefined,
    type: filters.type || undefined,
    area: filters.area || undefined,
    priority: filters.priority || undefined,
    impact: filters.impact || undefined,
    supervisor: filters.supervisor || undefined,
    search: filters.search || undefined,
  })
  const { setOpenTicketId } = useTicketsUI()

  // Supervisor ya no es una lista configurable — el filtro se llena con los
  // supervisores curados en Configuración de Tickets (mismo origen que asigna
  // el ticket al crear, ver TicketDialog.tsx).
  const [personasDirectorio, setPersonasDirectorio] = useState<{ id: number; nombre: string }[]>([])
  useEffect(() => {
    api.get("/operativo/personas/lista-simple", { params: { rol: "supervisor" } }).then(({ data }) => {
      setPersonasDirectorio(Array.isArray(data) ? data : [])
    }).catch(() => setPersonasDirectorio([]))
  }, [])

  function set<K extends keyof typeof filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const activeCount = Object.entries(filters).filter(([, v]) => v).length
  // Teléfono: los filtros avanzados se abren con un botón; estado va en chips.
  const [verFiltros, setVerFiltros] = useState(false)

  return (
    <div>
      <div className="mb-3 md:hidden">
        <div className="flex gap-2">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#71717A]" aria-hidden />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Buscar por código o cliente"
              aria-label="Buscar tickets"
              className="h-11 w-full rounded-xl border border-[#E4E4E7] bg-white pl-11 pr-3 text-[15px] text-zinc-900 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <button
            type="button"
            onClick={() => setVerFiltros((v) => !v)}
            aria-expanded={verFiltros}
            aria-label="Filtros"
            className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#E4E4E7] bg-white text-[#71717A]"
          >
            <SlidersHorizontal className="size-5" />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C3182A] px-1 font-mono text-[10px] text-white">{activeCount}</span>
            )}
          </button>
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por estado">
          {[{ value: "", label: "Todos" }, ...(lists?.statuses ?? []).map((st) => ({ value: st.value, label: st.label }))].map((o) => {
            const on = filters.status === o.value
            return (
              <button
                key={o.value || "todos"}
                type="button"
                aria-pressed={on}
                onClick={() => set("status", o.value)}
                className={`h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${
                  on ? "border-[#1F1F23] bg-[#1F1F23] text-white" : "border-[#E4E4E7] bg-white text-[#71717A]"
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`mb-4 rounded-lg border border-zinc-200 bg-white p-4 ${verFiltros ? "" : "max-md:hidden"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Filtros</h3>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <X size={13} /> Limpiar {activeCount > 1 ? `(${activeCount})` : ""}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FilterField
            label="Estado"
            value={filters.status}
            onChange={(v) => set("status", v)}
            options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
          />
          <FilterField
            label="Tipo"
            value={filters.type}
            onChange={(v) => set("type", v)}
            options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
          />
          <FilterField
            label="Área"
            value={filters.area}
            onChange={(v) => set("area", v)}
            options={areas.map((a) => ({ value: a.area, label: a.area }))}
          />
          <FilterField
            label="Prioridad"
            value={filters.priority}
            onChange={(v) => set("priority", v)}
            options={(lists?.priorities ?? []).map((p) => ({ value: p.value, label: p.label }))}
          />
          <FilterField
            label="Impacto"
            value={filters.impact}
            onChange={(v) => set("impact", v)}
            options={(lists?.impacts ?? []).map((i) => ({ value: i.value, label: i.label }))}
          />
          <FilterField
            label="Supervisor"
            value={filters.supervisor}
            onChange={(v) => set("supervisor", v)}
            options={personasDirectorio.map((p) => ({ value: p.nombre, label: p.nombre }))}
          />
        </div>

        <div className="mt-3 border-t border-zinc-100 pt-3 max-md:hidden">
          <label className={FILTER_LABEL}>Buscar</label>
          <div className="relative max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Código, cliente, descripción…"
              className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 md:hidden">
        {isLoading && <p className="py-10 text-center text-sm text-zinc-500">Cargando…</p>}
        {!isLoading && tickets.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">Sin tickets para estos filtros.</p>}
        {tickets.map((ticket) => (
          <TicketCardMovil key={ticket.id} ticket={ticket} onOpen={() => setOpenTicketId(ticket.id)} />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white max-md:hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Área / Plataforma</th>
              <th className="px-4 py-2.5">Responsable</th>
              <th className="px-4 py-2.5">Prioridad</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">SLA</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Cargando…</td></tr>
            )}
            {!isLoading && tickets.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-400">Sin tickets para estos filtros.</td></tr>
            )}
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} onOpen={() => setOpenTicketId(ticket.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Tarjeta para el teléfono (reemplaza la fila de la tabla). */
function TicketCardMovil({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const tone = priorityTone(ticket.priority)
  const vencido = impactAgeStatus(ticket) === "vencido"
  const slaOverdue = ticket.slaOverdue === true && !/cerrado/i.test(ticket.status)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ticket ${ticket.code}`}
      className="block w-full rounded-xl border border-[#E4E4E7] bg-white px-4 py-3.5 text-left active:bg-zinc-50"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono text-[13px] text-zinc-500">
          <span aria-hidden className="size-2 rounded-full" style={{ background: tone.text }} />
          {ticket.code}
        </span>
        <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">{ticket.status}</span>
      </span>
      <span className="mt-1 block text-[15px] font-bold text-zinc-900">{ticket.type}</span>
      <span className="mt-0.5 block truncate text-[13px] text-zinc-500">
        {[ticket.client, ticket.area].filter(Boolean).join(" · ")}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold" style={{ color: tone.text }}>Prioridad {ticket.priority.toLowerCase()}</span>
        {ticket.slaLimitHours != null ? (
          <span className={slaOverdue ? "font-bold text-[#a8172f]" : "text-zinc-500"}>
            SLA <span className="font-mono">{formatSlaHours(ticket.slaElapsedHours)}/{formatSlaHours(ticket.slaLimitHours)}</span>{slaOverdue ? " · vencido" : ""}
          </span>
        ) : (
          <span className={vencido ? "font-bold text-[#a8172f]" : "text-zinc-500"}>
            <span className="font-mono">{daysOpen(ticket)}d</span>{vencido ? " · vencido" : ""}
          </span>
        )}
      </span>
    </button>
  )
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const tone = priorityTone(ticket.priority)
  const vencido = impactAgeStatus(ticket) === "vencido"
  const responsable = ticket.supervisor || ticket.coordinator || ticket.analysts.join(", ")
  const slaOverdue = ticket.slaOverdue === true && !/cerrado/i.test(ticket.status)

  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() } }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ticket ${ticket.code}`}
      className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
    >
      <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-700">{ticket.code}</td>
      <td className="px-4 py-2.5">{ticket.type}</td>
      <td className="px-4 py-2.5 text-zinc-700">
        {ticket.area}
        {ticket.platform && <span className="text-zinc-400"> · {ticket.platform}</span>}
      </td>
      <td className="px-4 py-2.5 text-zinc-700">{responsable || <span className="text-zinc-300">—</span>}</td>
      <td className="px-4 py-2.5">
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: tone.text, background: tone.bg, borderColor: tone.border }}
        >
          {ticket.priority}
        </span>
      </td>
      <td className="px-4 py-2.5">{ticket.status}</td>
      <td className="px-4 py-2.5">
        {ticket.slaLimitHours != null ? (
          <span className={slaOverdue ? "font-bold text-[#a8172f]" : "text-zinc-600"}>
            {formatSlaHours(ticket.slaElapsedHours)}/{formatSlaHours(ticket.slaLimitHours)}
            {slaOverdue ? " · vencido" : ""}
          </span>
        ) : (
          <span className={vencido ? "font-bold text-[#a8172f]" : "text-zinc-600"}>
            {daysOpen(ticket)}d {vencido ? "· vencido" : ""}
          </span>
        )}
      </td>
    </tr>
  )
}
