import React, { type ReactNode } from "react"
import { TaskContextProvider } from "@/context/TaskContext"
import { TaskSidebar } from "./TaskSidebar"
import { TaskTopbar } from "./TaskTopbar"
import { TaskToastContainer } from "./TaskToast"

interface TaskShellProps {
  children: ReactNode
}

interface EBState {
  hasError: boolean
  message: string
  resetKey: number
}

class TaskErrorBoundary extends React.Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: "", resetKey: 0 }
  }

  static getDerivedStateFromError(err: unknown): Partial<EBState> {
    return { hasError: true, message: err instanceof Error ? err.message : "Error inesperado" }
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
            color: "#5c6374",
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, color: "#ef3340" }}>⚠</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121420" }}>
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
              background: "#ef3340",
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

export function TaskShell({ children }: TaskShellProps) {
  return (
    <TaskErrorBoundary>
      <TaskContextProvider>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0, 1fr)",
            minHeight: "100vh",
          }}
        >
          <TaskSidebar />
          <main style={{ padding: "clamp(14px, 2vw, 24px)", overflow: "auto", minWidth: 0 }}>
            <TaskTopbar />
            {children}
          </main>
        </div>
        <TaskToastContainer />
      </TaskContextProvider>
    </TaskErrorBoundary>
  )
}
