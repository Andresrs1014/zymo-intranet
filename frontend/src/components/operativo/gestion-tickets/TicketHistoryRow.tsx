import { Badge } from "@/components/ui/badge"
import { formatSlaHours } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

function isResuelto(t: Ticket): boolean {
  return /cerrado/i.test(t.status)
}

interface TicketHistoryRowProps {
  ticket: Ticket
  onClick: () => void
}

export function TicketHistoryRow({ ticket, onClick }: TicketHistoryRowProps) {
  const resuelto = isResuelto(ticket)
  const overdue = ticket.slaOverdue === true && !resuelto

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:border-primary/40 hover:shadow-sm ${
        overdue ? "border-destructive/30" : "border-border"
      }`}
    >
      {/* Rail de resultado — como el borde de victoria/derrota en un historial de partidas */}
      <div className={`h-10 w-1 shrink-0 rounded-full ${resuelto ? "bg-emerald-500" : overdue ? "bg-destructive" : "bg-muted-foreground/30"}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">{ticket.code}</span>
          <Badge variant="outline" className="text-[10px]">{ticket.type}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {ticket.area}
          {ticket.platform ? ` · ${ticket.platform}` : ""}
          {ticket.description ? ` — ${ticket.description}` : ""}
        </p>
      </div>

      <div className="hidden shrink-0 sm:flex flex-col items-end gap-1">
        <Badge variant={resuelto ? "success" : overdue ? "destructive" : "secondary"} className="text-[10px]">
          {ticket.status}
        </Badge>
        {ticket.slaLimitHours != null && (
          <span className={`text-[10px] tabular-nums ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {formatSlaHours(ticket.slaElapsedHours)} / {formatSlaHours(ticket.slaLimitHours)} SLA
          </span>
        )}
      </div>

      <div className="shrink-0 text-xs text-muted-foreground tabular-nums w-20 text-right">{ticket.date}</div>
    </button>
  )
}
