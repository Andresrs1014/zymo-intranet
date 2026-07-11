import { TicketsContextProvider } from "@/context/TicketsContext"
import { TicketsShell } from "@/components/tickets/TicketsShell"

export function TicketsPage() {
  return (
    <TicketsContextProvider>
      <TicketsShell />
    </TicketsContextProvider>
  )
}
