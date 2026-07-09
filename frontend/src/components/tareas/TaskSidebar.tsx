import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import {
  Inbox,
  List,
  Kanban,
  CalendarDays,
  LayoutDashboard,
  Users,
  Users2,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { useTask, type TaskView } from "@/context/TaskContext"
import { useMyTeams, useCreateTeam } from "@/hooks/useTaskTeams"
import { useMyTasks } from "@/hooks/useTasks"
import { countPendingForMe } from "@/lib/taskWork"
import { useAuthStore } from "@/store/authStore"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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

export function TaskSidebar() {
  const {
    activeView, setActiveView, activeTeamId, setActiveTeamId, myRole, setTeams,
    sidebarExpanded: expanded, setSidebarExpanded: setExpanded,
  } = useTask()
  const { data: teams = [], isLoading } = useMyTeams()
  const createTeam = useCreateTeam()
  const { user } = useAuthStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState("")

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
        borderRight: "1px solid #e4e4e7",
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
          onClick={() => setExpanded(!expanded)}
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

      {/* ── Equipos ──────────────────────────────────────────────────────
          Desplegable (Collapsible shadcn) con items cuadrados blancos que se
          vuelven rojos al seleccionar. Sin color-por-equipo: paleta blanco+rojo,
          el rojo solo marca el equipo activo. */}
      {!isLoading && teams.length > 0 && expanded && (
        <Collapsible defaultOpen className="w-full">
          <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:bg-zinc-50">
            <span className="flex items-center gap-2">
              <Users2 size={14} /> Equipos
            </span>
            <ChevronDown size={14} className="transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 flex flex-col gap-1">
            {teams.map((team) => {
              const isSelected = team.id === activeTeamId
              const initial = team.name.charAt(0).toUpperCase()
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setActiveTeamId(team.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                    isSelected
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {initial}
                  </span>
                  <span className="truncate">{team.name}</span>
                </button>
              )
            })}

            {/* Crear equipo (solo gestores) */}
            {isGestor && !showCreateForm && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-zinc-300 px-2.5 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Plus size={14} /> Crear equipo
              </button>
            )}

            {isGestor && showCreateForm && (
              <div className="flex flex-col gap-1.5 rounded-md border border-zinc-200 p-2">
                <input
                  autoFocus
                  placeholder="Nombre del equipo"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTeam()
                    if (e.key === "Escape") { setShowCreateForm(false); setNewTeamName("") }
                  }}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-[12px] text-zinc-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateTeam}
                    disabled={createTeam.isPending}
                    className="flex-1 rounded-md bg-primary py-1.5 text-[11px] font-bold text-primary-foreground transition hover:brightness-95"
                  >
                    {createTeam.isPending ? "…" : "Crear"}
                  </button>
                  <button
                    onClick={() => { setShowCreateForm(false); setNewTeamName("") }}
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Colapsado: iconos cuadrados de equipo (blanco → rojo al seleccionar) */}
      {!isLoading && teams.length > 0 && !expanded && (
        <div className="flex w-full flex-col items-center gap-1.5">
          {teams.map((team) => {
            const isSelected = team.id === activeTeamId
            const initial = team.name.charAt(0).toUpperCase()
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setActiveTeamId(team.id)}
                data-label={team.name}
                className={`task-nav-icon flex h-9 w-9 items-center justify-center rounded-md border text-[13px] font-bold transition-colors ${
                  isSelected
                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {initial}
              </button>
            )
          })}
          {isGestor && (
            <button
              type="button"
              onClick={() => { setExpanded(true); setShowCreateForm(true) }}
              data-label="Crear equipo"
              className="task-nav-icon flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Plus size={14} />
            </button>
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
                  background: "#c41e3a",
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
                  background: "#c41e3a",
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
