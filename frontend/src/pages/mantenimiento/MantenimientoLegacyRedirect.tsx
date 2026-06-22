import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

const API = "/api/mantenimiento"

interface Props {
  mode: "jwt" | "stable"
}

/** Redirige /m/q/... y /m/jwt... al portal permanente del auxiliar. */
export default function MantenimientoLegacyRedirect({ mode }: Props) {
  const { token, accessToken } = useParams<{ token?: string; accessToken?: string }>()
  const mobileToken = mode === "stable" ? accessToken : token
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mobileToken) return
    fetch(`${API}/m/${mobileToken}/redirect`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.detail || "Enlace inválido")
        }
        return r.json() as Promise<{ url: string }>
      })
      .then(({ url }) => {
        window.location.replace(url)
      })
      .catch((e: Error) => setError(e.message))
  }, [mobileToken])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-sm text-muted-foreground">Abriendo portal…</p>
    </div>
  )
}
