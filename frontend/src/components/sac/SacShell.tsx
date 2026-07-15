import { SidebarProvider } from "@/components/ui/sidebar"
import { useSacUI } from "@/context/SacContext"
import { SacSidebar } from "./SacSidebar"
import { SacTopbar } from "./SacTopbar"
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
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <SacSidebar />
        <main className="min-w-0 flex-1 overflow-auto" style={{ padding: "clamp(14px, 2vw, 24px)" }}>
          <SacTopbar />
          {activeView === "dashboard" && <DashboardView />}
          {activeView === "records" && <RecordsView />}
        </main>
      </div>
      <VisitDialog />
      <SendSurveyDialog />
      <RecordDrawer />
      <TicketToastContainer />
    </SidebarProvider>
  )
}
