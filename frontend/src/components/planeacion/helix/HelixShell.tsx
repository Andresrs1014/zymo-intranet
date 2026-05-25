import React, { type ReactNode } from "react"
import { HelixContextProvider } from "@/context/HelixContext"
import { HelixSidebar } from "./HelixSidebar"
import { HelixTopbar } from "./HelixTopbar"
import { HelixToastContainer } from "./HelixToast"

interface HelixShellProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

class HelixErrorBoundary extends React.Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: "" }
  }

  static getDerivedStateFromError(err: unknown): ErrorBoundaryState {
    const message = err instanceof Error ? err.message : "Error inesperado"
    return { hasError: true, message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: 12,
            color: "var(--helix-muted, #5c6374)",
            padding: 40,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 40,
              color: "var(--helix-accent, #ef3340)",
            }}
          >
            ⚠
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--helix-ink, #121420)",
            }}
          >
            Algo salió mal
          </h2>
          <p style={{ margin: 0, fontSize: 13 }}>{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              marginTop: 8,
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              background: "var(--helix-accent, #ef3340)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function HelixShell({ children }: HelixShellProps) {
  return (
    <HelixErrorBoundary>
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
        <HelixToastContainer />
      </HelixContextProvider>
    </HelixErrorBoundary>
  )
}
