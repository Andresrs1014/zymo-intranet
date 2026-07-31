import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zymoallyApi } from "@/lib/zymoallyApi"
import type {
  Ticket,
  CreateTicketInput,
  TicketConfigLists,
  TicketListItem,
  TicketAreaPrefix,
  TicketDashboardResult,
} from "@/types/ticket"

export interface TicketListFilters {
  status?: string
  type?: string
  impact?: string
  area?: string
  client?: string
  supervisor?: string
  priority?: string
  search?: string
  /** Fase E — solo los tickets donde el usuario logueado es el supervisor/analista/coordinador asignado. */
  asignadoAMi?: boolean
}

type EditableTicketListType =
  | "statuses" | "types" | "platforms"
  | "priorities" | "impacts" | "channels" | "managementCriteria"

interface CreateListItemInput {
  listType: EditableTicketListType
  value: string
  label: string
  sortOrder?: number
}

interface UpdateListItemInput {
  id: number
  label?: string
  sortOrder?: number
  isActive?: boolean
  /** Solo tiene efecto en listType="priorities" — horas laborales límite de SLA. */
  slaHours?: number | null
}

interface CreateAreaPrefixInput {
  area: string
  prefix: string
  sortOrder?: number
}

interface UpdateAreaPrefixInput {
  id: number
  area?: string
  prefix?: string
  sortOrder?: number
  isActive?: boolean
}

function buildParams(filters: TicketListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.type) params.set("type", filters.type)
  if (filters.impact) params.set("impact", filters.impact)
  if (filters.area) params.set("area", filters.area)
  if (filters.client) params.set("client", filters.client)
  if (filters.supervisor) params.set("supervisor", filters.supervisor)
  if (filters.priority) params.set("priority", filters.priority)
  if (filters.search) params.set("search", filters.search)
  if (filters.asignadoAMi) params.set("asignadoAMi", "true")
  return params
}

