import { createContext, useContext, useState, type ReactNode } from "react"
import type { TicketView } from "@/types/ticket"

interface TicketsContextValue {
  activeView: TicketView
  setActiveView: (view: TicketView) => void
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  openTicketId: number | null
  setOpenTicketId: (id: number | null) => void
}

const TicketsContext = createContext<TicketsContextValue | null>(null)

export function TicketsContextProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<TicketView>("list")
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  return (
    <TicketsContext.Provider
      value={{
        activeView, setActiveView,
        sidebarExpanded, setSidebarExpanded,
        dialogOpen, setDialogOpen,
        openTicketId, setOpenTicketId,
      }}
    >
      {children}
    </TicketsContext.Provider>
  )
}

export function useTicketsUI() {
  const ctx = useContext(TicketsContext)
  if (!ctx) throw new Error("useTicketsUI debe usarse dentro de TicketsContextProvider")
  return ctx
}
