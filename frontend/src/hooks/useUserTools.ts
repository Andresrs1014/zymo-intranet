import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@/store/authStore"
import axios from "axios"

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "" })
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const BASE = "/api/admin"

export function useUserTools(userId: number | null) {
  return useQuery({
    queryKey: ["admin", "user-tools", userId],
    queryFn: async () => {
      const { data } = await api.get<string[]>(`${BASE}/user-tools/${userId}`)
      return data
    },
    enabled: userId !== null,
  })
}

export function useAssignUserTool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ user_id, tool_key }: { user_id: number; tool_key: string }) => {
      await api.post(`${BASE}/asignar-tool`, { user_id, tool_key, scope: "global" })
    },
    onSuccess: (_d, { user_id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "user-tools", user_id] })
    },
  })
}

export function useRevokeUserTool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ user_id, tool_key }: { user_id: number; tool_key: string }) => {
      await api.delete(`${BASE}/revocar-tool`, {
        data: { user_id, tool_key, scope: "global" },
      })
    },
    onSuccess: (_d, { user_id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "user-tools", user_id] })
    },
  })
}
