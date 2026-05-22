import { useState, useEffect, useCallback, useRef } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixSubproyecto, HelixSubproyectoForm } from "@/types/helix"

interface UseHelixSubproyectosResult {
  subproyectos: HelixSubproyecto[]
  loading: boolean
  error: string | null
  refetch: () => void
  createSubproyecto: (data: HelixSubproyectoForm) => Promise<void>
  updateSubproyecto: (id: number, data: Partial<HelixSubproyectoForm>) => Promise<void>
  deleteSubproyecto: (id: number) => Promise<void>
}

export function useHelixSubproyectos(): UseHelixSubproyectosResult {
  const [subproyectos, setSubproyectos] = useState<HelixSubproyecto[]>([])
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
      .get<HelixSubproyecto[]>("/api/subproyectos", {
        signal: controller.signal,
      })
      .then((res) => {
        if (currentFetch === fetchCountRef.current) {
          setSubproyectos(res.data)
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
              err instanceof Error ? err.message : "Error al cargar subproyectos"
            setError(msg)
            setLoading(false)
          }
        }
      })
  }, [])

  useEffect(() => {
    fetchData()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [fetchData])

  const createSubproyecto = useCallback(
    async (data: HelixSubproyectoForm): Promise<void> => {
      try {
        await helixApi.post("/api/subproyectos", data)
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al crear subproyecto"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  const updateSubproyecto = useCallback(
    async (id: number, data: Partial<HelixSubproyectoForm>): Promise<void> => {
      try {
        await helixApi.put(`/api/subproyectos/${id}`, data)
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al actualizar subproyecto"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  const deleteSubproyecto = useCallback(
    async (id: number): Promise<void> => {
      try {
        await helixApi.delete(`/api/subproyectos/${id}`)
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al eliminar subproyecto"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  return {
    subproyectos,
    loading,
    error,
    refetch: fetchData,
    createSubproyecto,
    updateSubproyecto,
    deleteSubproyecto,
  }
}
