import type { Task } from "@/types/task"

// Fecha local en formato yyyy-mm-dd (en-CA produce ISO-like en zona local).
export function todayStr(): string {
  return new Date().toLocaleDateString("en-CA")
}

// Una tarea vencida = fecha anterior a hoy. El llamador ya filtró las "terminadas"
// (estado final/cancelado) antes de usar esto — aquí solo se compara la fecha.
export function isOverdue(task: Task): boolean {
  return task.fecha.slice(0, 10) < todayStr()
}

// Pendiente de aceptar = asignada explícitamente a mí y aún sin responder.
export function isPendingForMe(task: Task, userId: number | null): boolean {
  return userId != null && task.asignadoAId === userId && task.aceptacion === "pendiente"
}

export interface CategorizedWork {
  pendientes: Task[]
  vencidas: Task[]
  enCurso: Task[]
}

// Reparte las tareas del usuario en las tres secciones de "Mi trabajo".
// `isDone(task)` resuelve, contra la config del equipo, si el estado es final o cancelado.
export function categorizeMyWork(
  tasks: Task[],
  userId: number | null,
  isDone: (task: Task) => boolean,
): CategorizedWork {
  const pendientes: Task[] = []
  const vencidas: Task[] = []
  const enCurso: Task[] = []

  for (const t of tasks) {
    if (t.aceptacion === "rechazada") continue
    if (isDone(t)) continue
    if (isPendingForMe(t, userId)) {
      pendientes.push(t)
    } else if (isOverdue(t)) {
      vencidas.push(t)
    } else {
      enCurso.push(t)
    }
  }

  return { pendientes, vencidas, enCurso }
}

// Contador para el badge del sidebar (no necesita config de equipos).
export function countPendingForMe(tasks: Task[], userId: number | null): number {
  return tasks.reduce((n, t) => n + (isPendingForMe(t, userId) ? 1 : 0), 0)
}
