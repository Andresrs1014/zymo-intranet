import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface SedeItem {
  id: number
  name: string
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

export function useCreateSede() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<SedeItem>("/sedes", { name })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sedes"] }),
  })
}

export function useUpdateSede() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const { data } = await api.patch<SedeItem>(`/sedes/${id}`, { name })
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