export function useDeleteTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: number) => {
      await zymoallyApi.delete(`/api/tickets/pqr/${ticketId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      qc.invalidateQueries({ queryKey: ["tickets-dashboard"] })
    },
  })
}

// ─── Listar / detalle ───────────────────────────────────────────────────────

export function useTickets(filters: TicketListFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", filters],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<Ticket[]>(
        `/api/tickets/pqr?${buildParams(filters)}`
      )
      return data
    },
    enabled: options.enabled ?? true,
  })
}

export function useTicket(ticketId: number | null) {
  return useQuery<Ticket>({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<Ticket>(
        `/api/tickets/pqr/${ticketId}`
      )
      return data
    },
    enabled: ticketId !== null,
  })
}

export function useTicketCodePreview(date: string, areaPrefix: string) {
  return useQuery<{ code: string }>({
    queryKey: ["ticket-code-preview", date, areaPrefix],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<{ code: string }>(
        `/api/tickets/pqr/codigo-preview?date=${date}&areaPrefix=${areaPrefix}`
      )
      return data
    },
    enabled: Boolean(date && areaPrefix),
  })
}

// ─── Crear / mutar ──────────────────────────────────────────────────────────

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const form = new FormData()
      Object.entries(input).forEach(([key, value]) => {
        if (key === "evidence" || value === undefined || value === null) return
        // Los arrays (ej. analysts) viajan como JSON string — el backend los
        // parsea antes de validar (FormData no soporta arrays nativos).
        form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value))
      })
      input.evidence?.forEach((file) => form.append("evidence", file))
      const { data } = await zymoallyApi.post<Ticket>("/api/tickets/pqr", form)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      qc.invalidateQueries({ queryKey: ["tickets-dashboard"] })
    },
  })
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      status,
    }: {
      ticketId: number
      status: string
    }) => {
      const { data } = await zymoallyApi.patch<Ticket>(
        `/api/tickets/pqr/${ticketId}/estado`,
        { status }
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets-dashboard"] })
    },
  })
}

export function useUpdateTicketCriterio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      managementCriteria,
    }: {
      ticketId: number
      managementCriteria: string
    }) => {
      const { data } = await zymoallyApi.patch<Ticket>(
        `/api/tickets/pqr/${ticketId}/criterio`,
        { managementCriteria }
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

export function useUpdateTicketFechaCompromiso() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      dueDate,
    }: {
      ticketId: number
      dueDate: string
    }) => {
      const { data } = await zymoallyApi.patch<Ticket>(
        `/api/tickets/pqr/${ticketId}/fecha-compromiso`,
        { dueDate }
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

// ─── Flujo por etapas ───────────────────────────────────────────────────────

export function useAssignTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      analysts,
      analystEmails,
    }: {
      ticketId: number
      analysts: string[]
      analystEmails: string[]
    }) => {
      const { data } = await zymoallyApi.post<Ticket>(
        `/api/tickets/pqr/${ticketId}/asignar`,
        { analysts, analystEmails }
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

export function useMarkTicketReady() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: number) => {
      const { data } = await zymoallyApi.patch<Ticket>(
        `/api/tickets/pqr/${ticketId}/marcar-listo`
      )
      return data
    },
    onSuccess: (_data, ticketId) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

export function useValidateTicketClosure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      accion,
      comentario,
    }: {
      ticketId: number
      accion: "cerrar" | "regresar"
      comentario?: string
    }) => {
      const { data } = await zymoallyApi.patch<Ticket>(
        `/api/tickets/pqr/${ticketId}/validar-cierre`,
        { accion, comentario }
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

export function useAddTicketAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      texto,
    }: {
      ticketId: number
      texto: string
    }) => {
      const { data } = await zymoallyApi.post(
        `/api/tickets/pqr/${ticketId}/acciones`,
        { texto }
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

export function useUploadTicketEvidence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ticketId,
      files,
    }: {
      ticketId: number
      files: File[]
    }) => {
      const form = new FormData()
      files.forEach((file) => form.append("evidence", file))
      const { data } = await zymoallyApi.post<Ticket>(
        `/api/tickets/pqr/${ticketId}/evidencia`,
        form
      )
      return data
    },
    onSuccess: (_data, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] })
      qc.invalidateQueries({ queryKey: ["tickets"] })
    },
  })
}

// ─── Maestros (solo lectura en F1 — el admin de edición es F5) ─────────────

export function useTicketConfigLists() {
  return useQuery<TicketConfigLists>({
    queryKey: ["tickets-config-lists"],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<TicketConfigLists>(
        "/api/tickets/config/listas"
      )
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTicketAreaPrefixes() {
  return useQuery<TicketAreaPrefix[]>({
    queryKey: ["tickets-area-prefixes"],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<TicketAreaPrefix[]>(
        "/api/tickets/config/areas"
      )
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// --- Configuracion editable (gate mod_tickets_config en backend) ----------------

export function useCreateListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateListItemInput) => {
      const { data } = await zymoallyApi.post<TicketListItem>(
        "/api/tickets/config/listas",
        input
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-config-lists"] })
    },
  })
}

export function useUpdateListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateListItemInput) => {
      const { data } = await zymoallyApi.patch<TicketListItem>(
        `/api/tickets/config/listas/${id}`,
        input
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-config-lists"] })
    },
  })
}

export function useDeleteListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await zymoallyApi.delete(`/api/tickets/config/listas/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-config-lists"] })
    },
  })
}

export function useCreateAreaPrefix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAreaPrefixInput) => {
      const { data } = await zymoallyApi.post<TicketAreaPrefix>(
        "/api/tickets/config/areas",
        input
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-area-prefixes"] })
    },
  })
}

export function useUpdateAreaPrefix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAreaPrefixInput) => {
      const { data } = await zymoallyApi.patch<TicketAreaPrefix>(
        `/api/tickets/config/areas/${id}`,
        input
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-area-prefixes"] })
    },
  })
}

export function useDeleteAreaPrefix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await zymoallyApi.delete(`/api/tickets/config/areas/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets-area-prefixes"] })
    },
  })
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function useTicketDashboard(filters: TicketListFilters = {}) {
  return useQuery<TicketDashboardResult>({
    queryKey: ["tickets-dashboard", filters],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<TicketDashboardResult>(
        `/api/tickets/dashboard?${buildParams(filters)}`
      )
      return data
    },
  })
}
