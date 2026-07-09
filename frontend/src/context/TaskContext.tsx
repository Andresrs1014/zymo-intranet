import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import type { Team } from "@/types/task"

export type TaskView =
  | "mywork"
  | "list"
  | "board"
  | "calendar"
  | "dashboard"
  | "people"
  | "settings"

const VALID_VIEWS: TaskView[] = ["mywork", "list", "board", "calendar", "dashboard", "people", "settings"]

export type TeamRole = "owner" | "co_gestor" | "member" | null

export interface TaskFiltersState {
  search?: string
  estado?: string
  etiqueta?: string
  plataforma?: string
  fechaDesde?: string
  fechaHasta?: string
  responsableId?: number
  prioridad?: string
}

interface TaskContextValue {
  activeView: TaskView
  setActiveView: (v: TaskView) => void
  activeTeamId: number | null
  setActiveTeamId: (id: number | null) => void
  myRole: TeamRole
  setTeams: (teams: Team[]) => void
  filters: TaskFiltersState
  setFilters: (f: TaskFiltersState) => void
  onNewTask: () => void
  setOnNewTask: (fn: () => void) => void
  /** Ancho actual del sidebar en px — el Drawer lo usa para arrancar justo donde termina el sidebar. */
  sidebarWidth: number
  sidebarExpanded: boolean
  setSidebarExpanded: (v: boolean) => void
}

export const SIDEBAR_WIDTH_EXPANDED = 220
export const SIDEBAR_WIDTH_COLLAPSED = 64

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskContextProvider({ children }: { children: ReactNode }) {
  // activeView/activeTeamId viven en la URL (?view=&team=) — refresh-safe y compartibles.
  const [searchParams, setSearchParams] = useSearchParams()
  const [teams, setTeams] = useState<Team[]>([])
  const [filters, setFilters] = useState<TaskFiltersState>({})
  const [onNewTask, setOnNewTaskState] = useState<() => void>(() => () => undefined)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const sidebarWidth = sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED

  const viewParam = searchParams.get("view")
  const activeView: TaskView = viewParam && VALID_VIEWS.includes(viewParam as TaskView) ? (viewParam as TaskView) : "mywork"

  const teamParam = searchParams.get("team")
  const activeTeamId = teamParam ? Number(teamParam) : null

  const setActiveView = useCallback((v: TaskView) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("view", v)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setActiveTeamId = useCallback((id: number | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id == null) next.delete("team")
      else next.set("team", String(id))
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setOnNewTask = useCallback((fn: () => void) => {
    setOnNewTaskState(() => fn)
  }, [])

  const myRole: TeamRole = activeTeamId
    ? (teams.find((t) => t.id === activeTeamId)?.myRole ?? null)
    : null

  return (
    <TaskContext.Provider
      value={{
        activeView,
        setActiveView,
        activeTeamId,
        setActiveTeamId,
        myRole,
        setTeams,
        filters,
        setFilters,
        onNewTask,
        setOnNewTask,
        sidebarWidth,
        sidebarExpanded,
        setSidebarExpanded,
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTask(): TaskContextValue {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error("useTask must be used inside TaskContextProvider")
  return ctx
}
