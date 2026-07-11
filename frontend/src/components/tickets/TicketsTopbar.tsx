import { useTicketsUI } from "@/context/TicketsContext"
import type { TicketView } from "@/types/ticket"

const VIEW_TITLES: Record<TicketView, string> = {
  list: "Lista de Tickets",
  board: "Tablero de Tickets",
  dashboard: "Dashboard",
}

export function TicketsTopbar() {
  const { activeView, setDialogOpen } = useTicketsUI()

  return (
    <header className="mb-6 flex items-center justify-between gap-4 border border-zinc-200 bg-white px-6 py-4 shadow-sm">
      <div>
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">Zymo Ally</p>
        <h1 className="m-0 text-xl font-bold leading-tight text-zinc-900">{VIEW_TITLES[activeView]}</h1>
      </div>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:brightness-95"
      >
        + Nuevo ticket
      </button>
    </header>
  )
}
