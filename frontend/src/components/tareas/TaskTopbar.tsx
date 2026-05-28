import type { CSSProperties } from "react"
import { useTask, type TaskView } from "@/context/TaskContext"
import "./tareas.css"

const VIEW_TITLES: Record<TaskView, string> = {
  list: "Lista de Tareas",
  board: "Tablero Scrum",
  calendar: "Calendario",
  dashboard: "Dashboard",
  people: "Personas",
  settings: "Configuración",
}

const BASE_BTN: CSSProperties = {
  minHeight: "40px",
  border: "1px solid",
  borderRadius: "8px",
  font: "inherit",
  cursor: "pointer",
  fontWeight: 700,
}

const PRIMARY_BTN: CSSProperties = {
  ...BASE_BTN,
  padding: "0 18px",
  borderColor: "#fff",
  background: "#fff",
  color: "#3f4652",
  boxShadow: "0 8px 20px rgba(239,51,64,0.18)",
}

export function TaskTopbar() {
  const { activeView, onNewTask } = useTask()
  const title = VIEW_TITLES[activeView]

  return (
    <header
      style={{
        padding: "18px 22px",
        borderRadius: "8px",
        marginBottom: "24px",
        background:
          "linear-gradient(135deg, rgba(52,59,70,0.98), rgba(74,83,96,0.95) 58%, rgba(239,51,64,0.82))",
        boxShadow: "0 16px 40px rgba(23,26,31,0.18)",
        border: "1px solid rgba(255,255,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "2px",
          }}
        >
          Gestión de Tareas 2.0
        </p>
        <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
          {title}
        </h1>
      </div>

      {(activeView === "list" || activeView === "board") && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button style={PRIMARY_BTN} className="task-primary-btn" onClick={onNewTask}>
            + Nueva tarea
          </button>
        </div>
      )}
    </header>
  )
}
