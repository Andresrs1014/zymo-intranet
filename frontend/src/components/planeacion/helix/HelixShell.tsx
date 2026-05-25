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
  resetKey: number
}

class HelixErrorBoundary extends React.Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: "", resetKey: 0 }
  }

  static getDerivedStateFromError(err: unknown): Partial<ErrorBoundaryState> {
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
            onClick={() => this.setState((s) => ({ hasError: false, message: "", resetKey: s.resetKey + 1 }))}
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
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
  }
}

export function HelixShell({ children }: HelixShellProps) {
  return (
    <HelixErrorBoundary>
      <HelixContextProvider>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "clamp(220px, 22vw, 280px) minmax(0, 1fr)",
            minHeight: "100vh",
          }}
        >
          <HelixSidebar />
          <main style={{ padding: "clamp(14px, 2vw, 26px)", overflow: "auto", minWidth: 0 }}>
            <HelixTopbar />
            {children}
          </main>
        </div>
        <HelixToastContainer />
      </HelixContextProvider>
    </HelixErrorBoundary>
  )
}
