import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

export type LibertadoraView = "dashboard" | "prospectos" | "citas" | "informe"

interface LibertadoraContextValue {
  activeView: LibertadoraView
  setActiveView: (v: LibertadoraView) => void
}

const LibertadoraContext = createContext<LibertadoraContextValue | null>(null)

export function LibertadoraProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<LibertadoraView>("dashboard")
  return (
    <LibertadoraContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </LibertadoraContext.Provider>
  )
}

export function useLibertadora(): LibertadoraContextValue {
  const ctx = useContext(LibertadoraContext)
  if (!ctx) throw new Error("useLibertadora debe usarse dentro de LibertadoraProvider")
  return ctx
}
