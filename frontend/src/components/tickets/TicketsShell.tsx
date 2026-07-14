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
        {/* Fondo propio de Tickets (no compartido con el resto de la intranet).
            Dos capas conectadas por la misma paleta de marca, no una textura
            gris sola: grid animado en rojo (opacidad real, no decorativa
            perdida) + blooms de blur rojo — mismo tratamiento de atmósfera
            que ya usa TaskShell en tareas-v2, adaptado a Tickets. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <AnimatedGridPattern
            numSquares={70}
            maxOpacity={0.35}
            duration={3.5}
            repeatDelay={1}
            className={cn(
              "inset-x-0 inset-y-0 h-full fill-primary/25 stroke-primary/25",
              "[mask-image:radial-gradient(1400px_circle_at_15%_0%,white,transparent)]"
            )}
          />
          <div
            className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.28) 0%, rgba(196,30,58,0.14) 45%, transparent 72%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[10%] h-[320px] w-[320px] rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(196,30,58,0.18) 0%, transparent 70%)",
              filter: "blur(55px)",
            }}
          />
        </div>
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
