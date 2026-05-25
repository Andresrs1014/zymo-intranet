import type { ReactNode } from "react"
import "@/styles/helix.css"

interface HelixProviderProps {
  children: ReactNode
}

const SPIN_STYLE = `
@keyframes helix-spin {
  to { transform: rotate(360deg); }
}
`

export function HelixProvider({ children }: HelixProviderProps) {
  return (
    <div data-module="helix" className="font-helix h-full">
      <style>{SPIN_STYLE}</style>
      {children}
    </div>
  )
}
