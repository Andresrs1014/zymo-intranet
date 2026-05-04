// frontend/src/hooks/useExtraccionIA.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: number
  label_raw: string
  campo_sugerido: string | null
  confianza_ia: "alta" | "media" | "baja"
  tipo_documento: string
  estado: "pendiente" | "aprobado" | "rechazado"
  contexto_id: string | null
  fragmento_texto: string | null
  creado_en: string
}

export interface LearnedSynonym {
  id: number
  label: string
  canonical_field: string
  tipo_documento: string
  aprobado_por_email: string
  veces_visto: number
  creado_en: string
}

export interface ExtraccionMetricas {
  total_candidatos: number
  pendientes: number
  aprobados: number
  rechazados: number
  total_sinonimos_aprendidos: number
  campos_canonicos_disponibles: string[]
}

export interface Phase2Result {
  phase2_disponible: boolean
  phase2_campos_completados: string[]
  phase2_campos_count: number
  [key: string]: unknown
}

// ── Hooks admin ───────────────────────────────────────────────────────────────

export function useColaCandidatos(estado = "pendiente") {
  return useQuery({
    queryKey: ["extraccion-ia", "cola", estado],
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data } = await api.get(`/api/admin/extraccion/cola?estado=${estado}`)
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useAprobarCandidato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, canonical_field }: { id: number; canonical_field: string }) => {
      const { data } = await api.post(`/api/admin/extraccion/${id}/aprobar`, { canonical_field })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraccion-ia"] })
    },
  })
}

export function useRechazarCandidato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/admin/extraccion/${id}/rechazar`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraccion-ia"] })
    },
  })
}

export function useSinonimosAprendidos() {
  return useQuery({
    queryKey: ["extraccion-ia", "sinonimos"],
    queryFn: async (): Promise<LearnedSynonym[]> => {
      const { data } = await api.get("/api/admin/extraccion/sinonimos")
      return data
    },
  })
}

export function useEliminarSinonimo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/admin/extraccion/sinonimos/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraccion-ia"] })
    },
  })
}

export function useMetricasExtraccion() {
  return useQuery({
    queryKey: ["extraccion-ia", "metricas"],
    queryFn: async (): Promise<ExtraccionMetricas> => {
      const { data } = await api.get("/api/admin/extraccion/metricas")
      return data
    },
    staleTime: 60_000,
  })
}

// ── Poll Fase 2 (usado en CotizacionFormPage) ─────────────────────────────────

export function usePhase2Poll(
  solicitudId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["extraccion-phase2", solicitudId],
    queryFn: async (): Promise<Phase2Result | null> => {
      const { data, status } = await api.get(
        `/api/oc/solicitudes/${solicitudId}/cotizacion/extraccion/resultado`,
        { validateStatus: (s) => s === 200 || s === 204 }
      )
      if (status === 204) return null  // Gemini aún procesando
      return data as Phase2Result
    },
    enabled: !!solicitudId && enabled,
    refetchInterval: (query) => {
      // Dejar de hacer poll cuando Fase 2 esté disponible
      if (query.state.data?.phase2_disponible) return false
      return 2500  // Poll cada 2.5s mientras espera
    },
    retry: false,
  })
}
