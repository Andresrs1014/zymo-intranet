import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import {
  Inbox,
  List,
  Kanban,
  CalendarDays,
  LayoutDashboard,
  Users,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useTask, type TaskView } from "@/context/TaskContext"
import { useMyTeams, useCreateTeam } from "@/hooks/useTaskTeams"
import { useMyTasks } from "@/hooks/useTasks"
import { countPendingForMe } from "@/lib/taskWork"
import { useAuthStore } from "@/store/authStore"
import "./tareas.css"

interface NavItem {
  view: TaskView
  label: string
  icon: ReactNode
  managerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { view: "mywork",    label: "Mi trabajo",      icon: <Inbox size={18} /> },
  { view: "list",      label: "Lista",          icon: <List size={18} /> },
  { view: "board",     label: "Tablero",         icon: <Kanban size={18} /> },
  { view: "calendar",  label: "Calendario",      icon: <CalendarDays size={18} /> },
  { view: "dashboard", label: "Dashboard",       icon: <LayoutDashboard size={18} />, managerOnly: true },
  { view: "people",    label: "Personas",        icon: <Users size={18} />, managerOnly: true },
  { view: "settings",  label: "Configuración",   icon: <Settings size={18} />, managerOnly: true },
]

// Generate a deterministic color for a team based on its id
function teamColor(id: number) {
  const palette = ["#c41e3a", "#0891b2", "#059669", "#d97706", "#0284c7", "#db2777"]
  return palette[id % palette.length]
}

