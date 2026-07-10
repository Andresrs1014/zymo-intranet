import { useState } from "react"
import { useTickets, useTicketConfigLists } from "@/hooks/useTickets"
import { useTicketsUI } from "@/context/TicketsContext"
import { FormSelect } from "@/components/tareas/FormSelect"
import { impactAgeStatus, daysOpen, priorityTone } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

export function ListView() {
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [search, setSearch] = useState("")
  const { data: lists } = useTicketConfigLists()
  const { data: tickets = [], isLoading } = useTickets({
    status: status || undefined,
    type: type || undefined,
    search: search || undefined,
  })
  const { setOpenTicketId } = useTicketsUI()

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <FormSelect
          label="Estado"
          value={status}
          onChange={setStatus}
          options={(lists?.statuses ?? []).map((s) => ({ value: s.value, label: s.label }))}
          noneLabel="Todos"
          triggerClassName="w-44"
        />
        <FormSelect
          label="Tipo"
          value={type}
          onChange={setType}
          options={(lists?.types ?? []).map((t) => ({ value: t.value, label: t.label }))}
          noneLabel="Todos"
          triggerClassName="w-56"
        />
        <div className="ml-auto">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">Buscar</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Código, cliente, descripción…"
            className="h-10 w-64 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Área</th>
              <th className="px-4 py-2.5">Prioridad</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Días abierto</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">Cargando…</td></tr>
            )}
            {!isLoading && tickets.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">Sin tickets para estos filtros.</td></tr>
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

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const tone = priorityTone(ticket.priority)
  const vencido = impactAgeStatus(ticket) === "vencido"

  return (
    <tr onClick={onOpen} className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
      <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-700">{ticket.code}</td>
      <td className="px-4 py-2.5">{ticket.type}</td>
      <td className="px-4 py-2.5">{ticket.area}</td>
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
        <span className={vencido ? "font-bold text-[#a8172f]" : "text-zinc-600"}>
          {daysOpen(ticket)} {vencido ? "· vencido" : ""}
        </span>
      </td>
    </tr>
  )
}
