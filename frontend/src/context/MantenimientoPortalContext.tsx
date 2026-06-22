import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { portalHttp } from "@/lib/portalApi"
import type { PortalSession } from "@/types/mantenimiento"

interface PortalContextValue {
  portalToken: string
  session: PortalSession
  client: typeof portalHttp
  apiPrefix: string
  detallePath: (id: number) => string
  listaPath: string
}

const MantenimientoPortalContext = createContext<PortalContextValue | null>(null)

export function useMantenimientoPortal() {
  return useContext(MantenimientoPortalContext)
}

export function MantenimientoPortalProvider({ children }: { children: ReactNode }) {
  const { portalToken = "" } = useParams<{ portalToken: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<PortalSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!portalToken) return
    portalHttp
      .get<PortalSession>(`/api/mantenimiento/portal/${portalToken}/session`)
      .then(({ data }) => {
        setSession(data)
        const open = searchParams.get("open")
        if (open && /^\d+$/.test(open)) {
          navigate(`/m/portal/${portalToken}/${open}`, { replace: true })
        }
      })
      .catch(() => setError("Portal inválido o revocado. Solicita un enlace nuevo."))
  }, [portalToken, searchParams, navigate])

  const value = useMemo((): PortalContextValue | null => {
    if (!portalToken || !session) return null
    return {
      portalToken,
      session,
      client: portalHttp,
      apiPrefix: `/api/mantenimiento/portal/${portalToken}`,
      detallePath: (id) => `/m/portal/${portalToken}/${id}`,
      listaPath: `/m/portal/${portalToken}`,
    }
  }, [portalToken, session])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center max-w-sm">
          <p className="text-red-600 font-semibold mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">
            El enlace puede haber sido regenerado por administración.
          </p>
        </div>
      </div>
    )
  }

  if (!value) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-muted-foreground">Cargando portal…</p>
      </div>
    )
  }

  return (
    <MantenimientoPortalContext.Provider value={value}>
      {children}
    </MantenimientoPortalContext.Provider>
  )
}
