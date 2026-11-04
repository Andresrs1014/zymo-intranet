import { SidebarProvider } from "@/components/ui/sidebar"
import { useSacUI } from "@/context/SacContext"
import { SacSidebar } from "./SacSidebar"
import { SacTopbar } from "./SacTopbar"
import { SacMovil } from "./SacMovil"
import { MovilEspaciador } from "@/components/movil/Movil"
import { DashboardView } from "./views/DashboardView"
import { RecordsView } from "./views/RecordsView"
import { VisitDialog } from "./VisitDialog"
import { SendSurveyDialog } from "./SendSurveyDialog"
import { RecordDrawer } from "./RecordDrawer"
import { TicketToastContainer } from "@/components/tickets/TicketToast"

export function SacShell() {
  const { activeView } = useSacUI()

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background text-foreground">
        <SacSidebar />
        <main className="min-w-0 flex-1 overflow-auto max-md:!p-0 max-md:overflow-visible" style={{ padding: "clamp(14px, 2vw, 24px)" }}>
          <SacMovil parte="superior" />
          <SacTopbar />
          <div className="max-md:p-4">
            {activeView === "dashboard" && <DashboardView />}
            {activeView === "records" && <RecordsView />}
          </div>
          <MovilEspaciador conFab />
        </main>
        <SacMovil parte="inferior" />
      </div>
      <VisitDialog />
      <SendSurveyDialog />
      <RecordDrawer />
      <TicketToastContainer />
    </SidebarProvider>
  )
}
