import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export interface RoleItem {
  id: number
  name: string
  label: string
  description: string | null
  app_permissions: string[]
}

export interface CreateRolePayload {
  name: string
  label: string
  description?: string
  app_permissions?: string[]
}

export interface UpdateRolePayload {
  label?: string
  description?: string
  app_permissions?: string[]
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data } = await api.get<RoleItem[]>("/roles")
      return data
    },
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateRolePayload) => {
      const { data } = await api.post<RoleItem>("/roles", payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & UpdateRolePayload) => {
      const { data } = await api.patch<RoleItem>(`/roles/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/roles/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function getApiError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const res = (err as { response?: { data?: { detail?: string } } }).response
    return res?.data?.detail ?? "Error inesperado."
  }
  return "Error inesperado."
}
