import { createContext, useContext, useState, type ReactNode } from "react"
import type { SacView, SacRecord } from "@/types/sac"

interface SacContextValue {
  activeView: SacView
  setActiveView: (view: SacView) => void
  visitDialogOpen: boolean
  setVisitDialogOpen: (open: boolean) => void
  sendSurveyOpen: boolean
  setSendSurveyOpen: (open: boolean) => void
  openRecord: SacRecord | null
  setOpenRecord: (record: SacRecord | null) => void
}

const SacContext = createContext<SacContextValue | null>(null)

export function SacContextProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<SacView>("dashboard")
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [sendSurveyOpen, setSendSurveyOpen] = useState(false)
  const [openRecord, setOpenRecord] = useState<SacRecord | null>(null)

  return (
    <SacContext.Provider
      value={{
        activeView, setActiveView,
        visitDialogOpen, setVisitDialogOpen,
        sendSurveyOpen, setSendSurveyOpen,
        openRecord, setOpenRecord,
      }}
    >
      {children}
    </SacContext.Provider>
  )
}

export function useSacUI() {
  const ctx = useContext(SacContext)
  if (!ctx) throw new Error("useSacUI debe usarse dentro de SacContextProvider")
  return ctx
}
