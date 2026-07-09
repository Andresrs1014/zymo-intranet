import React, { type ReactNode } from "react"
import { TaskContextProvider } from "@/context/TaskContext"
import { HexagonPattern } from "@/components/ui/hexagon-pattern"
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
        <div className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
          {/* Capa de profundidad ambiental — vive DETRÁS del contenido real.
              Honeycomb SVG de trazo finísimo (zinc ~10%, contorno punteado, sin
              relleno) enmascarado hacia la esquina superior izquierda, más un
              pooling rojo apagado que hace eco del acento del topbar/sidebar.
              Totalmente decorativa: aria-hidden + pointer-events-none + -z-10,
              así que nunca intercepta clicks ni la leen lectores de pantalla.
              El sidebar (blanco) y las tarjetas (blancas) la cubren donde toca,
              por lo que solo asoma en el respiro gris alrededor del contenido. */}
          {/* El foco del patrón/difuminado se ancla con calc(220px + Nvw), no un %
              puro del viewport — con % puro, a la mayoría de anchos de pantalla el
              punto más visible caía detrás del sidebar (opaco), así que en la
              práctica no se veía nada. 220px = ancho del sidebar expandido. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage:
                  "radial-gradient(120% 90% at calc(220px + 12vw) -5%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 75%)",
                maskImage:
                  "radial-gradient(120% 90% at calc(220px + 12vw) -5%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 75%)",
              }}
            >
              <HexagonPattern
                radius={46}
                gap={7}
                strokeDasharray="3 6"
                className="fill-none stroke-zinc-500/18"
              />
            </div>
            {/* Difuminado rojo: foco atmosférico dentro del área de contenido real
                (a la derecha del sidebar), no un fondo rojo pleno. */}
            <div
              className="absolute -top-20 h-[520px] w-[720px] rounded-full opacity-80 blur-[90px]"
              style={{
                left: "calc(220px + 4vw)",
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.18) 0%, rgba(196,30,58,0.09) 42%, transparent 72%)",
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
        <TaskToastContainer />
      </TaskContextProvider>
    </TaskErrorBoundary>
  )
}
