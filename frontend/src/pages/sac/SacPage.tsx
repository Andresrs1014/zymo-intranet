import { SacContextProvider } from "@/context/SacContext"
import { SacShell } from "@/components/sac/SacShell"

export function SacPage() {
  return (
    <SacContextProvider>
      <SacShell />
    </SacContextProvider>
  )
}
