import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface SedeItem {
  id: number
  name: string
  visible_en_solicitudes_oc: boolean
}

export function useSedes() {
  return useQuery({
    queryKey: ["sedes"],
    queryFn: async () => {
      const { data } = await api.get<SedeItem[]>("/sedes")
      return data
    },
  })
}

/** Sedes que pueden elegirse como plataforma de formalización en solicitudes de compra (excluye p. ej. Transversal). */
export function useSedesParaSolicitudesOc() {
  return useQuery({
    queryKey: ["sedes", { paraOc: true }],
    queryFn: async () => {
      const { data } = await api.get<SedeItem[]>("/sedes", {
        params: { para_solicitudes_oc: true },
      })
      return data
    },
  })
}

export function useCreateSede() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; visible_en_solicitudes_oc?: boolean }) => {
      const { data } = await api.post<SedeItem>("/sedes", {
        name: body.name,
        visible_en_solicitudes_oc: body.visible_en_solicitudes_oc ?? true,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sedes"] }),
  })
}

export function useUpdateSede() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: number
      name?: string
      visible_en_solicitudes_oc?: boolean
    }) => {
      const body: Record<string, unknown> = {}
      if (payload.name !== undefined) body.name = payload.name
      if (payload.visible_en_solicitudes_oc !== undefined) {
        body.visible_en_solicitudes_oc = payload.visible_en_solicitudes_oc
      }
      const { data } = await api.patch<SedeItem>(`/sedes/${payload.id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sedes"] }),
  })
}

export function useDeleteSede() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sedes/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sedes"] }),
  })
}
