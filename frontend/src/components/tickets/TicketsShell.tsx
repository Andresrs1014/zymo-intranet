import { useTicketsUI } from "@/context/TicketsContext"
import { TicketsSidebar } from "./TicketsSidebar"
import { TicketsTopbar } from "./TicketsTopbar"
import { ListView } from "./views/ListView"
import { BoardView } from "./views/BoardView"
import { DashboardView } from "./views/DashboardView"
import { TicketDialog } from "./TicketDialog"
import { TicketDrawer } from "./TicketDrawer"

export function TicketsShell() {
  const { activeView } = useTicketsUI()

  return (
    <div className="grid min-h-screen bg-background text-foreground" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
      <TicketsSidebar />
      <main className="min-w-0 overflow-auto" style={{ padding: "clamp(14px, 2vw, 24px)" }}>
        <TicketsTopbar />
        {activeView === "list" && <ListView />}
        {activeView === "board" && <BoardView />}
        {activeView === "dashboard" && <DashboardView />}
      </main>
      <TicketDialog />
      <TicketDrawer />
    </div>
  )
}
