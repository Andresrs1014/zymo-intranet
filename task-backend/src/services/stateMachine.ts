import { AppError } from "../middleware/errorHandler"

export interface StateConfig {
  value: string
  isFinal: boolean
  isCanceled: boolean
  isInitialAssignment: boolean
}

/** Validate that a state transition is allowed for the given role */
export function validateTransition(
  currentState: string,
  newState: string,
  listConfigs: StateConfig[],
  userRole: "owner" | "co_gestor" | "member",
): void {
  if (currentState === newState) return

  const current = listConfigs.find((s) => s.value === currentState)
  const next = listConfigs.find((s) => s.value === newState)

  if (!current) throw new AppError(422, `Estado actual desconocido: ${currentState}`)
  if (!next) throw new AppError(422, `Estado destino desconocido: ${newState}`)

  const isManager = userRole === "owner" || userRole === "co_gestor"

  // Only managers can reopen from a final or canceled state
  if ((current.isFinal || current.isCanceled) && !isManager) {
    throw new AppError(422, "Solo un gestor puede reabrir una tarea finalizada o cancelada")
  }

  // Only managers can move a task to a canceled state
  if (next.isCanceled && !isManager) {
    throw new AppError(422, "Solo un gestor puede cancelar una tarea")
  }
}

/** Returns the initial-assignment state value (or first state if none marked) */
export function getInitialState(listConfigs: StateConfig[]): string {
  const initial = listConfigs.find((s) => s.isInitialAssignment)
  if (initial) return initial.value
  if (listConfigs.length === 0) throw new AppError(500, "El equipo no tiene estados configurados")
  return listConfigs[0].value
}

/** Returns the first final state value */
export function getFinalState(listConfigs: StateConfig[]): string | undefined {
  return listConfigs.find((s) => s.isFinal)?.value
}
