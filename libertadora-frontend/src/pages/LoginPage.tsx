import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLogin } from "@/hooks/useLibertadora"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const login = useLogin()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate({ email, password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--lib-navy)" }}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <h1 className="text-lg font-bold" style={{ color: "var(--lib-navy)" }}>Libertadora Seguros</h1>
        <p className="mb-6 mt-1 text-xs text-zinc-500">Gestión comercial · Skandia CREA</p>

        <div className="grid gap-1.5">
          <Label>Correo</Label>
          <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label>Contraseña</Label>
          <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {login.isError && (
          <p className="mt-3 text-xs font-medium text-red-600">Correo o contraseña incorrectos.</p>
        )}

        <Button type="submit" disabled={login.isPending} className="mt-5 w-full" style={{ background: "var(--lib-teal)" }}>
          {login.isPending ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
    </div>
  )
}
