import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { SolicitudOC, Proveedor, CotizacionProveedor, OrdenCompra } from "@/types/oc"

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

// ── Cotizaciones ──────────────────────────────────────────────────────────────

export interface CotizacionCreatePayload {
  proveedor_nombre: string
  proveedor_email?: string
  numero_cotizacion_proveedor?: string
  valor_unitario: number
  valor_total: number
  fecha_vigencia?: string
  observaciones?: string
}

export function useCotizaciones(solicitudId: string | undefined) {
  return useQuery({
    queryKey: ["oc", "cotizaciones", solicitudId],
    queryFn: async () => {
      const { data } = await api.get<CotizacionProveedor[]>(
        `/api/oc/solicitudes/${solicitudId}/cotizaciones`
      )
      return data
    },
    enabled: !!solicitudId,
  })
}

export function useCrearCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      solicitudId,
      payload,
    }: {
      solicitudId: string
      payload: CotizacionCreatePayload
    }) => {
      const { data } = await api.post<CotizacionProveedor>(
        `/api/oc/solicitudes/${solicitudId}/cotizacion`,
        payload
      )
      return data
    },
    onSuccess: (_, { solicitudId }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", solicitudId] })
      qc.invalidateQueries({ queryKey: ["oc", "cotizaciones", solicitudId] })
    },
  })
}

export function useAprobarCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cotizacionId,
      valor_aprobado,
      observaciones_aprobacion,
    }: {
      cotizacionId: string
      valor_aprobado: number
      observaciones_aprobacion?: string
    }) => {
      const { data } = await api.patch<CotizacionProveedor>(
        `/api/oc/cotizaciones/${cotizacionId}/aprobar`,
        { valor_aprobado, observaciones_aprobacion }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oc"] }),
  })
}

export function useRechazarCotizacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cotizacionId,
      observaciones_aprobacion,
    }: {
      cotizacionId: string
      observaciones_aprobacion: string
    }) => {
      const { data } = await api.patch<CotizacionProveedor>(
        `/api/oc/cotizaciones/${cotizacionId}/rechazar`,
        { observaciones_aprobacion }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oc"] }),
  })
}

// ── Documentos / Orden de Compra ──────────────────────────────────────────────

export function useOrden(solicitudId: string | undefined) {
  return useQuery({
    queryKey: ["oc", "orden", solicitudId],
    queryFn: async () => {
      const { data } = await api.get<OrdenCompra>(`/api/oc/solicitudes/${solicitudId}/orden`)
      return data
    },
    enabled: !!solicitudId,
    retry: false, // 404 es esperado cuando aún no existe la OC
  })
}

export function useGenerarOC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (solicitudId: string) => {
      const { data } = await api.post<OrdenCompra>(
        `/api/oc/solicitudes/${solicitudId}/generar-oc`,
        {}
      )
      return data
    },
    onSuccess: (_, solicitudId) => {
      qc.invalidateQueries({ queryKey: ["oc", "orden", solicitudId] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
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
