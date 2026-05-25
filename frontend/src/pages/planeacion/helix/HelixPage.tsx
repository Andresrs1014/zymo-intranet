import { HelixProvider } from "@/components/planeacion/helix/HelixProvider"
import { HelixShell } from "@/components/planeacion/helix/HelixShell"
import { useHelix } from "@/context/HelixContext"
import { BoardView } from "@/components/planeacion/helix/board/BoardView"
import { GanttView } from "@/components/planeacion/helix/gantt/GanttView"
import { SettingsView } from "@/components/planeacion/helix/settings/SettingsView"
import { DashboardView } from "@/components/planeacion/helix/dashboard/DashboardView"
import { ReportsView } from "@/components/planeacion/helix/reports/ReportsView"
import { SupportView } from "@/components/planeacion/helix/support/SupportView"
import { BusinessCaseView } from "@/components/planeacion/helix/business-case/BusinessCaseView"

function HelixContent() {
  const { activeView } = useHelix()

  return (
    <div>
      {activeView === "dashboard" && <DashboardView />}
      {activeView === "board" && <BoardView />}
      {activeView === "gantt" && <GanttView />}
      {activeView === "reports" && <ReportsView />}
      {activeView === "businessCase" && <BusinessCaseView />}
      {activeView === "support" && <SupportView />}
      {activeView === "settings" && <SettingsView />}
    </div>
  )
}

export function HelixPage() {
  return (
    <HelixProvider>
      <HelixShell>
        <HelixContent />
      </HelixShell>
    </HelixProvider>
  )
}
