export interface WorkTask {
  id: number
  scope: string
  team_id: number | null
  subido_por_id: number
  subido_por_nombre: string
  fecha: string
  hora_inicio: string | null
  hora_cierre: string | null
  tiempo_total_minutos: number | null
  etiqueta: string
  plataforma: string
  titulo: string
  descripcion_tecnica: string
  estado: string
  prioridad: string
  asignado_a_id: number | null
  asignado_a_nombre: string | null
  adjuntos: TaskAttachment[]
  created_at: string
  updated_at: string
}

export interface WorkTaskCreate {
  titulo: string
  descripcion_tecnica: string
  etiqueta?: string
  plataforma?: string
  estado?: string
  prioridad?: string
  team_id?: number
  fecha?: string
  hora_inicio?: string
  hora_cierre?: string
  asignado_a_id?: number
}

export interface WorkTaskUpdate {
  titulo?: string
  descripcion_tecnica?: string
  etiqueta?: string
  plataforma?: string
  estado?: string
  prioridad?: string
  fecha?: string
  hora_inicio?: string
  hora_cierre?: string
  asignado_a_id?: number
}

export interface TaskKpis {
  tareas_registradas: number
  horas_registradas: number
  completadas: number
  en_progreso: number
  bloqueadas: number
  usuarios_activos: number
  usuarios_sin_registro_hoy: number
}

export interface PersonTaskSummary {
  user_id: number
  nombre: string
  email: string
  tareas_totales: number
  horas: number
  completadas: number
  en_progreso: number
  bloqueadas: number
  ultima_actividad: string | null
  registro_hoy: boolean
}

export interface TaskTeamMember {
  id: number
  team_id: number
  user_id: number
  user_email: string
  user_full_name: string | null
  is_active: boolean
  role: string
  created_at: string
}

export interface AvailableUser {
  id: number
  email: string
  full_name: string | null
  role: string
  area: string | null
}

export interface TaskFilters {
  fecha_desde?: string
  fecha_hasta?: string
  responsable_id?: number
  estado?: string
  etiqueta?: string
  plataforma?: string
  q?: string
  sin_registro_hoy?: boolean
  /** Día local YYYY-MM-DD para avisos de “registro hoy” (debe enviar el cliente). */
  fecha_referencia?: string
  team_id?: number
}

export const ETIQUETAS = ["desarrollos", "actualizaciones", "auditorias", "implementacion_okr", "tareas_diarias"] as const
export const PLATAFORMAS = ["logimat1", "logimat2", "imccargo", "imcdeposito", "transversal"] as const
export const ESTADOS = ["completada", "en_progreso", "bloqueada"] as const

// --- Paginación ---
export interface PaginatedMeta {
  total_items: number
  total_pages: number
  current_page: number
  limit: number
}

export interface PaginatedTasksResponse {
  data: WorkTask[]
  meta: PaginatedMeta
}

export interface PaginatedTaskFilters {
  page?: number
  limit?: number
  search?: string
  responsable_id?: number
  estado?: string
  etiqueta?: string
  plataforma?: string
  fecha_exacta?: string
  fecha_desde?: string
  fecha_hasta?: string
  team_id?: number
}

// --- Agenda ---
export interface TaskEventParticipant {
  user_id: number
  user_nombre: string
  has_conflict: boolean
  conflict_detail?: string
}

export interface TaskEvent {
  id: number
  titulo: string
  descripcion?: string
  plataforma?: string
  prioridad?: string
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  creado_por_id: number
  creado_por_nombre: string
  participants: TaskEventParticipant[]
}

export interface TaskEventCreate {
  titulo: string
  descripcion?: string
  plataforma?: string
  prioridad?: string
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  participant_ids: number[]
}

// --- Chart response types ---
export interface TeamChartsData {
  tareas_por_responsable: { nombre: string; tareas: number }[]
  horas_por_responsable: { nombre: string; horas: number }[]
  distribucion_estado: { estado: string; cantidad: number }[]
  tareas_por_etiqueta: { etiqueta: string; cantidad: number }[]
  evolucion_completadas: { fecha: string; completadas: number }[]
}

export interface MyTaskMetrics {
  tareas_registradas: number
  horas_registradas: number
  completadas: number
  en_progreso: number
  bloqueadas: number
}

// --- Historial ---
export interface TaskActivityEntry {
  id: number
  user_nombre: string
  accion: string
  detalle?: string
  fecha: string
}

// --- Equipos del usuario ---
export interface UserTeamInfo {
  team_id: number
  team_name: string
  owner_id: number
}

/** Equipo que gestiona el usuario actual (gestor / co-gestor). */
export interface ManagerTeamInfo {
  team_id: number
  name: string
  owner_user_id: number
}

// --- List config ---
export interface TaskListConfigItem {
  id: number
  list_type: string
  value: string
  label: string
  is_active: boolean
  is_final: boolean
  is_canceled: boolean
  is_initial_assignment: boolean
}

export interface TaskListsResponse {
  estado: TaskListConfigItem[]
  etiqueta: TaskListConfigItem[]
  plataforma: TaskListConfigItem[]
  prioridad_agenda: TaskListConfigItem[]
}

export interface TaskAttachment {
  id: number
  task_id: number
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_by_id: number
  uploaded_at: string
}
