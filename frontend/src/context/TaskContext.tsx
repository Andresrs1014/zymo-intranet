import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"
import type { Team } from "@/types/task"

export type TaskView =
  | "mywork"
  | "list"
  | "board"
  | "calendar"
  | "dashboard"
  | "people"
  | "settings"

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
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskContextProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<TaskView>("mywork")
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [filters, setFilters] = useState<TaskFiltersState>({})
  const [onNewTask, setOnNewTaskState] = useState<() => void>(() => () => undefined)

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
