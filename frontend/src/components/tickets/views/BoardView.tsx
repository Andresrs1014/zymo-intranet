import {
  DndContext, type DragEndEvent, closestCorners, useSensor, useSensors, PointerSensor, useDroppable,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { useTickets, useTicketConfigLists, useUpdateTicketStatus } from "@/hooks/useTickets"
import { useTicketsUI } from "@/context/TicketsContext"
import { priorityTone } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

function TicketCard({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `ticket-${ticket.id}` })
  const tone = priorityTone(ticket.priority)
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className="relative mb-2 cursor-pointer rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-sm"
        onClick={onOpen}
      >
        <button
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar ticket"
          className="absolute right-1.5 top-2 flex cursor-grab border-none bg-transparent p-0.5 text-zinc-300 hover:text-zinc-500"
          style={{ touchAction: "none" }}
        >
          <GripVertical size={15} />
        </button>
        <div className="mb-1.5 font-mono text-[11px] text-zinc-400">{ticket.code}</div>
        <div className="mb-2 pr-[18px] text-[13px] font-medium leading-snug text-zinc-900">{ticket.type}</div>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: tone.text, background: tone.bg, borderColor: tone.border }}
        >
          {ticket.priority}
        </span>
      </div>
    </div>
  )
}

function Column({
  status, label, tickets, onOpen,
}: {
  status: string
  label: string
  tickets: Ticket[]
  onOpen: (id: number) => void
}) {
  const { setNodeRef } = useDroppable({ id: `column-${status}` })

  return (
    <div ref={setNodeRef} className="flex min-w-[260px] flex-1 flex-col rounded-lg bg-zinc-50 p-3">
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">
        <span>{label}</span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-mono text-zinc-600">{tickets.length}</span>
      </div>
      <SortableContext items={tickets.map((t) => `ticket-${t.id}`)} strategy={verticalListSortingStrategy}>
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onOpen={() => onOpen(ticket.id)} />
        ))}
      </SortableContext>
    </div>
  )
}

function resolveTargetStatus(overId: string, tickets: Ticket[]): string | null {
  if (overId.startsWith("column-")) return overId.replace("column-", "")
  if (overId.startsWith("ticket-")) {
    const id = Number(overId.replace("ticket-", ""))
    return tickets.find((t) => t.id === id)?.status ?? null
  }
  return null
}

export function BoardView() {
  const { data: lists } = useTicketConfigLists()
  const { data: tickets = [] } = useTickets()
  const updateStatus = useUpdateTicketStatus()
  const { setOpenTicketId } = useTicketsUI()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const columns = lists?.statuses ?? []

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const ticketId = Number(String(active.id).replace("ticket-", ""))
    const targetStatus = resolveTargetStatus(String(over.id), tickets)
    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket || !targetStatus || ticket.status === targetStatus) return
    updateStatus.mutate({ ticketId, status: targetStatus })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <Column
            key={col.value}
            status={col.value}
            label={col.label}
            tickets={tickets.filter((t) => t.status === col.value)}
            onOpen={setOpenTicketId}
          />
        ))}
      </div>
    </DndContext>
  )
}
