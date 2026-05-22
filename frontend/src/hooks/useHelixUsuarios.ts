import { useState, useEffect, useCallback, useRef } from "react"
import { helixApi } from "@/lib/helixApi"
import type { HelixUsuario } from "@/types/helix"

interface UseHelixUsuariosResult {
  usuarios: HelixUsuario[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useHelixUsuarios(): UseHelixUsuariosResult {
  const [usuarios, setUsuarios] = useState<HelixUsuario[]>([])
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
      .get<HelixUsuario[]>("/api/usuarios", {
        signal: controller.signal,
      })
      .then((res) => {
        if (currentFetch === fetchCountRef.current) {
          setUsuarios(res.data)
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
              err instanceof Error ? err.message : "Error al cargar usuarios"
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

  return {
    usuarios,
    loading,
    error,
    refetch: fetchData,
  }
}
