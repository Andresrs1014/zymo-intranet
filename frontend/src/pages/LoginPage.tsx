import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useLocation, useSearchParams, type Location } from "react-router-dom"
import { useLogin } from "@/hooks/useAuth"
import { useAuthStore } from "@/store/authStore"
import { api } from "@/lib/api"
import { EXTERNAL_APPS } from "@/lib/roles"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"

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
  const [verClave, setVerClave] = useState(false)

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
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-4 max-md:justify-start max-md:px-6 max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:pt-[calc(3.5rem+env(safe-area-inset-top))]">
      {/* Logo + wordmark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <img
          src="/brand/zymo_logo.png"
          alt="ZYMO"
          className="h-10 w-auto object-contain max-md:h-14"
        />
        <p className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">
          Intranet
        </p>
      </div>

      {/* Form container */}
      <div className="w-full max-w-[360px]">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground max-md:text-[26px] max-md:font-bold max-md:text-[#18181B]">Bienvenido</h1>
          <p className="mt-1 text-sm text-muted-foreground max-md:text-[#71717A]">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-md:border-0 max-md:p-0 max-md:shadow-none">
          <form onSubmit={handleSubmit} className="space-y-4 max-md:space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground max-md:font-mono max-md:text-[11px] max-md:uppercase max-md:tracking-wider max-md:text-[#71717A]"
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
                className="bg-white max-md:h-[52px] max-md:rounded-xl max-md:border-[#E4E4E7] max-md:px-4 max-md:text-[15px]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground max-md:font-mono max-md:text-[11px] max-md:uppercase max-md:tracking-wider max-md:text-[#71717A]"
              >
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={verClave ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white max-md:h-[52px] max-md:rounded-xl max-md:border-[#E4E4E7] max-md:pl-4 max-md:pr-12 max-md:text-[15px]"
                />
                {/* Solo en el teléfono: ver la contraseña mientras se escribe */}
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={verClave}
                  className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#71717A] md:hidden"
                >
                  {verClave ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
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
              className="w-full mt-1 max-md:mt-3 max-md:h-[54px] max-md:rounded-[14px] max-md:bg-[#C3182A] max-md:text-base max-md:font-bold"
              size="default"
            >
              {isPending ? "Ingresando…" : <><span className="md:hidden">Ingresar</span><span className="hidden md:inline">Continuar</span></>}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground max-md:text-[13px]">
          ¿Problemas para acceder?{" "}
          <span className="text-foreground/60">Contacta al área de IT</span>
        </p>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center max-md:mt-auto max-md:pt-10">
        <p className="text-xs text-muted-foreground/50">
          IMCCARGO · LOGIMAT · IMC Depósito
        </p>
      </div>
    </div>
  )
}
