import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
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
  TaskEventParticipant,
  TaskActivityEntry,
  PaginatedTaskFilters,
  PaginatedTasksResponse,
  TeamChartsData,
  MyTaskMetrics,
  UserTeamInfo,
  ManagerTeamInfo,
  TaskListConfigItem,
  TaskListsResponse,
} from "@/types/workTask"

const BASE = "/api/herramientas/tareas"

/** Día local del navegador — alinea “registro hoy” con las fechas que envían los formularios. */
function withLocalReferenceDay(filters: TaskFilters): TaskFilters {
  return { ...filters, fecha_referencia: format(new Date(), "yyyy-MM-dd") }
}

/** Vista gestor: datos vivos (otros usuarios no invalidan el cache del cliente del gestor). */
const equipoLiveQueryOpts = {
  staleTime: 0,
  refetchInterval: 45_000,
  refetchIntervalInBackground: false,
} as const

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
  if (filters.fecha_referencia) p.set("fecha_referencia", filters.fecha_referencia)
  if (filters.team_id != null) p.set("team_id", String(filters.team_id))
  return p
}

// ── User hooks ────────────────────────────────────────────────────────────────

export function useMyTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ["tareas", "mis-tareas", filters],
    queryFn: async () => {
      const { data } = await api.get<PaginatedTasksResponse>(`${BASE}/mis-tareas?${filtersToParams(filters)}`)
      return data.data
    },
  })
}

export function useMyTaskMetrics(teamId?: number) {
  return useQuery({
    queryKey: ["tareas", "mis-metricas", teamId ?? null],
    queryFn: async () => {
      const url = teamId ? `${BASE}/mis-metricas?team_id=${teamId}` : `${BASE}/mis-metricas`
      const { data } = await api.get<MyTaskMetrics>(url)
      return data
    },
  })
}

export function useMyTeams() {
  return useQuery({
    queryKey: ["tareas", "mis-equipos"],
    queryFn: async () => {
      const { data } = await api.get<UserTeamInfo[]>(`${BASE}/mis-equipos`)
      return data
    },
  })
}

/** Equipos que el usuario gestiona (gestor primario + co-gestor). Para el workspace switcher. */
export function useManagedTeams() {
  return useQuery<UserTeamInfo[]>({
    queryKey: ["tareas", "mis-equipos-gestionados"],
    queryFn: async () => {
      const { data } = await api.get<UserTeamInfo[]>(`${BASE}/mis-equipos-gestionados`)
      return data
    },
  })
}

export function useCreateWorkTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WorkTaskCreate) => {
      const { data } = await api.post<WorkTask>(`${BASE}`, payload)
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
  const f = withLocalReferenceDay(filters)
  return useQuery({
    queryKey: ["tareas", "equipo", f],
    queryFn: async () => {
      const { data } = await api.get<WorkTask[]>(`${BASE}/equipo?${filtersToParams(f)}`)
      return data
    },
    ...equipoLiveQueryOpts,
  })
}

export function useTeamKpis(filters: TaskFilters = {}) {
  const f = withLocalReferenceDay(filters)
  return useQuery({
    queryKey: ["tareas", "kpis", f],
    queryFn: async () => {
      const { data } = await api.get<TaskKpis>(`${BASE}/equipo/kpis?${filtersToParams(f)}`)
      return data
    },
    ...equipoLiveQueryOpts,
  })
}

export function useTeamPersonSummaries(filters: TaskFilters = {}) {
  const f = withLocalReferenceDay(filters)
  return useQuery({
    queryKey: ["tareas", "personas", f],
    queryFn: async () => {
      const { data } = await api.get<PersonTaskSummary[]>(`${BASE}/equipo/personas?${filtersToParams(f)}`)
      return data
    },
    ...equipoLiveQueryOpts,
  })
}

export function useTeamCharts(filters: TaskFilters = {}) {
  const f = withLocalReferenceDay(filters)
  return useQuery({
    queryKey: ["tareas", "graficas", f],
    queryFn: async () => {
      const { data } = await api.get<TeamChartsData>(`${BASE}/equipo/graficas?${filtersToParams(f)}`)
      return data
    },
    ...equipoLiveQueryOpts,
  })
}

export function useUsersWithoutTodayEntry() {
  const dia = format(new Date(), "yyyy-MM-dd")
  return useQuery({
    queryKey: ["tareas", "sin-registro-hoy", dia],
    queryFn: async () => {
      const p = new URLSearchParams()
      p.set("fecha_referencia", dia)
      const { data } = await api.get<PersonTaskSummary[]>(`${BASE}/equipo/sin-registro-hoy?${p}`)
      return data
    },
    ...equipoLiveQueryOpts,
  })
}

// ── Team config hooks ─────────────────────────────────────────────────────────

