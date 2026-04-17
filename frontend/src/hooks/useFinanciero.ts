import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Factura, FacturaUpdate, SolicitudConFactura, ValidacionFactura } from "@/types/financiero"

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
