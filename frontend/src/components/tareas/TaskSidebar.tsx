import type { ReactNode } from "react"
import {
  List,
  Kanban,
  CalendarDays,
  LayoutDashboard,
  Users,
  Settings,
} from "lucide-react"
import { useTask, type TaskView } from "@/context/TaskContext"
import { useMyTeams } from "@/hooks/useTaskTeams"

interface NavItem {
  view: TaskView
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { view: "list", label: "Lista", icon: <List size={18} /> },
  { view: "board", label: "Tablero", icon: <Kanban size={18} /> },
  { view: "calendar", label: "Calendario", icon: <CalendarDays size={18} /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { view: "people", label: "Personas", icon: <Users size={18} /> },
  { view: "settings", label: "Configuración", icon: <Settings size={18} /> },
]

export function TaskSidebar() {
  const { activeView, setActiveView, activeTeamId, setActiveTeamId } = useTask()
  const { data: teams = [] } = useMyTeams()

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        padding: "24px",
        background: "linear-gradient(180deg, #343b46 0%, #4a5360 46%, #2c333d 100%)",
        color: "#f7fbfa",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.08)",
        minHeight: "100vh",
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "8px",
          background: "rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #ef3340, #ff6b75)",
            color: "#fff",
            fontSize: "1.5rem",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          T
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>Tareas 2.0</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>Gestión de equipos</div>
        </div>
      </div>

      {/* Team selector */}
      {teams.length > 0 && (
        <div>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>
            Equipo activo
          </p>
          <select
            value={activeTeamId ?? ""}
            onChange={(e) => setActiveTeamId(e.target.value ? Number(e.target.value) : null)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id} style={{ background: "#343b46", color: "#fff" }}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV_ITEMS.map(({ view, label, icon }) => {
          const isActive = activeView === view
          return (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                minHeight: "42px",
                padding: "10px 12px",
                border: 0,
                borderRadius: "8px",
                background: isActive ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.04)",
                color: isActive ? "#fff" : "#e5e9ff",
                boxShadow: isActive ? "inset 4px 0 0 #ef3340, 0 6px 18px rgba(0,0,0,0.12)" : "none",
                transform: isActive ? "translateX(2px)" : "none",
                transition: "background 160ms, color 160ms, transform 160ms",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </nav>

      {/* Team info */}
      {activeTeamId && (
        <div
          style={{
            marginTop: "auto",
            padding: "12px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.07)",
          }}
        >
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", margin: 0 }}>
            {teams.find((t) => t.id === activeTeamId)?.name ?? ""}
          </p>
          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", margin: "4px 0 0" }}>
            {teams.find((t) => t.id === activeTeamId)?.memberCount ?? 0} miembros
          </p>
        </div>
      )}
    </aside>
  )
}
