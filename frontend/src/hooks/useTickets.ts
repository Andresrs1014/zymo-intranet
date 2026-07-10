import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zymoallyApi } from "@/lib/zymoallyApi"
import type {
  Ticket,
  CreateTicketInput,
  TicketConfigLists,
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
  search?: string
}

function buildParams(filters: TicketListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.type) params.set("type", filters.type)
  if (filters.impact) params.set("impact", filters.impact)
  if (filters.area) params.set("area", filters.area)
  if (filters.client) params.set("client", filters.client)
  if (filters.supervisor) params.set("supervisor", filters.supervisor)
  if (filters.search) params.set("search", filters.search)
  return params
}

// ─── Listar / detalle ───────────────────────────────────────────────────────

export function useTickets(filters: TicketListFilters = {}) {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", filters],
    queryFn: async () => {
      const { data } = await zymoallyApi.get<Ticket[]>(
        `/api/tickets/pqr?${buildParams(filters)}`
      )
      return data
    },
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
        form.append(key, String(value))
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
