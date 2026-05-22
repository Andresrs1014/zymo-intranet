import { HelixProvider } from "@/components/planeacion/helix/HelixProvider"

export function HelixPage() {
  return (
    <HelixProvider>
      <div className="flex items-center justify-center h-full text-helix-muted">
        <p>Helix Zymo — cargando...</p>
      </div>
    </HelixProvider>
  )
}
