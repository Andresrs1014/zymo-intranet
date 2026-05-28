import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"

export interface SystemConfig {
  smtp_host?: string
  smtp_port?: string
  smtp_user?: string
  smtp_password?: string // siempre "••••••••" desde la API
  smtp_from?: string
  smtp_enabled?: string
  webhook_powerautomate_url?: string
  webhook_enabled?: string
}

export function useSystemConfig() {
  return useQuery<SystemConfig>({
    queryKey: ["system-config"],
    queryFn: async () => {
      const res = await taskApi.get("/api/config")
      return res.data
    },
  })
}

export function useUpdateSystemConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: Partial<SystemConfig>) => {
      const res = await taskApi.put("/api/config", config)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-config"] }),
  })
}

export function useTestEmail() {
  return useMutation({
    mutationFn: async () => {
      const res = await taskApi.post("/api/config/test-email")
      return res.data
    },
  })
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async () => {
      const res = await taskApi.post("/api/config/test-webhook")
      return res.data
    },
  })
}
