import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  WorkTask,
  WorkTaskCreate,
  WorkTaskUpdate,
  TaskKpis,
  PersonTaskSummary,
  TaskTeamMember,
  AvailableUser,
  TaskFilters,
  TaskEvent,
  TaskEventCreate,
  TaskActivityEntry,
  PaginatedTaskFilters,
  PaginatedTasksResponse,
} from "@/types/workTask"

const BASE = "/api/herramientas/tareas"

function filtersToParams(filters: TaskFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.fecha_desde) p.set("fecha_desde", filters.fecha_desde)
  if (filters.fecha_hasta) p.set("fecha_hasta", filters.fecha_hasta)
  if (filters.responsable_id != null) p.set("responsable_id", String(filters.responsable_id))
  if (filters.estado) p.set("estado", filters.estado)
  if (filters.etiqueta) p.set("etiqueta", filters.etiqueta)
  if (filters.plataforma) p.set("plataforma", filters.plataforma)
  if (filters.q) p.set("q", filters.q)
  if (filters.sin_registro_hoy) p.set("sin_registro_hoy", "true")
  return p
}

// ── User hooks ────────────────────────────────────────────────────────────────

export function useMyTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tareas", "mis-tareas", filters],
    queryFn: async () => {
      const { data } = await api.get<WorkTask[]>(`${BASE}/mis-tareas?${filtersToParams(filters)}`)
      return data
    },
  })
}

export function useMyTaskMetrics() {
  return useQuery({
    queryKey: ["tareas", "mis-metricas"],
    queryFn: async () => {
      const { data } = await api.get<Record<string, unknown>>(`${BASE}/mis-metricas`)
      return data
    },
  })
}

export function useCreateWorkTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WorkTaskCreate) => {
      const { data } = await api.post<WorkTask>(`${BASE}/`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas"] })
    },
  })
}

export function useUpdateWorkTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: WorkTaskUpdate }) => {
      const { data } = await api.patch<WorkTask>(`${BASE}/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas"] })
    },
  })
}

// ── Directiva hooks ────────────────────────────────────────────────────────────

export function useTeamTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tareas", "equipo", filters],
    queryFn: async () => {
      const { data } = await api.get<WorkTask[]>(`${BASE}/equipo?${filtersToParams(filters)}`)
      return data
    },
  })
}

export function useTeamKpis(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tareas", "kpis", filters],
    queryFn: async () => {
      const { data } = await api.get<TaskKpis>(`${BASE}/equipo/kpis?${filtersToParams(filters)}`)
      return data
    },
  })
}

export function useTeamPersonSummaries(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tareas", "personas", filters],
    queryFn: async () => {
      const { data } = await api.get<PersonTaskSummary[]>(`${BASE}/equipo/personas?${filtersToParams(filters)}`)
      return data
    },
  })
}

export function useTeamCharts(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tareas", "graficas", filters],
    queryFn: async () => {
      const { data } = await api.get<Record<string, unknown[]>>(`${BASE}/equipo/graficas?${filtersToParams(filters)}`)
      return data
    },
  })
}

export function useUsersWithoutTodayEntry() {
  return useQuery({
    queryKey: ["tareas", "sin-registro-hoy"],
    queryFn: async () => {
      const { data } = await api.get<PersonTaskSummary[]>(`${BASE}/equipo/sin-registro-hoy`)
      return data
    },
  })
}

// ── Team config hooks ─────────────────────────────────────────────────────────

export function useTeamMembers() {
  return useQuery({
    queryKey: ["tareas", "equipo", "miembros"],
    queryFn: async () => {
      const { data } = await api.get<TaskTeamMember[]>(`${BASE}/equipo/config/miembros`)
      return data
    },
  })
}

export function useAvailableTeamUsers() {
  return useQuery({
    queryKey: ["tareas", "equipo", "disponibles"],
    queryFn: async () => {
      const { data } = await api.get<AvailableUser[]>(`${BASE}/equipo/config/usuarios-disponibles`)
      return data
    },
  })
}

export function useAddTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: number) => {
      const { data } = await api.post<TaskTeamMember>(`${BASE}/equipo/config/miembros`, { user_id })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "miembros"] })
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "disponibles"] })
    },
  })
}

export function useRemoveTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: number) => {
      await api.delete(`${BASE}/equipo/config/miembros/${user_id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "miembros"] })
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "disponibles"] })
    },
  })
}

// ── Admin tool hooks ──────────────────────────────────────────────────────────

export function useUserTools(userId: number | null) {
  return useQuery({
    queryKey: ["tareas", "admin", "user-tools", userId],
    queryFn: async () => {
      const { data } = await api.get<string[]>(`${BASE}/admin/user-tools/${userId}`)
      return data
    },
    enabled: userId !== null,
  })
}

export function useAssignUserTool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ user_id, tool_key }: { user_id: number; tool_key: string }) => {
      await api.post(`${BASE}/admin/asignar-tool`, { user_id, tool_key, scope: "desarrollo_innovacion" })
    },
    onSuccess: (_d, { user_id }) => {
      qc.invalidateQueries({ queryKey: ["tareas", "admin", "user-tools", user_id] })
    },
  })
}

export function useRevokeUserTool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ user_id, tool_key }: { user_id: number; tool_key: string }) => {
      await api.delete(`${BASE}/admin/revocar-tool`, {
        data: { user_id, tool_key, scope: "desarrollo_innovacion" },
      })
    },
    onSuccess: (_d, { user_id }) => {
      qc.invalidateQueries({ queryKey: ["tareas", "admin", "user-tools", user_id] })
    },
  })
}

// --- Hooks de Agenda ---

export function useEventsByDate(fecha: string | null) {
  return useQuery<TaskEvent[]>({
    queryKey: ["tareas", "agenda", fecha],
    queryFn: async () => {
      const { data } = await api.get<TaskEvent[]>(
        `/api/herramientas/tareas/agenda/${fecha}`
      )
      return data
    },
    enabled: !!fecha,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TaskEventCreate) => {
      const { data } = await api.post("/api/herramientas/tareas/agenda", payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "agenda"] })
    },
  })
}

// --- Historial de tarea ---

export function useTaskActivity(taskId: number | null) {
  return useQuery<TaskActivityEntry[]>({
    queryKey: ["tareas", "historial", taskId],
    queryFn: async () => {
      const { data } = await api.get<TaskActivityEntry[]>(
        `/api/herramientas/tareas/${taskId}/historial`
      )
      return data
    },
    enabled: !!taskId,
  })
}

// --- Hooks paginados ---

export function useMyTasksPaginated(filters: PaginatedTaskFilters) {
  return useQuery<PaginatedTasksResponse>({
    queryKey: ["tareas", "mis-tareas-paginadas", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
      })
      const { data } = await api.get<PaginatedTasksResponse>(
        `/api/herramientas/tareas/mis-tareas?${params}`
      )
      return data
    },
  })
}

export function useTeamTasksPaginated(filters: PaginatedTaskFilters) {
  return useQuery<PaginatedTasksResponse>({
    queryKey: ["tareas", "equipo-paginadas", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
      })
      const { data } = await api.get<PaginatedTasksResponse>(
        `/api/herramientas/tareas/equipo/tareas-paginadas?${params}`
      )
      return data
    },
  })
}
