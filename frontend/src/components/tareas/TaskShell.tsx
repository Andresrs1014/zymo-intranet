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
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-10 text-center text-zinc-500">
          <div className="text-4xl text-primary">⚠</div>
          <h2 className="m-0 text-lg font-bold text-zinc-900">Algo salió mal</h2>
          <p className="m-0 text-[13px]">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState((s) => ({ hasError: false, message: "", resetKey: s.resetKey + 1 }))}
            className="mt-2 rounded-md bg-primary px-5 py-2 text-[13px] font-bold text-primary-foreground transition hover:brightness-95"
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
          className="min-h-screen bg-background text-foreground"
          style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)" }}
        >
          <TaskSidebar />
          <main
            className="min-w-0 overflow-auto text-foreground"
            style={{ padding: "clamp(14px, 2vw, 24px)" }}
          >
            <TaskTopbar />
            {children}
          </main>
        </div>
        <TaskToastContainer />
      </TaskContextProvider>
    </TaskErrorBoundary>
  )
}
