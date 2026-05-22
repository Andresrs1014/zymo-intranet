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
  onNewTask: () => void
  setOnNewTask: (fn: () => void) => void
}

const HelixContext = createContext<HelixContextValue | null>(null)

interface HelixContextProviderProps {
  children: ReactNode
}

export function HelixContextProvider({ children }: HelixContextProviderProps) {
  const [activeView, setActiveView] = useState<HelixView>("dashboard")
  const [onNewTask, setOnNewTaskState] = useState<() => void>(() => () => undefined)

  const setOnNewTask = useCallback((fn: () => void) => {
    setOnNewTaskState(() => fn)
  }, [])

  return (
    <HelixContext.Provider value={{ activeView, setActiveView, onNewTask, setOnNewTask }}>
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
