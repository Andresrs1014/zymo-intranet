import type { ReactNode } from "react"
import "@/styles/helix.css"

interface HelixProviderProps {
  children: ReactNode
}

const SPIN_STYLE = `
@keyframes helix-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes helix-spin-progress {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
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
