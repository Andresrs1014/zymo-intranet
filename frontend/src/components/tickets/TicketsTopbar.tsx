import { useTicketsUI } from "@/context/TicketsContext"
import { ShimmerButton } from "@/components/ui/shimmer-button"
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
      <ShimmerButton
        type="button"
        onClick={() => setDialogOpen(true)}
        className="min-h-[40px] shrink-0"
      >
        + Nuevo ticket
      </ShimmerButton>
    </header>
  )
}
