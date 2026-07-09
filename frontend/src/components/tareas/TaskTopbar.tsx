import { useTask, type TaskView } from "@/context/TaskContext"
import { ShineBorder } from "@/components/ui/shine-border"
import { BlurFade } from "@/components/ui/blur-fade"
import "./tareas.css"

const VIEW_TITLES: Record<TaskView, string> = {
  mywork: "Mi trabajo",
  list: "Lista de Tareas",
  board: "Tablero Scrum",
  calendar: "Calendario",
  dashboard: "Dashboard",
  settings: "Configuración",
}

export function TaskTopbar() {
  const { activeView, onNewTask } = useTask()
  const title = VIEW_TITLES[activeView]

  return (
    // Header cuadrado (sin rounded) con profundidad REAL: sombra de contacto que lo
    // asienta sobre la página + ShineBorder (Magic UI) como rim animado rojo/blanco.
    // El shine hereda el radio (0) del header → el borde con dimensión es parte del
    // mismo plano, no una decoración pegada encima.
    <header className="relative mb-6 flex items-center justify-between gap-4 overflow-hidden border border-zinc-200 bg-white px-6 py-4 shadow-[0_12px_28px_-18px_rgba(24,24,27,0.45)]">
      <ShineBorder
        shineColor={["#c41e3a", "#ef3340", "#ffffff"]}
        borderWidth={1.5}
        duration={12}
      />

      {/* Transición suave del título al cambiar de vista: se remonta por `key` y
          reproduce el blur-fade de Magic UI. */}
      <BlurFade key={activeView} direction="up" offset={8} duration={0.35} className="min-w-0">
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">
          Gestión de Tareas 2.0
        </p>
        <h1 className="m-0 text-xl font-bold leading-tight text-zinc-900">{title}</h1>
      </BlurFade>

      {(activeView === "mywork" || activeView === "list" || activeView === "board") && (
        <button
          className="task-primary-btn relative z-10 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm"
          onClick={onNewTask}
        >
          + Nueva tarea
        </button>
      )}
    </header>
  )
}
