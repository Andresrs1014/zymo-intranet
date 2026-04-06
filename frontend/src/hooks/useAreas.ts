import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface AreaItem {
  id: number
  name: string
}

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data } = await api.get<AreaItem[]>("/areas")
      return data
    },
  })
}

export function useCreateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<AreaItem>("/areas", { name })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  })
}

export function useUpdateArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const { data } = await api.patch<AreaItem>(`/areas/${id}`, { name })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  })
}

export function useDeleteArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/areas/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["areas"] }),
  })
}
