import { Badge } from "@/components/ui/badge"
import { formatSlaHours } from "@/lib/ticketWork"
import type { Ticket } from "@/types/ticket"

function isResuelto(t: Ticket): boolean {
  return /cerrado/i.test(t.status)
}

function scoreVariant(score: number): "success" | "warning" | "destructive" {
  if (score >= 75) return "success"
  if (score >= 50) return "warning"
  return "destructive"
}

interface TicketGerenciaRowProps {
  ticket: Ticket
  onClick: () => void
}

/** Fila de la vista "Todos los tickets" (mod_tickets_gerencia) — mismo lenguaje
 * visual de TicketHistoryRow (rail + código), pero con quién está a cargo y su
 * score de gestión visibles, como el historial de partidas de un OP.GG. */
export function TicketGerenciaRow({ ticket, onClick }: TicketGerenciaRowProps) {
  const resuelto = isResuelto(ticket)
  const overdue = ticket.slaOverdue === true && !resuelto
  const asignados = [ticket.supervisor, ...ticket.analysts].filter(Boolean).join(" → ")

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:border-primary/40 hover:shadow-sm ${
        overdue ? "border-destructive/30" : "border-border"
      }`}
    >
      <div className={`h-10 w-1 shrink-0 rounded-full ${resuelto ? "bg-emerald-500" : overdue ? "bg-destructive" : "bg-muted-foreground/30"}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">{ticket.code}</span>
          <Badge variant="outline" className="text-[10px]">{ticket.type}</Badge>
          {ticket.status === "Pendiente validacion" && (
            <Badge variant="warning" className="text-[10px]">Espera tu validación</Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {asignados || "Sin asignar"}
          {ticket.platform ? ` · ${ticket.platform}` : ""}
        </p>
      </div>

      <div className="hidden shrink-0 md:flex flex-col items-end gap-1">
        <Badge variant={resuelto ? "success" : overdue ? "destructive" : "secondary"} className="text-[10px]">
          {ticket.status}
        </Badge>
        {ticket.slaLimitHours != null && (
          <span className={`text-[10px] tabular-nums ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {formatSlaHours(ticket.slaElapsedHours)} / {formatSlaHours(ticket.slaLimitHours)} SLA
          </span>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1 w-16">
        <Badge variant={scoreVariant(ticket.qualityScore)} className="text-[10px] tabular-nums">
          {ticket.qualityScore} pts
        </Badge>
        <span className="text-[10px] text-muted-foreground tabular-nums">{ticket.date}</span>
      </div>
    </button>
  )
}
