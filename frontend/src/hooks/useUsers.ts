import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { UserListItem } from "@/types/auth"

export interface CreateUserPayload {
  email: string
  password: string
  full_name: string
  role: string
  sede?: string
  area?: string
}

export interface UpdateUserPayload {
  full_name?: string
  role?: string
  sede?: string
  area?: string
}

export function useUsers() {
  return useQuery({
    queryKey: ["users", "active"],
    queryFn: async () => {
      const { data } = await api.get<UserListItem[]>("/auth/users")
      return data
    },
  })
}

export function useArchivedUsers() {
  return useQuery({
    queryKey: ["users", "archived"],
    queryFn: async () => {
      const { data } = await api.get<UserListItem[]>("/auth/users/archived")
      return data
    },
    enabled: false, // solo se carga cuando el tab está activo
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await api.post<UserListItem>("/auth/register", payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & UpdateUserPayload) => {
      const { data } = await api.put<UserListItem>(`/auth/users/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/auth/users/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/auth/users/${id}/eliminar`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })
}

export function useReactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<UserListItem>(`/auth/users/${id}/reactivar`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  })
}

export function getApiError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "detail" in error.response.data
  ) {
    return String((error.response.data as { detail: string }).detail)
  }
  return "Ocurrió un error inesperado."
}
