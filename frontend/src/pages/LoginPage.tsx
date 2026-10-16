import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useLocation, useSearchParams, type Location } from "react-router-dom"
import { useLogin } from "@/hooks/useAuth"
import { useAuthStore } from "@/store/authStore"
import { api } from "@/lib/api"
import { EXTERNAL_APPS } from "@/lib/roles"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// ponytail: the redirect target comes from EXTERNAL_APPS (a trusted, code-controlled list),
// never from a query-string value — so there's no open-redirect surface to validate against.
async function redirectToSsoApp(appId: string): Promise<void> {
  const app = EXTERNAL_APPS.find((a) => a.id === appId)
  if (!app?.sso_endpoint || !app.url) return
  // api's baseURL already points at the backend root — strip the "/api" prefix that
  // AppCard.tsx's same-origin fetch() relies on (that one goes through the frontend's
  // own proxy, this one calls the backend directly).
  const backendPath = app.sso_endpoint.replace(/^\/api/, "")
  const { data } = await api.get<{ sso_token: string }>(backendPath)
  window.location.href = `${app.url}/?sso_token=${data.sso_token}`
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { mutate: login, isPending, error } = useLogin()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const ssoAppId = searchParams.get("app")
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Covers both cases with one path: arriving already logged in, and just having logged
  // in via the form below (isAuthenticated flips true, this re-fires either way).
  useEffect(() => {
    if (ssoAppId && isAuthenticated) {
      void redirectToSsoApp(ssoAppId)
    }
  }, [ssoAppId, isAuthenticated])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (ssoAppId) {
      login({ email, password })
      return
    }
    const from = (location.state as { from?: Location } | null)?.from
    const dest = from ? `${from.pathname}${from.search}${from.hash}` : "/dashboard"
    login(
      { email, password },
      { onSuccess: () => navigate(dest, { replace: true }) },
    )
  }

  if (ssoAppId && isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Logo + wordmark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img
          src="/brand/zymo_logo.png"
          alt="ZYMO"
          className="h-10 w-auto object-contain"
        />
        <p className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">
          Intranet
        </p>
      </div>

      {/* Form container */}
      <div className="w-full max-w-[360px]">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Bienvenido</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@zymo.com"
                className="bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-white"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                Credenciales incorrectas. Verifica tu correo y contraseña.
              </div>
            )}

            <Button
              type="submit"
              variant="default"
              disabled={isPending}
              className="w-full mt-1"
              size="default"
            >
              {isPending ? "Ingresando…" : "Continuar"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Problemas para acceder?{" "}
          <span className="text-foreground/60">Contacta al área de IT</span>
        </p>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center">
        <p className="text-xs text-muted-foreground/50">
          IMCCARGO · LOGIMAT · IMC Depósito
        </p>
      </div>
    </div>
  )
}
