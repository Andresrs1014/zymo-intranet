import { SidebarProvider } from "@/components/ui/sidebar"
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"
import { cn } from "@/lib/utils"
import { useTicketsUI } from "@/context/TicketsContext"
import { TicketsSidebar } from "./TicketsSidebar"
import { TicketsTopbar } from "./TicketsTopbar"
import { ListView } from "./views/ListView"
import { BoardView } from "./views/BoardView"
import { DashboardView } from "./views/DashboardView"
import { TicketDialog } from "./TicketDialog"
import { TicketDrawer } from "./TicketDrawer"
import { TicketToastContainer } from "./TicketToast"

export function TicketsShell() {
  const { activeView } = useTicketsUI()

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-hidden bg-background text-foreground">
        {/* Fondo propio de Tickets, no compartido con el resto de la intranet
            (ver decisión de alcance) — muy baja opacidad, solo textura. */}
        <AnimatedGridPattern
          numSquares={40}
          maxOpacity={0.08}
          duration={3}
          repeatDelay={1}
          className={cn(
            "-z-10 [mask-image:radial-gradient(1200px_circle_at_center,white,transparent)]",
            "inset-x-0 inset-y-[-10%] h-[120%]"
          )}
        />
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
      <TicketToastContainer />
    </SidebarProvider>
  )
}
