import { HelixProvider } from "@/components/planeacion/helix/HelixProvider"
import { HelixShell } from "@/components/planeacion/helix/HelixShell"
import { useHelix } from "@/context/HelixContext"
import { BoardView } from "@/components/planeacion/helix/board/BoardView"

function HelixContent() {
  const { activeView } = useHelix()

  return (
    <div>
      {activeView === "dashboard" && (
        <div className="text-helix-muted text-sm p-4">
          Panel — próximamente
        </div>
      )}
      {activeView === "board" && <BoardView />}
      {activeView === "gantt" && (
        <div className="text-helix-muted text-sm p-4">
          Gantt — próximamente
        </div>
      )}
      {activeView === "reports" && (
        <div className="text-helix-muted text-sm p-4">
          Estados — próximamente
        </div>
      )}
      {activeView === "businessCase" && (
        <div className="text-helix-muted text-sm p-4">
          Valor ROI — próximamente
        </div>
      )}
      {activeView === "support" && (
        <div className="text-helix-muted text-sm p-4">
          Soporte — próximamente
        </div>
      )}
      {activeView === "settings" && (
        <div className="text-helix-muted text-sm p-4">
          Config — próximamente
        </div>
      )}
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
