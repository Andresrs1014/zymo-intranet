import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { SolicitudOC, Proveedor } from "@/types/oc"

// ── Solicitudes ───────────────────────────────────────────────────────────────

export interface SolicitudesFilters {
  estado?: string
  sede?: string
}

export function useSolicitudes(filters: SolicitudesFilters = {}) {
  return useQuery({
    queryKey: ["oc", "solicitudes", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.estado) params.set("estado", filters.estado)
      if (filters.sede) params.set("sede", filters.sede)
      const { data } = await api.get<SolicitudOC[]>(`/api/oc/solicitudes?${params}`)
      return data
    },
    refetchInterval: 30_000, // polling cada 30s — PA puede enviar nuevas solicitudes
  })
}

export function useSolicitud(id: string | undefined) {
  return useQuery({
    queryKey: ["oc", "solicitudes", id],
    queryFn: async () => {
      const { data } = await api.get<SolicitudOC>(`/api/oc/solicitudes/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useAsignarAuxiliar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, auxiliar_id }: { id: string; auxiliar_id: number }) => {
      const { data } = await api.patch<SolicitudOC>(`/api/oc/solicitudes/${id}/asignar`, {
        auxiliar_id,
      })
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", id] })
    },
  })
}

export function useCambiarEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { data } = await api.patch<SolicitudOC>(`/api/oc/solicitudes/${id}/estado`, {
        estado,
      })
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", id] })
    },
  })
}

// ── Proveedores ───────────────────────────────────────────────────────────────

export function useProveedores(soloActivos = true) {
  return useQuery({
    queryKey: ["oc", "proveedores", soloActivos],
    queryFn: async () => {
      const { data } = await api.get<Proveedor[]>(
        `/api/oc/proveedores?solo_activos=${soloActivos}`
      )
      return data
    },
  })
}
