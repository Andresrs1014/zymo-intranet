import { useState, useEffect, useCallback, useRef } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixProyecto } from "@/types/helix"

export interface HelixProyectoCreate {
  nombre: string
}

interface UseHelixProyectosResult {
  proyectos: HelixProyecto[]
  loading: boolean
  error: string | null
  refetch: () => void
  createProyecto: (data: HelixProyectoCreate) => Promise<HelixProyecto>
}

export function useHelixProyectos(): UseHelixProyectosResult {
  const [proyectos, setProyectos] = useState<HelixProyecto[]>([])
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
      .get<HelixProyecto[]>("/api/proyectos", { signal: controller.signal })
      .then((res) => {
        if (currentFetch === fetchCountRef.current) {
          setProyectos(res.data)
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
            const msg = err instanceof Error ? err.message : "Error al cargar proyectos"
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

  const createProyecto = useCallback(
    async (data: HelixProyectoCreate): Promise<HelixProyecto> => {
      try {
        const res = await helixApi.post<HelixProyecto>("/api/proyectos", data)
        fetchData()
        return res.data
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al crear proyecto"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  return { proyectos, loading, error, refetch: fetchData, createProyecto }
}
