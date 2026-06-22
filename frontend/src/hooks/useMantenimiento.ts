import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { portalHttp } from "@/lib/portalApi"
import { useMantenimientoPortal } from "@/context/MantenimientoPortalContext"
import type {
  AccesoMovilOut,
  AuxiliarPortalOut,
  Aprobacion,
  AprobacionPayload,
  CambiarEstadoMantenimientoPayload,
  CrearMantenimientoPayload,
  CrearOCVinculadaPayload,
  CrearRetroactivoPayload,
  HistorialMantenimientoEntrada,
  KpisOut,
  MantenimientoFilters,
  MntNotificacionesConfig,
  OCVinculada,
  SolicitudMantenimiento,
  SolicitudesMantenimientoListResponse,
  SubirEvidenciaPayload,
  TipoMantenimientoConfig,
} from "@/types/mantenimiento"

const BASE = "/api/mantenimiento"

function useMntApi() {
  const portal = useMantenimientoPortal()
  return {
    http: portal ? portalHttp : api,
    prefix: portal?.apiPrefix ?? BASE,
    portalToken: portal?.portalToken ?? null,
  }
}

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
  const { http, prefix, portalToken } = useMntApi()
  return useQuery({
    queryKey: ["mantenimiento", "solicitudes", filters, page, portalToken],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "20")
      if (filters.estado)        params.set("estado", filters.estado)
      if (filters.clasificacion) params.set("clasificacion", filters.clasificacion)
      if (filters.modalidad)     params.set("modalidad", filters.modalidad)
      if (filters.q)             params.set("q", filters.q)
      const { data } = await http.get<SolicitudesMantenimientoListResponse>(
        `${prefix}/solicitudes/?${params}`
      )
      return data
    },
  })
}

export function useSolicitudMantenimiento(id: number | null) {
  const { http, prefix, portalToken } = useMntApi()
  return useQuery({
    queryKey: ["mantenimiento", "solicitud", id, portalToken],
    queryFn: async () => {
      const { data } = await http.get<SolicitudMantenimiento>(
        `${prefix}/solicitudes/${id}`
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
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: CambiarEstadoMantenimientoPayload
    }) => {
      const { data } = await http.patch<SolicitudMantenimiento>(
        `${prefix}/solicitudes/${id}/estado`,
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
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({
      id,
      asignado_id,
    }: {
      id: number
      asignado_id: number | null
    }) => {
      const { data } = await http.patch<SolicitudMantenimiento>(
        `${prefix}/solicitudes/${id}/asignar`,
        { asignado_id }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] }),
  })
}

export function useAuxiliaresMantenimiento() {
  return useQuery({
    queryKey: ["mantenimiento", "auxiliares"],
    queryFn: async () => {
      const { data } = await api.get<{ id: number; full_name: string; email: string }[]>(
        `${BASE}/config/auxiliares`
      )
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useProgramarMantenimiento() {
  const qc = useQueryClient()
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({
      id,
      fecha_programada,
      notas_evaluacion,
      monto_estimado,
    }: {
      id: number
      fecha_programada?: string | null
      notas_evaluacion?: string | null
      monto_estimado?: number | null
    }) => {
      const { data } = await http.patch<SolicitudMantenimiento>(
        `${prefix}/solicitudes/${id}/programar`,
        { fecha_programada, notas_evaluacion, monto_estimado }
      )
      return data
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] }),
  })
}

// ── Historial ─────────────────────────────────────────────────────────────────

export function useHistorialMantenimiento(id: number | null) {
  const { http, prefix, portalToken } = useMntApi()
  return useQuery({
    queryKey: ["mantenimiento", "historial", id, portalToken],
    queryFn: async () => {
      const { data } = await http.get<HistorialMantenimientoEntrada[]>(
        `${prefix}/solicitudes/${id}/historial`
      )
      return data
    },
    enabled: id !== null,
  })
}

// ── OC vinculada ──────────────────────────────────────────────────────────────

export function useOCsVinculadas(mantenimientoId: number | null) {
  const { http, prefix, portalToken } = useMntApi()
  return useQuery({
    queryKey: ["mantenimiento", "ocs", mantenimientoId, portalToken],
    queryFn: async () => {
      const { data } = await http.get<OCVinculada[]>(
        `${prefix}/solicitudes/${mantenimientoId}/ocs`
      )
      return data
    },
    enabled: mantenimientoId !== null,
  })
}

export function useCrearOCVinculada() {
  const qc = useQueryClient()
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({
      mantenimientoId,
      payload,
    }: {
      mantenimientoId: number
      payload: CrearOCVinculadaPayload
    }) => {
      const { data } = await http.post<OCVinculada>(
        `${prefix}/solicitudes/${mantenimientoId}/oc-vinculada`,
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

// ── Hooks Fase 1 ─────────────────────────────────────────────────────────────

export function useSubirEvidencia() {
  const qc = useQueryClient()
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: SubirEvidenciaPayload }) => {
      const { data } = await http.post<SolicitudMantenimiento>(
        `${prefix}/solicitudes/${id}/evidencia`,
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

export function useCrearRetroactivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CrearRetroactivoPayload) => {
      const { data } = await api.post<SolicitudMantenimiento>(
        `${BASE}/solicitudes/retroactivo`,
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitudes"] }),
  })
}

export function useAprobaciones(solicitudId: number | null) {
  const { http, prefix, portalToken } = useMntApi()
  return useQuery({
    queryKey: ["mantenimiento", "aprobaciones", solicitudId, portalToken],
    queryFn: async () => {
      const { data } = await http.get<Aprobacion[]>(
        `${prefix}/solicitudes/${solicitudId}/aprobaciones`
      )
      return data
    },
    enabled: solicitudId !== null,
  })
}

export function useRegistrarAprobacion() {
  const qc = useQueryClient()
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: AprobacionPayload }) => {
      const { data } = await http.post<Aprobacion>(
        `${prefix}/solicitudes/${id}/aprobacion`,
        payload
      )
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "aprobaciones", vars.id] })
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] })
    },
  })
}

