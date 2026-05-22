import type { ReactNode } from "react"
import "@/styles/helix.css"

interface HelixProviderProps {
  children: ReactNode
}

export function HelixProvider({ children }: HelixProviderProps) {
  return (
    <div data-module="helix" className="font-helix h-full">
      {children}
    </div>
  )
}
