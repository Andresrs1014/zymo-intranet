import { useState, type FormEvent } from "react"
import { useNavigate, useLocation, type Location } from "react-router-dom"
import { useLogin } from "@/hooks/useAuth"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mutate: login, isPending, error } = useLogin()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const from = (location.state as { from?: Location } | null)?.from
    const dest = from ? `${from.pathname}${from.search}${from.hash}` : "/dashboard"
    login(
      { email, password },
      { onSuccess: () => navigate(dest, { replace: true }) },
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
