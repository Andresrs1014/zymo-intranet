import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useLogin } from "@/hooks/useAuth"

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
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-brand-blue text-3xl font-bold">
              ZYMO <span className="text-brand-yellow">Intranet</span>
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Bienvenido
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              Ingresa tus credenciales para acceder
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@zymo.com"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                  Credenciales incorrectas. Verifica tu correo y contraseña.
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-blue/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? "Ingresando…" : "Ingresar"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            ¿Problemas para acceder? Contacta al área de IT
          </p>
        </div>
      </div>
    </div>
  )
}
