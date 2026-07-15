import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { taskApi } from "@/lib/taskApi"

export interface DirectoryCacheEntry {
  id: number
  externalId: string
  nombre: string
  tipo: "persona" | "area"
  intranetUserId: number | null
  syncedAt: string
}

export interface DirectoryCacheStats {
  areas: number
  personas: number
  personasConCuenta: number
  lastSyncedAt: string | null
}

export function useDirectoryPersonas(q: string, enabled: boolean) {
  return useQuery<DirectoryCacheEntry[]>({
    queryKey: ["directoryCache", "persona", q],
    queryFn: async () => {
      const { data } = await taskApi.get<DirectoryCacheEntry[]>("/api/directory/cache", {
        params: { tipo: "persona", q: q || undefined, limit: 30 },
      })
      return data
    },
    enabled,
  })
}

export function useDirectoryStats(enabled: boolean) {
  return useQuery<DirectoryCacheStats>({
    queryKey: ["directoryCache", "stats"],
    queryFn: async () => {
      const { data } = await taskApi.get<DirectoryCacheStats>("/api/directory/stats")
      return data
    },
    enabled,
  })
}

export function useSyncDirectoryCache() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await taskApi.post("/api/directory/sync")
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directoryCache"] })
    },
  })
}
