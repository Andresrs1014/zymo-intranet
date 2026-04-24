import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type {
  CuentaContable,
  Factura,
  FacturaCuenta,
  FacturaUpdate,
  SolicitudConFactura,
  TipoGasto,
  ValidacionFactura,
} from "@/types/financiero"

export function useSolicitudesFinanciero() {
  return useQuery({
    queryKey: ["financiero", "facturas"],
    queryFn: async () => {
      const { data } = await api.get<SolicitudConFactura[]>("/api/financiero/facturas")
      return data
    },
  })
}

export function useFactura(facturaId: string | null) {
  return useQuery({
    queryKey: ["financiero", "facturas", facturaId],
    queryFn: async () => {
      const { data } = await api.get<Factura>(`/api/financiero/facturas/${facturaId}`)
      return data
    },
    enabled: !!facturaId,
  })
}

export function useValidaciones(facturaId: string | null) {
  return useQuery({
    queryKey: ["financiero", "validaciones", facturaId],
    queryFn: async () => {
      const { data } = await api.get<ValidacionFactura[]>(
        `/api/financiero/facturas/${facturaId}/validaciones`
      )
      return data
    },
    enabled: !!facturaId,
  })
}

export function useSubirFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ solicitudId, file }: { solicitudId: string; file: File }) => {
      const formData = new FormData()
      formData.append("file", file)
      const { data } = await api.post<Factura>(
        `/api/financiero/facturas/${solicitudId}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiero"] })
    },
  })
}

export function useActualizarFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ facturaId, data }: { facturaId: string; data: FacturaUpdate }) => {
      const { data: result } = await api.patch<Factura>(
        `/api/financiero/facturas/${facturaId}`,
        data
      )
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiero"] })
    },
  })
}

export function useValidarFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (facturaId: string) => {
      const { data } = await api.post<ValidacionFactura[]>(
        `/api/financiero/facturas/${facturaId}/validar`,
        {}
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiero"] })
    },
  })
}

export function useEliminarFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (facturaId: string) => {
      await api.delete(`/api/financiero/facturas/${facturaId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiero"] })
    },
  })
}

// ── Configuración financiera ──────────────────────────────────────────────────

export function useTiposGasto() {
  return useQuery({
    queryKey: ["financiero", "config", "tipos-gasto"],
    queryFn: async () => {
      const { data } = await api.get<TipoGasto[]>("/api/financiero/config/tipos-gasto")
      return data
    },
  })
}

export function useCrearTipoGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nombre: string) => {
      const { data } = await api.post<TipoGasto>("/api/financiero/config/tipos-gasto", { nombre })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiero", "config"] }),
  })
}

export function useEliminarTipoGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/financiero/config/tipos-gasto/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiero", "config"] }),
  })
}

export function useCuentasContables(soloActivas = true) {
  return useQuery({
    queryKey: ["financiero", "config", "cuentas", soloActivas],
    queryFn: async () => {
      const { data } = await api.get<CuentaContable[]>("/api/financiero/config/cuentas", {
        params: { solo_activas: soloActivas },
      })
      return data
    },
  })
}

export function useCrearCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { numero_cuenta: string; nombre_cuenta: string; tipo_gasto_id?: number }) => {
      const { data } = await api.post<CuentaContable>("/api/financiero/config/cuentas", payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiero", "config"] }),
  })
}

export function useActualizarCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; activo?: boolean; tipo_gasto_id?: number | null; numero_cuenta?: string; nombre_cuenta?: string }) => {
      const { data } = await api.patch<CuentaContable>(`/api/financiero/config/cuentas/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiero", "config"] }),
  })
}

export function useEliminarCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/financiero/config/cuentas/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiero", "config"] }),
  })
}

// ── Cuentas asignadas a factura ───────────────────────────────────────────────

export function useFacturaCuentas(facturaId: string | null) {
  return useQuery({
    queryKey: ["financiero", "factura-cuentas", facturaId],
    queryFn: async () => {
      const { data } = await api.get<FacturaCuenta[]>(`/api/financiero/facturas/${facturaId}/cuentas`)
      return data
    },
    enabled: !!facturaId,
  })
}

export function useAsignarCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ facturaId, cuentaId }: { facturaId: string; cuentaId: number }) => {
      const { data } = await api.post<FacturaCuenta>(
        `/api/financiero/facturas/${facturaId}/cuentas`,
        { cuenta_id: cuentaId }
      )
      return data
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["financiero", "factura-cuentas", vars.facturaId] }),
  })
}

export function useQuitarCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ facturaId, asignacionId }: { facturaId: string; asignacionId: number }) => {
      await api.delete(`/api/financiero/facturas/${facturaId}/cuentas/${asignacionId}`)
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["financiero", "factura-cuentas", vars.facturaId] }),
  })
}
