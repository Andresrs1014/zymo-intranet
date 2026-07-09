import React, { type ReactNode } from "react"
import { TaskContextProvider } from "@/context/TaskContext"
import { HexagonPattern } from "@/components/ui/hexagon-pattern"
import { TaskSidebar } from "./TaskSidebar"
import { TaskTopbar } from "./TaskTopbar"
import { TaskToastContainer } from "./TaskToast"
import "./tareas.css"

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

function TaskShellInner({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      {/* Fondo decorativo — honeycomb de trazo finísimo + difuminado rojo.
          aria-hidden + pointer-events-none + -z-10: nunca intercepta clicks
          ni lo leen lectores de pantalla. El punto de fuga corre en diagonal
          de abajo-derecha (más marcado) hacia arriba-izquierda (más tenue). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage:
              "radial-gradient(170% 150% at 100% 100%, #000 0%, rgba(0,0,0,0.55) 55%, transparent 92%)",
            maskImage:
              "radial-gradient(170% 150% at 100% 100%, #000 0%, rgba(0,0,0,0.55) 55%, transparent 92%)",
          }}
        >
          {/* Color por style inline, no clase Tailwind: `stroke-{color}` no
              genera CSS en este proyecto (solo stroke-none/stroke-current
              están habilitados) — con la clase, el SVG se pintaba sin color,
              invisible aunque la posición/máscara estuvieran bien. */}
          <HexagonPattern
            radius={46}
            gap={7}
            strokeDasharray="3 6"
            className="fill-none"
            style={{ stroke: "rgba(113, 113, 122, 0.5)" }}
          />
        </div>
        {/* Difuminados rojos: rastro de 4 luces de abajo-derecha (principal,
            fuerte) hacia arriba-izquierda (tenue) — estirado a lo largo de
            toda la diagonal para que se sienta que "llega más lejos". */}
        <div
          className="absolute -bottom-24 h-[520px] w-[720px] rounded-full"
          style={{
            right: "-4vw",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.32) 0%, rgba(196,30,58,0.16) 42%, transparent 72%)",
            filter: "blur(70px)",
          }}
        />
        <div
          className="absolute h-[300px] w-[400px] rounded-full"
          style={{
            bottom: "30vh",
            right: "42vw",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.2) 0%, rgba(196,30,58,0.1) 45%, transparent 72%)",
            filter: "blur(65px)",
          }}
        />
        <div
          className="absolute h-[220px] w-[300px] rounded-full"
          style={{
            bottom: "54vh",
            right: "66vw",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(196,30,58,0.14) 0%, rgba(196,30,58,0.07) 45%, transparent 72%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute h-[200px] w-[260px] rounded-full"
          style={{
            top: "6vh",
            left: "calc(220px + 4vw)",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(196,30,58,0.1) 0%, rgba(196,30,58,0.05) 45%, transparent 72%)",
            filter: "blur(55px)",
          }}
        />
      </div>

      <div
        className="relative grid min-h-screen"
        style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}
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
    </div>
  )
}

export function TaskShell({ children }: TaskShellProps) {
  return (
    <TaskErrorBoundary>
      <TaskContextProvider>
        <TaskShellInner>{children}</TaskShellInner>
        <TaskToastContainer />
      </TaskContextProvider>
    </TaskErrorBoundary>
  )
}
