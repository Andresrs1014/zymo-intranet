import type { ReactNode } from "react"
import { HelixContextProvider } from "@/context/HelixContext"
import { HelixSidebar } from "./HelixSidebar"
import { HelixTopbar } from "./HelixTopbar"

interface HelixShellProps {
  children: ReactNode
}

export function HelixShell({ children }: HelixShellProps) {
  return (
    <HelixContextProvider>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px minmax(0, 1fr)",
          minHeight: "100vh",
        }}
      >
        <HelixSidebar />
        <main style={{ padding: "26px", overflow: "auto" }}>
          <HelixTopbar />
          {children}
        </main>
      </div>
    </HelixContextProvider>
  )
}
