import { useState, useEffect, useCallback, useRef } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixActividad, HelixEstado } from "@/types/helix"

export interface HelixActividadCreate {
  subproyectoId: number
  responsableId: number
  nombre: string
  estado?: string
  prioridad?: string
  fechaInicio: string
  fechaFin: string
  avance?: number
  puntos?: number
  costoInversion?: number
  costoOptimizacion?: number
  costoEjecucion?: number
  bloqueada?: boolean
  dependenciaId?: number
}

interface UseHelixActividadesOptions {
  subproyectoId?: number
  responsableId?: number
  bloqueada?: boolean
}

interface UseHelixActividadesResult {
  actividades: HelixActividad[]
  loading: boolean
  error: string | null
  refetch: () => void
  updateEstado: (id: number, estado: HelixEstado) => Promise<void>
  createActividad: (data: HelixActividadCreate) => Promise<void>
  updateActividad: (id: number, data: Partial<HelixActividadCreate>) => Promise<void>
  deleteActividad: (id: number) => Promise<void>
}

export function useHelixActividades(
  opts?: UseHelixActividadesOptions
): UseHelixActividadesResult {
  const [actividades, setActividades] = useState<HelixActividad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fetchCountRef = useRef(0)

  const fetchData = useCallback(() => {
    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    const currentFetch = ++fetchCountRef.current

    setLoading(true)
    setError(null)

    const params: Record<string, string | number | boolean> = {}
    if (opts?.subproyectoId !== undefined) params.subproyectoId = opts.subproyectoId
    if (opts?.responsableId !== undefined) params.responsableId = opts.responsableId
    if (opts?.bloqueada !== undefined) params.bloqueada = opts.bloqueada

    helixApi
      .get<HelixActividad[]>("/api/actividades", {
        params,
        signal: controller.signal,
      })
      .then((res) => {
        if (currentFetch === fetchCountRef.current) {
          setActividades(res.data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (currentFetch === fetchCountRef.current) {
          const isAbort =
            err instanceof Error && err.name === "AbortError"
          const axiosAbort =
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code?: string }).code === "ERR_CANCELED"
          if (!isAbort && !axiosAbort) {
            const msg =
              err instanceof Error ? err.message : "Error al cargar actividades"
            setError(msg)
            setLoading(false)
          }
        }
      })
  }, [opts?.subproyectoId, opts?.responsableId, opts?.bloqueada])

  useEffect(() => {
    fetchData()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [fetchData])

  const updateEstado = useCallback(
    async (id: number, estado: HelixEstado): Promise<void> => {
      // Optimistic update
      setActividades((prev) =>
        prev.map((a) => (a.id === id ? { ...a, estado } : a))
      )
      try {
        await helixApi.patch(`/api/actividades/${id}/estado`, { estado })
        // Re-fetch for consistency
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al actualizar estado"
        setError(msg)
        // Revert by refetching
        fetchData()
      }
    },
    [fetchData]
  )

  const createActividad = useCallback(
    async (data: HelixActividadCreate): Promise<void> => {
      try {
        await helixApi.post("/api/actividades", data)
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al crear actividad"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  const updateActividad = useCallback(
    async (id: number, data: Partial<HelixActividadCreate>): Promise<void> => {
      try {
        await helixApi.put(`/api/actividades/${id}`, data)
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al actualizar actividad"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  const deleteActividad = useCallback(
    async (id: number): Promise<void> => {
      try {
        await helixApi.delete(`/api/actividades/${id}`)
        fetchData()
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al eliminar actividad"
        setError(msg)
        throw err
      }
    },
    [fetchData]
  )

  return {
    actividades,
    loading,
    error,
    refetch: fetchData,
    updateEstado,
    createActividad,
    updateActividad,
    deleteActividad,
  }
}
