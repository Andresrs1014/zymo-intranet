import { useState, useEffect, useCallback, useRef } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixDashboardData } from "@/types/helix"

interface UseHelixDashboardResult {
  data: HelixDashboardData | null
  loading: boolean
  error: string | null
  refetch: () => void
  subproyectoId: number | undefined
  setSubproyectoId: (id: number | undefined) => void
}

export function useHelixDashboard(): UseHelixDashboardResult {
  const [data, setData] = useState<HelixDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subproyectoId, setSubproyectoId] = useState<number | undefined>(undefined)

  const abortRef = useRef<AbortController | null>(null)
  const fetchCountRef = useRef(0)

  const fetchData = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    const currentFetch = ++fetchCountRef.current

    setLoading(true)
    setError(null)

    const params: Record<string, string | number> = {}
    if (subproyectoId !== undefined) params.subproyectoId = subproyectoId

    helixApi
      .get<HelixDashboardData>("/api/dashboard", {
        params,
        signal: controller.signal,
      })
      .then((res) => {
        if (currentFetch === fetchCountRef.current) {
          setData(res.data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (currentFetch === fetchCountRef.current) {
          const isAbort = err instanceof Error && err.name === "AbortError"
          const axiosAbort =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code?: string }).code === "ERR_CANCELED"
          if (!isAbort && !axiosAbort) {
            const msg =
              err instanceof Error ? err.message : "Error al cargar dashboard"
            setError(msg)
            setLoading(false)
          }
        }
      })
  }, [subproyectoId])

  useEffect(() => {
    fetchData()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    subproyectoId,
    setSubproyectoId,
  }
}
