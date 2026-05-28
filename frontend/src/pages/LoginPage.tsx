import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useLogin } from "@/hooks/useAuth"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function LoginPage() {
  const navigate = useNavigate()
  const { mutate: login, isPending, error } = useLogin()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login(
      { email, password },
      { onSuccess: () => navigate("/dashboard", { replace: true }) },
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-blue flex-col justify-between p-12 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-brand-yellow/10" />

        <div className="relative z-10">
          <h1 className="text-white text-4xl font-bold tracking-tight">
            ZYMO
            <span className="block text-brand-yellow">Intranet</span>
          </h1>
          <p className="mt-4 text-white/70 text-lg leading-relaxed max-w-sm">
            Portal corporativo del Grupo ZYMO. Accede a todas tus herramientas
            en un solo lugar.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-white/40 text-sm">
            IMCCARGO Internacional · LOGIMAT Zona Franca · IMC Depósito
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center bg-muted px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-brand-blue text-3xl font-bold">
              ZYMO <span className="text-brand-yellow">Intranet</span>
            </h1>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <h2 className="text-2xl font-bold text-foreground">
                Bienvenido
              </h2>
              <p className="text-sm text-muted-foreground">
                Ingresa tus credenciales para acceder
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-1.5"
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
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground mb-1.5"
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
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                    Credenciales incorrectas. Verifica tu correo y contraseña.
                  </div>
                )}

                <Button
                  type="submit"
                  variant="default"
                  disabled={isPending}
                  className="w-full"
                  size="lg"
                >
                  {isPending ? "Ingresando…" : "Ingresar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            ¿Problemas para acceder? Contacta al área de IT
          </p>
        </div>
      </div>
    </div>
  )
}