export function TaskSidebar() {
  const { activeView, setActiveView, activeTeamId, setActiveTeamId, myRole, setTeams } = useTask()
  const { data: teams = [], isLoading } = useMyTeams()
  const createTeam = useCreateTeam()
  const { user } = useAuthStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState("")
  const [expanded, setExpanded] = useState(true)

  const isGestor = user?.user_tools?.includes("tool_task_manage_dev") ?? false
  const isManager = myRole === "owner" || myRole === "co_gestor"

  // Badge cross-team: tareas asignadas a mí, aún sin aceptar.
  const { data: myWork } = useMyTasks()
  const pendingCount = countPendingForMe(myWork?.tasks ?? [], user?.id ?? null)

  useEffect(() => {
    setTeams(teams)
    if (!activeTeamId && teams.length > 0) {
      setActiveTeamId(teams[0].id)
    }
  }, [teams, activeTeamId, setActiveTeamId, setTeams])

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return
    const team = await createTeam.mutateAsync(newTeamName.trim())
    setActiveTeamId(team.id)
    setShowCreateForm(false)
    setNewTeamName("")
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.managerOnly || isManager)
  const activeTeam = teams.find((t) => t.id === activeTeamId)

  const sidebarWidth = expanded ? 220 : 64

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: expanded ? "flex-start" : "center",
        gap: 8,
        padding: "16px 8px",
        background: "#ffffff",
        borderRight: "2px solid #18181b",
        minHeight: "100vh",
        width: sidebarWidth,
        transition: "width 220ms ease",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Brand + toggle row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: expanded ? "space-between" : "center", width: "100%", paddingLeft: expanded ? 4 : 0, paddingRight: expanded ? 4 : 0, marginBottom: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(135deg, #c41e3a, #ef3340)",
            color: "#fff",
            fontSize: "1.1rem",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(196,30,58,0.30)",
            flexShrink: 0,
          }}
        >
          T
        </div>
        {expanded && (
          <div style={{ marginLeft: 8, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#18181b", whiteSpace: "nowrap" }}>Tareas 2.0</div>
            <div style={{ fontSize: 10, color: "#71717a", whiteSpace: "nowrap" }}>Gestión de equipos</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="task-sidebar-toggle"
          data-label={expanded ? "Colapsar" : "Expandir"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "1px solid #e4e4e7",
            background: "#f4f4f5",
            color: "#52525b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginLeft: expanded ? 4 : 0,
          }}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: expanded ? "100%" : 32, height: 1, background: "#e4e4e7", marginBottom: 4 }} />

      {/* Team circles */}
      {!isLoading && teams.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", alignItems: expanded ? "flex-start" : "center", paddingLeft: expanded ? 4 : 0 }}>
          {teams.map((team) => {
            const isSelected = team.id === activeTeamId
            const color = teamColor(team.id)
            const initial = team.name.charAt(0).toUpperCase()
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setActiveTeamId(team.id)}
                data-label={!expanded ? team.name : undefined}
                className={`task-nav-icon task-team-btn${isSelected ? " selected" : ""}`}
                style={{
                  width: expanded ? "100%" : 36,
                  height: 36,
                  borderRadius: 8,
                  border: isSelected ? "none" : `1px solid ${color}33`,
                  background: isSelected ? color : `${color}14`,
                  color: isSelected ? "#fff" : color,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: expanded ? "flex-start" : "center",
                  gap: 8,
                  paddingLeft: expanded ? 8 : 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                <span style={{ flexShrink: 0 }}>{initial}</span>
                {expanded && <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</span>}
              </button>
            )
          })}

          {/* Create team button (gestores only) */}
          {isGestor && !showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              data-label="Crear equipo"
              className="task-nav-icon"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px dashed #d4d4d8",
                background: "transparent",
                color: "#71717a",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={14} />
            </button>
          )}

          {/* Inline create form */}
          {isGestor && showCreateForm && (
            <div style={{ width: 36, display: "flex", flexDirection: "column", gap: 4 }}>
              <input
                autoFocus
                placeholder="Nombre"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTeam()
                  if (e.key === "Escape") { setShowCreateForm(false); setNewTeamName("") }
                }}
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  borderRadius: 5,
                  border: "1px solid #d4d4d8",
                  background: "#fff",
                  color: "#18181b",
                  fontSize: 11,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={handleCreateTeam}
                disabled={createTeam.isPending}
                style={{ padding: "3px 0", borderRadius: 4, border: "none", background: "#c41e3a", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", width: "100%" }}
              >
                {createTeam.isPending ? "…" : "OK"}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setNewTeamName("") }}
                style={{ padding: "3px 0", borderRadius: 4, border: "1px solid #e4e4e7", background: "transparent", color: "#71717a", fontSize: 10, cursor: "pointer", width: "100%" }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state — no teams, no gestor */}
      {!isLoading && teams.length === 0 && !isGestor && (
        <div
          data-label="Sin equipo asignado"
          className="task-nav-icon"
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: "#f4f4f5",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#a1a1aa", fontSize: 18,
          }}
        >
          ?
        </div>
      )}

      {/* Divider */}
      <div style={{ width: 32, height: 1, background: "#e4e4e7", margin: "4px 0" }} />

      {/* Navigation icons */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%", alignItems: expanded ? "flex-start" : "center", paddingLeft: expanded ? 4 : 0 }}>
        {visibleNav.map(({ view, label, icon }) => {
          const isActive = activeView === view
          const showBadge = view === "mywork" && pendingCount > 0
          return (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              data-label={!expanded ? label : undefined}
              className={`task-nav-icon${isActive ? " active" : ""}`}
              style={{
                width: expanded ? "100%" : 40,
                height: 40,
                border: "none",
                borderRadius: 8,
                background: isActive ? "rgba(196,30,58,0.10)" : "transparent",
                color: isActive ? "#c41e3a" : "#52525b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: expanded ? "flex-start" : "center",
                gap: expanded ? 10 : 0,
                paddingLeft: expanded ? 10 : 0,
                paddingRight: expanded ? 10 : 0,
                position: "relative",
                whiteSpace: "nowrap",
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span style={{
                  position: "absolute",
                  left: 2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 18,
                  borderRadius: 2,
                  background: "#c41e3a",
                }} />
              )}
              {icon}
              {expanded && <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500 }}>{label}</span>}

              {/* Badge de pendientes de aceptar */}
              {showBadge && expanded && (
                <span style={{
                  marginLeft: "auto",
                  background: "#d97706",
                  color: "#fff",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 800,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {pendingCount}
                </span>
              )}
              {showBadge && !expanded && (
                <span style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
                  borderRadius: 99,
                  background: "#d97706",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom: role chip */}
      <div style={{ marginTop: "auto" }}>
        {activeTeam && (
          <div
            data-label={`${activeTeam.name} · ${myRole === "owner" ? "Gestor" : myRole === "co_gestor" ? "Co-gestor" : "Colaborador"}`}
            className="task-nav-icon"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#f4f4f5",
              border: "1px solid #e4e4e7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#71717a",
              fontSize: 10,
              fontWeight: 700,
              cursor: "default",
            }}
          >
            {myRole === "owner" ? "G" : myRole === "co_gestor" ? "C" : "M"}
          </div>
        )}
      </div>
    </aside>
  )
}