export function useAccionCampoMantenimiento() {
  const qc = useQueryClient()
  const { http, prefix } = useMntApi()
  return useMutation({
    mutationFn: async ({
      id,
      accion,
      evidencia_url,
      monto_real,
      nota,
    }: {
      id: number
      accion: "en_camino" | "completado" | "necesita_repuesto"
      evidencia_url?: string
      monto_real?: number
      nota?: string
    }) => {
      const path = prefix.includes("/portal/")
        ? `${prefix}/solicitudes/${id}/accion-campo`
        : `${BASE}/solicitudes/${id}/accion-campo`
      const { data } = await http.post(path, {
        accion,
        evidencia_url,
        monto_real,
        nota,
      })
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitud", vars.id] })
      qc.invalidateQueries({ queryKey: ["mantenimiento", "solicitudes"] })
    },
  })
}

export function useAuxiliaresPortal() {
  return useQuery({
    queryKey: ["mantenimiento", "auxiliares-portal"],
    queryFn: async () => {
      const { data } = await api.get<AuxiliarPortalOut[]>(
        `${BASE}/config/auxiliares-portal`
      )
      return data
    },
  })
}

export function useRegenerarPortalAuxiliar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: number) => {
      const { data } = await api.post<AuxiliarPortalOut>(
        `${BASE}/config/auxiliares/${userId}/portal/regenerar`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "auxiliares-portal"] })
      qc.invalidateQueries({ queryKey: ["mantenimiento", "acceso-movil"] })
    },
  })
}

export function useMagicLink() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ url: string; token: string }>(
        `${BASE}/solicitudes/${id}/magic-link`
      )
      return data
    },
  })
}

export function useAccesoMovil(solicitudId: number | null) {
  return useQuery({
    queryKey: ["mantenimiento", "acceso-movil", solicitudId],
    queryFn: async () => {
      const { data } = await api.get<AccesoMovilOut>(
        `${BASE}/solicitudes/${solicitudId}/acceso-movil`
      )
      return data
    },
    enabled: solicitudId !== null,
    staleTime: 60_000,
  })
}

export function useRegenerarAccesoMovil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<AccesoMovilOut>(
        `${BASE}/solicitudes/${id}/regenerar-acceso`
      )
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "acceso-movil", id] })
    },
  })
}

export function useMntNotificacionesConfig() {
  return useQuery({
    queryKey: ["mantenimiento", "notificaciones"],
    queryFn: async () => {
      const { data } = await api.get<MntNotificacionesConfig>(
        `${BASE}/config/notificaciones`
      )
      return data
    },
  })
}

export function useActualizarMntNotificaciones() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: MntNotificacionesConfig) => {
      const { data } = await api.patch<MntNotificacionesConfig>(
        `${BASE}/config/notificaciones`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mantenimiento", "notificaciones"] })
      qc.invalidateQueries({ queryKey: ["mantenimiento", "acceso-movil"] })
    },
  })
}

export function useKpisMantenimiento() {
  return useQuery({
    queryKey: ["mantenimiento", "kpis"],
    queryFn: async () => {
      const { data } = await api.get<KpisOut>(`${BASE}/kpis`)
      return data
    },
    staleTime: 2 * 60_000,
  })
}
