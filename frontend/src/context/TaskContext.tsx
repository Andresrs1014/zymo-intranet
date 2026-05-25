import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"

export type TaskView =
  | "list"
  | "board"
  | "calendar"
  | "dashboard"
  | "people"
  | "settings"

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
  filters: TaskFiltersState
  setFilters: (f: TaskFiltersState) => void
  onNewTask: () => void
  setOnNewTask: (fn: () => void) => void
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskContextProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<TaskView>("list")
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null)
  const [filters, setFilters] = useState<TaskFiltersState>({})
  const [onNewTask, setOnNewTaskState] = useState<() => void>(() => () => undefined)

  const setOnNewTask = useCallback((fn: () => void) => {
    setOnNewTaskState(() => fn)
  }, [])

  return (
    <TaskContext.Provider
      value={{
        activeView,
        setActiveView,
        activeTeamId,
        setActiveTeamId,
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
