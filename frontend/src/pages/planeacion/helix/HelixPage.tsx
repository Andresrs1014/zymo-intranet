import { HelixProvider } from "@/components/planeacion/helix/HelixProvider"
import { HelixShell } from "@/components/planeacion/helix/HelixShell"
import { useHelix } from "@/context/HelixContext"

function HelixContent() {
  const { activeView } = useHelix()
  return (
    <div className="text-helix-muted text-sm">
      Vista activa: {activeView} — en construcción
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
