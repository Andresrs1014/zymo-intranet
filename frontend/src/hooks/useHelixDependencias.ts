import { useState, useEffect, useCallback, useRef } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixDependencia, HelixDependenciaTipo } from "@/types/helix"

export interface HelixDependenciaCreate {
  nombre: string
  tipo: HelixDependenciaTipo
  responsableArea?: string
}

interface UseHelixDependenciasResult {
  dependencias: HelixDependencia[]
  loading: boolean
  error: string | null
  refetch: () => void
  createDependencia: (data: HelixDependenciaCreate) => Promise<HelixDependencia>
}

export function useHelixDependencias(): UseHelixDependenciasResult {
  const [dependencias, setDependencias] = useState<HelixDependencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

    helixApi
      .get<HelixDependencia[]>("/api/dependencias", { signal: controller.signal })
      .then((res) => {
        if (currentFetch === fetchCountRef.current) {
          setDependencias(res.data)
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
            const msg = err instanceof Error ? err.message : "Error al cargar dependencias"
            setError(msg)
            setLoading(false)
          }
        }
      })
  }, [])

  useEffect(() => {
    fetchData()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchData])

  const createDependencia = useCallback(
    async (data: HelixDependenciaCreate): Promise<HelixDependencia> => {
      try {
        const res = await helixApi.post<HelixDependencia>("/api/dependencias", data)
        fetchData()
        return res.data
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al crear dependencia"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  return { dependencias, loading, error, refetch: fetchData, createDependencia }
}
