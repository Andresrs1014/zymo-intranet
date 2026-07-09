import React, { useEffect, useRef, useState, type ReactNode } from "react"
import { TaskContextProvider, useTask } from "@/context/TaskContext"
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

// Marcadores de profundidad: posición/escala/opacidad ya vienen fijadas por
// data-depth en tareas.css (mismo patrón que el prototipo taskdesk) — acá solo
// se renderiza la cantidad.
const DEPTH_MARKERS = [0, 1, 2, 3, 4]

function TaskShellInner({ children }: { children: ReactNode }) {
  const { activeView } = useTask()
  const [transitioning, setTransitioning] = useState(false)
  const mounted = useRef(false)

  // Transición ambiental: al cambiar de vista, el corredor/rieles/marcadores
  // reaccionan junto con el header (BlurFade) durante ~520ms — "common fate",
  // no una animación aislada del contenido que cambia.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    setTransitioning(true)
    const t = setTimeout(() => setTransitioning(false), 520)
    return () => clearTimeout(t)
  }, [activeView])

  return (
    <div
      className={`relative isolate min-h-screen overflow-hidden bg-background text-foreground ${transitioning ? "is-transitioning" : ""}`}
    >
      {/* Capa de profundidad ambiental — vive DETRÁS del contenido real.
          Corredor con punto de fuga (horizonte + rieles convergentes +
          marcadores que crecen/se aclaran según qué tan "cerca" están,
          adaptado de taskdesk) + honeycomb de trazo finísimo + un difuminado
          rojo. Totalmente decorativa: aria-hidden + pointer-events-none + -z-10,
          nunca intercepta clicks ni la leen lectores de pantalla. El sidebar y
          las tarjetas (blancas) la cubren donde toca, por lo que solo asoma en
          el respiro gris alrededor del contenido. El punto de fuga apunta hacia
          la esquina superior — donde vive el header/la acción principal — para
          reforzar "mira aquí primero", no quedar como adorno sin relación con
          el layout real. */}
      {/* El foco de cada capa se ancla con calc(220px + Nvw), no un % puro del
          viewport — con % puro, a la mayoría de anchos de pantalla el punto
          más visible caía detrás del sidebar (opaco), invisible en la
          práctica. 220px = ancho del sidebar expandido. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div style={{ position: "absolute", inset: 0, left: "calc(220px + 2vw)" }}>
          <div className="depth-scene">
            <div className="depth-horizon" />
            <div className="depth-road" />
            <div className="depth-rails">
              <span />
              <span />
            </div>
            {DEPTH_MARKERS.map((i) => (
              <div key={i} className="depth-marker" data-depth={i} />
            ))}
          </div>
        </div>

        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage:
              "radial-gradient(120% 90% at calc(220px + 12vw) -5%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 75%)",
            maskImage:
              "radial-gradient(120% 90% at calc(220px + 12vw) -5%, #000 0%, rgba(0,0,0,0.5) 45%, transparent 75%)",
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
        {/* Difuminados rojos: un pequeño "ecosistema" de 3 luces (una principal +
            2 satélites más chicos y tenues) en vez de un solo círculo aislado —
            sigue siendo sutil, no busca ser protagonista. */}
        <div
          className="absolute -top-20 h-[520px] w-[720px] rounded-full"
          style={{
            left: "calc(220px + 4vw)",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.32) 0%, rgba(196,30,58,0.16) 42%, transparent 72%)",
            filter: "blur(70px)",
          }}
        />
        <div
          className="absolute top-16 h-[260px] w-[340px] rounded-full"
          style={{
            left: "calc(220px + 22vw)",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(239,51,64,0.16) 0%, rgba(196,30,58,0.08) 45%, transparent 72%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -top-6 h-[200px] w-[260px] rounded-full"
          style={{
            left: "calc(220px - 3vw)",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(196,30,58,0.14) 0%, rgba(196,30,58,0.06) 45%, transparent 72%)",
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
