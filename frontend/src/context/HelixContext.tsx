import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"

export type HelixView =
  | "dashboard"
  | "board"
  | "gantt"
  | "reports"
  | "businessCase"
  | "support"
  | "settings"

interface HelixContextValue {
  activeView: HelixView
  setActiveView: (v: HelixView) => void
  /** Se incrementa cada vez que una actividad se crea desde un punto global
   * (el botón "Gestión de proyecto" de la topbar, siempre montado) — las
   * vistas que mantienen su propia lista de actividades (Scrum, Gantt,
   * Actividades) lo observan para refrescarse sin un estado compartido más pesado. */
  activityVersion: number
  bumpActivityVersion: () => void
}

const HelixContext = createContext<HelixContextValue | null>(null)

interface HelixContextProviderProps {
  children: ReactNode
}

export function HelixContextProvider({ children }: HelixContextProviderProps) {
  const [activeView, setActiveView] = useState<HelixView>("dashboard")
  const [activityVersion, setActivityVersion] = useState(0)

  const bumpActivityVersion = useCallback(() => {
    setActivityVersion((v) => v + 1)
  }, [])

  return (
    <HelixContext.Provider value={{ activeView, setActiveView, activityVersion, bumpActivityVersion }}>
      {children}
    </HelixContext.Provider>
  )
}

export function useHelix(): HelixContextValue {
  const ctx = useContext(HelixContext)
  if (!ctx) {
    throw new Error("useHelix must be used inside HelixContextProvider")
  }
  return ctx
}
