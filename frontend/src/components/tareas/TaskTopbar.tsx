import { useTask, type TaskView } from "@/context/TaskContext"
import "./tareas.css"

const VIEW_TITLES: Record<TaskView, string> = {
  mywork: "Mi trabajo",
  list: "Lista de Tareas",
  board: "Tablero Scrum",
  calendar: "Calendario",
  dashboard: "Dashboard",
  people: "Personas",
  settings: "Configuración",
}

export function TaskTopbar() {
  const { activeView, onNewTask } = useTask()
  const title = VIEW_TITLES[activeView]

  return (
    <header className="mb-6 flex items-center justify-between gap-4 rounded-lg border-2 border-zinc-900 bg-white px-6 py-4 shadow-sm">
      <div>
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">
          Gestión de Tareas 2.0
        </p>
        <h1 className="m-0 text-xl font-bold leading-tight text-zinc-900">{title}</h1>
      </div>

      {(activeView === "mywork" || activeView === "list" || activeView === "board") && (
        <button
          className="task-primary-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm"
          onClick={onNewTask}
        >
          + Nueva tarea
        </button>
      )}
    </header>
  )
}
