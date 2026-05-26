// ─── Enums ───────────────────────────────────────────────────────────────────

export type TeamMemberRole = "member" | "co_gestor"
export type ListType = "estado" | "etiqueta" | "plataforma" | "modalidad" | "prioridad" | "prioridad_agenda"
export type ActivityAction =
  | "creacion"
  | "cambio_estado"
  | "edicion"
  | "eliminacion"
  | "asignacion"
  | "adjunto_subido"
  | "adjunto_eliminado"
export type TaskAcceptanceStatus = "pendiente" | "aceptada" | "rechazada"

// ─── Teams ────────────────────────────────────────────────────────────────────

export interface Team {
  id: number
  name: string
  ownerUserId: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  myRole: "owner" | "co_gestor" | "member"
  memberCount: number
}

export interface TeamMember {
  id: number
  userId: number
  userNombre: string | null
  role: TeamMemberRole
  isActive: boolean
  createdAt: string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: number
  teamId: number
  subidoPorId: number
  subidoPorNombre: string
  asignadoAId: number | null
  asignadoANombre: string | null
  titulo: string
  descripcionTecnica: string | null
  descripcionGerencial: string | null
  impacto: string | null
  etiqueta: string
  plataforma: string
  estado: string
  prioridad: string
  fecha: string
  horaInicio: string | null
  horaCierre: string | null
  tiempoTotalMinutos: number | null
  modalidad: string | null
  aceptacion: TaskAcceptanceStatus
  version: number
  createdAt: string
  updatedAt: string
  attachments?: TaskAttachment[]
  activityLogs?: ActivityLog[]
}

export interface CreateTaskInput {
  teamId: number
  titulo: string
  descripcionTecnica?: string
  etiqueta: string
  plataforma: string
  estado?: string
  prioridad?: string
  fecha: string
  asignadoAId?: number
  asignadoANombre?: string
  impacto?: string
  modalidad?: string
  horaInicio?: string | null
  horaCierre?: string | null
}

export interface UpdateTaskInput {
  titulo?: string
  descripcionTecnica?: string | null
  descripcionGerencial?: string | null
  impacto?: string | null
  etiqueta?: string
  plataforma?: string
  estado?: string
  prioridad?: string
  fecha?: string
  asignadoAId?: number | null
  asignadoANombre?: string | null
  modalidad?: string | null
  horaInicio?: string | null
  horaCierre?: string | null
  version: number
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface TaskAttachment {
  id: number
  taskId: number
  filename: string
  filePath: string
  mimeType: string
  sizeBytes: number
  uploadedById: number
  uploadedAt: string
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: number
  taskId: number
  userId: number
  userNombre: string
  accion: ActivityAction
  detalle: string | null
  campos: Record<string, { old: unknown; new: unknown }> | null
  fecha: string
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventParticipant {
  id: number
  eventId: number
  userId: number
  userNombre: string
  hasConflict: boolean
  conflictDetail: string | null
  confirmado: boolean
}

export interface TaskEvent {
  id: number
  teamId: number
  ownerUserId: number
  titulo: string
  descripcion: string | null
  plataforma: string | null
  prioridad: string | null
  modalidad: string | null
  sede: string | null
  fecha: string
  horaInicio: string
  duracionMinutos: number
  creadoPorId: number
  creadoPorNombre: string
  createdAt: string
  updatedAt: string
  participants: EventParticipant[]
}

// ─── ListConfig ───────────────────────────────────────────────────────────────

export interface ListConfig {
  id: number
  teamId: number
  listType: ListType
  value: string
  label: string
  color: string | null
  sortOrder: number
  isActive: boolean
  isFinal: boolean
  isCanceled: boolean
  isInitialAssignment: boolean
  createdAt: string
  updatedAt: string
}

export type ListsGrouped = Record<ListType, ListConfig[]>

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface TeamKpis {
  total: number
  completadas: number
  enProgreso: number
  canceladas: number
  horasTotales: number
  promedioMinutosPorTarea: number
  usuariosActivos: number
  byEstado: Record<string, number>
}

export interface PersonSummary {
  userId: number
  nombre: string
  total: number
  horasTotal: number
  byEstado: Record<string, number>
}

export interface ChartData {
  byResponsable: { nombre: string | null; count: number }[]
  byEstado: { estado: string; count: number }[]
  byEtiqueta: { etiqueta: string; count: number }[]
  horasPorDia: { fecha: string; horas: number }[]
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export type AISuggestions =
  | { available: true; etiqueta_sugerida?: string; plataforma_sugerida?: string; tiempo_estimado_minutos?: number }
  | { available: false }
