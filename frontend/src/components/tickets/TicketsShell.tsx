import { SidebarProvider } from "@/components/ui/sidebar"
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <TicketsSidebar />
        <main className="min-w-0 flex-1 overflow-auto" style={{ padding: "clamp(14px, 2vw, 24px)" }}>
          <TicketsTopbar />
          {activeView === "list" && <ListView />}
          {activeView === "board" && <BoardView />}
          {activeView === "dashboard" && <DashboardView />}
        </main>
      </div>
      <TicketDialog />
      <TicketDrawer />
    </SidebarProvider>
  )
}