export function useTeamMembers(enabled = true) {
  return useQuery({
    queryKey: ["tareas", "equipo", "miembros"],
    queryFn: async () => {
      const { data } = await api.get<TaskTeamMember[]>(`${BASE}/equipo/config/miembros`)
      return data
    },
    enabled,
  })
}

export function useTeamCompaneros(teamId?: number) {
  return useQuery<TaskTeamMember[]>({
    queryKey: ["tareas", "equipo", "companeros", teamId ?? null],
    queryFn: async () => {
      const url = teamId ? `${BASE}/equipo/companeros?team_id=${teamId}` : `${BASE}/equipo/companeros`
      const { data } = await api.get<TaskTeamMember[]>(url)
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

export function useManagerTeamInfo(enabled = true) {
  return useQuery({
    queryKey: ["tareas", "equipo", "info"],
    queryFn: async () => {
      const { data } = await api.get<ManagerTeamInfo>(`${BASE}/equipo/config/equipo`)
      return data
    },
    enabled,
  })
}

export function useUpdateTeamName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.patch<ManagerTeamInfo>(`${BASE}/equipo/config/equipo`, { name })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas"] })
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
      qc.invalidateQueries({ queryKey: ["me"] })
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
      qc.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function usePromoteToCogestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: number) => {
      const { data } = await api.post<TaskTeamMember>(
        `${BASE}/equipo/config/miembros/${user_id}/promover`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "miembros"] })
    },
  })
}

export function useDemoteToMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: number) => {
      const { data } = await api.post<TaskTeamMember>(
        `${BASE}/equipo/config/miembros/${user_id}/degradar`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "miembros"] })
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
      await api.post(`${BASE}/admin/asignar-tool`, { user_id, tool_key, scope: "global" })
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
        data: { user_id, tool_key, scope: "global" },
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

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: number) => {
      await api.delete(`${BASE}/agenda/${eventId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "agenda"] })
    },
  })
}

export function useUpdateEventParticipants() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      addIds,
      removeIds,
    }: {
      eventId: number
      addIds: number[]
      removeIds: number[]
    }) => {
      const { data } = await api.patch<{ ok: boolean; participants: TaskEventParticipant[] }>(
        `${BASE}/agenda/${eventId}/participantes`,
        { add_ids: addIds, remove_ids: removeIds }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "agenda"] })
    },
  })
}

export function useMarkEstadoEspecial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ value, tipo }: { value: string; tipo: "final" | "cancelado" | "inicial" | null }) => {
      const { data } = await api.patch<TaskListConfigItem>(
        `${BASE}/config/listas/estado/${value}/especial`,
        { tipo }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "config", "listas"] })
    },
  })
}

export function useUpdateManagerTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: WorkTaskUpdate }) => {
      const { data } = await api.patch<WorkTask>(`${BASE}/equipo/tareas/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas"] })
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
    ...equipoLiveQueryOpts,
  })
}

// TaskListConfigItem and TaskListsResponse are defined in @/types/workTask
// Re-exported here for backwards compatibility with existing consumers.
export type { TaskListConfigItem, TaskListsResponse }

export function useTaskLists(teamId?: number) {
  return useQuery<TaskListsResponse>({
    queryKey: ["tareas", "config", "listas", teamId ?? null],
    queryFn: async () => {
      const url = teamId ? `${BASE}/config/listas?team_id=${teamId}` : `${BASE}/config/listas`
      const { data } = await api.get<TaskListsResponse>(url)
      return data
    },
  })
}

export function useCreateTaskListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { list_type: string; value: string; label: string }) => {
      const { data } = await api.post<TaskListConfigItem>(`${BASE}/config/listas`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "config", "listas"] })
    },
  })
}

export function useUpdateTaskListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      list_type,
      value,
      payload,
    }: {
      list_type: string
      value: string
      payload: { label?: string; is_active?: boolean }
    }) => {
      const { data } = await api.patch<TaskListConfigItem>(
        `${BASE}/config/listas/${list_type}/${value}`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "config", "listas"] })
    },
  })
}

export function useDeleteTaskListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ list_type, value }: { list_type: string; value: string }) => {
      await api.delete(`${BASE}/config/listas/${list_type}/${value}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "config", "listas"] })
    },
  })
}

export function useAdminUserTasks(userId: number | null) {
  return useQuery({
    queryKey: ["tareas", "admin", "user-tasks", userId],
    queryFn: async () => {
      if (userId === null) throw new Error("userId required")
      const { data } = await api.get<WorkTask[]>(`${BASE}/admin/tareas-usuario/${userId}`)
      return data
    },
    enabled: userId !== null,
  })
}

export function useAdminDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: number) => {
      await api.delete(`${BASE}/admin/tareas/${taskId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "admin", "user-tasks"] })
    },
  })
}
