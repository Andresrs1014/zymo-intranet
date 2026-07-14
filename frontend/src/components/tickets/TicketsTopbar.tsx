import { useTicketsUI } from "@/context/TicketsContext"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { TicketView } from "@/types/ticket"

const VIEW_TITLES: Record<TicketView, string> = {
  list: "Lista de Tickets",
  board: "Tablero de Tickets",
  dashboard: "Dashboard",
}

export function TicketsTopbar() {
  const { activeView, setDialogOpen } = useTicketsUI()

  return (
    <header className="mb-6 flex items-center justify-between gap-2 border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger
          id="tickets-sidebar-trigger"
          className="h-9 w-9 shrink-0 md:hidden"
        />
        <div className="min-w-0">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">Zymo Ally</p>
          <h1 className="m-0 truncate text-lg font-bold leading-tight text-zinc-900 sm:text-xl">{VIEW_TITLES[activeView]}</h1>
        </div>
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
