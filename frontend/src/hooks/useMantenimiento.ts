import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  CambiarEstadoMantenimientoPayload,
  CrearMantenimientoPayload,
  CrearOCVinculadaPayload,
  HistorialMantenimientoEntrada,
  MantenimientoFilters,
  OCVinculada,
  SolicitudMantenimiento,
  SolicitudesMantenimientoListResponse,
  TipoMantenimientoConfig,
} from "@/types/mantenimiento"

const BASE = "/api/mantenimiento"

// ── Config — tipos de mantenimiento ──────────────────────────────────────────

export function useTiposMantenimiento(soloActivos = true) {
  return useQuery({
    queryKey: ["mantenimiento", "tipos", soloActivos],
    queryFn: async () => {
      const { data } = await api.get<TipoMantenimientoConfig[]>(
        `${BASE}/config/tipos?solo_activos=${soloActivos}`
      )
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useCrearTipoMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { nombre: string; orden?: number }) => {
      const { data } = await api.post<TipoMantenimientoConfig>(
        `${BASE}/config/tipos`,
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mantenimiento", "tipos"] }),
  })
}

export function useToggleTipoMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const { data } = await api.patch<TipoMantenimientoConfig>(
        `${BASE}/config/tipos/${id}`,
        { activo }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mantenimiento", "tipos"] }),
  })
}

// ── Solicitudes ───────────────────────────────────────────────────────────────

export function useSolicitudesMantenimiento(
  filters: MantenimientoFilters = {},
  page = 1
) {
  return useQuery({
    queryKey: ["mantenimiento", "solicitudes", filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "20")
      if (filters.estado)        params.set("estado", filters.estado)
      if (filters.clasificacion) params.set("clasificacion", filters.clasificacion)
      if (filters.modalidad)     params.set("modalidad", filters.modalidad)
      if (filters.q)             params.set("q", filters.q)
      const { data } = await api.get<SolicitudesMantenimientoListResponse>(
        `${BASE}/solicitudes/?${params}`
      )
      return data
    },
  })
}

export function useSolicitudMantenimiento(id: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "solicitud", id],
    queryFn: async () => {
      const { data } = await api.get<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}`
      )
      return data
    },
    enabled: id !== null,
  })
}

export function useCrearMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CrearMantenimientoPayload) => {
      const { data } = await api.post<SolicitudMantenimiento>(
        `${BASE}/solicitudes/crear`,
        payload
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitudes"] }),
  })
}

export function useCambiarEstadoMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: CambiarEstadoMantenimientoPayload
    }) => {
      const { data } = await api.patch<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}/estado`,
        payload
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] })
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitudes"] })
    },
  })
}

export function useAsignarMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      asignado_id,
    }: {
      id: number
      asignado_id: number | null
    }) => {
      const { data } = await api.patch<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}/asignar`,
        { asignado_id }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] }),
  })
}

export function useProgramarMantenimiento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      fecha_programada,
      notas_evaluacion,
    }: {
      id: number
      fecha_programada?: string | null
      notas_evaluacion?: string | null
    }) => {
      const { data } = await api.patch<SolicitudMantenimiento>(
        `${BASE}/solicitudes/${id}/programar`,
        { fecha_programada, notas_evaluacion }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] }),
  })
}

// ── Historial ─────────────────────────────────────────────────────────────────

export function useHistorialMantenimiento(id: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "historial", id],
    queryFn: async () => {
      const { data } = await api.get<HistorialMantenimientoEntrada[]>(
        `${BASE}/solicitudes/${id}/historial`
      )
      return data
    },
    enabled: id !== null,
  })
}

// ── OC vinculada ──────────────────────────────────────────────────────────────

export function useOCsVinculadas(mantenimientoId: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "ocs", mantenimientoId],
    queryFn: async () => {
      const { data } = await api.get<OCVinculada[]>(
        `${BASE}/solicitudes/${mantenimientoId}/ocs`
      )
      return data
    },
    enabled: mantenimientoId !== null,
  })
}

export function useCrearOCVinculada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      mantenimientoId,
      payload,
    }: {
      mantenimientoId: number
      payload: CrearOCVinculadaPayload
    }) => {
      const { data } = await api.post<OCVinculada>(
        `${BASE}/solicitudes/${mantenimientoId}/oc-vinculada`,
        payload
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({
        queryKey: ["mantenimiento", "ocs", vars.mantenimientoId],
      }),
  })
}
