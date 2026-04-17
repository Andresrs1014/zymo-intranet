import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { SolicitudOC, Proveedor, CotizacionProveedor, OrdenCompra, KPIData, ItemCotizacion } from "@/types/oc"
export type { ItemCotizacion }

// ── Solicitudes ───────────────────────────────────────────────────────────────

export interface SolicitudesFilters {
  estado?: string
  plataforma?: string
}

export function useSolicitudes(filters: SolicitudesFilters = {}) {
  return useQuery({
    queryKey: ["oc", "solicitudes", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.estado) params.set("estado", filters.estado)
      if (filters.plataforma) params.set("plataforma", filters.plataforma)
      const { data } = await api.get<SolicitudOC[]>(`/api/oc/solicitudes?${params}`)
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useMisSolicitudes() {
  return useQuery({
    queryKey: ["oc", "mis-solicitudes"],
    queryFn: async () => {
      const { data } = await api.get<SolicitudOC[]>("/api/oc/solicitudes/mis-solicitudes")
      return data
    },
    refetchInterval: 30_000,
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

export interface GestionPayload {
  plataforma?: string
  numero_remision?: string
  observaciones_compras?: string
  fecha_estimada_entrega?: string
  fecha_confirmada_entrega?: string
  numero_factura?: string
  aval_compra?: string
  observacion_contabilidad?: string
  fecha_recibida_factura?: string
}

export function useCambiarPrioridad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, nivel_prioridad }: { id: string; nivel_prioridad: string }) => {
      const { data } = await api.patch<SolicitudOC>(`/api/oc/solicitudes/${id}/prioridad`, {
        nivel_prioridad,
      })
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", id] })
    },
  })
}

export function useActualizarGestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: GestionPayload }) => {
      const { data } = await api.patch<SolicitudOC>(`/api/oc/solicitudes/${id}/gestionar`, payload)
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", id] })
    },
  })
}

export function useUsuario(userId: number | null | undefined) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: async () => {
      const { data } = await api.get<{ id: number; full_name: string; email: string; area: string }>(
        `/api/users/${userId}`
      )
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60_000, // cache 5 min — los datos de usuario cambian poco
  })
}

// ── Cotizaciones ──────────────────────────────────────────────────────────────

export interface CotizacionCreatePayload {
  proveedor_nombre: string
  proveedor_nit?: string
  proveedor_email?: string
  numero_cotizacion_proveedor?: string
  valor_unitario: number
  valor_antes_iva?: number
  valor_iva?: number
  valor_total: number
  fecha_vigencia?: string
  forma_pago?: string
  plazo_entrega?: string
  garantia?: string
  anticipo?: string
  pago_saldo?: string
  observaciones?: string
  items?: ItemCotizacion[]
}

export interface ExtraccionResult {
  proveedor_nit: string | null
  valor_unitario: number | null
  valor_antes_iva: number | null
  valor_iva: number | null
  valor_total: number | null
  forma_pago: string | null
  plazo_entrega: string | null
  garantia: string | null
  anticipo: string | null
  pago_saldo: string | null
  nombre_archivo: string
  campos_encontrados: number
  items: ItemCotizacion[]
}

export function useExtraerCotizacion() {
  return useMutation({
    mutationFn: async ({ solicitudId, file }: { solicitudId: string; file: File }) => {
      const form = new FormData()
      form.append("file", file)
      const { data } = await api.post<ExtraccionResult>(
        `/api/oc/solicitudes/${solicitudId}/cotizacion/extraer`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
  })
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
    onSuccess: (_data, { cotizacionId }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "cotizaciones", cotizacionId] })
    },
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
    onSuccess: (_data, { cotizacionId }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "cotizaciones", cotizacionId] })
    },
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

export function useMarcarEnviada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, email_proveedor }: { id: string; email_proveedor: string }) => {
      const { data } = await api.post(`/api/oc/solicitudes/${id}/marcar-enviada`, { email_proveedor })
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", id] })
    },
  })
}

export function useMarcarEnPlataforma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (solicitudId: string) => {
      const { data } = await api.post(`/api/oc/solicitudes/${solicitudId}/marcar-en-plataforma`, {})
      return data
    },
    onSuccess: (_, solicitudId) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", solicitudId] })
    },
  })
}

export function useMarcarEntregada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (solicitudId: string) => {
      const { data } = await api.post(`/api/oc/solicitudes/${solicitudId}/marcar-entregada`, {})
      return data
    },
    onSuccess: (_, solicitudId) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", solicitudId] })
    },
  })
}

export function useCerrarSolicitud() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (solicitudId: string) => {
      const { data } = await api.post(`/api/oc/solicitudes/${solicitudId}/cerrar`, {})
      return data
    },
    onSuccess: (_, solicitudId) => {
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes", solicitudId] })
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function useKPIs() {
  return useQuery({
    queryKey: ["oc", "kpis"],
    queryFn: async () => {
      const { data } = await api.get<KPIData>("/api/oc/kpis")
      return data
    },
    refetchInterval: 60_000,
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

// ── Listas del formulario ─────────────────────────────────────────────────────

export interface ListasFormulario {
  prioridades: string[]
  categorias: string[]
  grupos_articulos: string[]
  clientes: string[]
  condiciones: string[]
}

export function useListasFormulario() {
  return useQuery({
    queryKey: ["oc", "config", "listas"],
    queryFn: async () => {
      const { data } = await api.get<ListasFormulario>("/api/oc/config/listas")
      return data
    },
  })
}

export function useGuardarListas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (listas: ListasFormulario) => {
      await api.patch("/api/oc/config/listas", listas)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oc", "config", "listas"] })
    },
  })
}

export interface SolicitudInternaCreate {
  nivel_prioridad: string
  categoria: string
  grupo_articulos: string
  descripcion: string
  cantidad: number
  cliente?: string
  condicion?: string
  plataforma: string
  placa_ficha?: string
  observaciones_solicitante?: string
}

export function useCrearSolicitudInterna() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SolicitudInternaCreate) => {
      const { data } = await api.post<SolicitudOC>("/api/oc/solicitudes/crear-interna", payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["oc", "mis-solicitudes"] })
      qc.invalidateQueries({ queryKey: ["oc", "solicitudes"] })
    },
  })
}
