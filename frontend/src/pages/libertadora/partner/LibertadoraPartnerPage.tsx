import { useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePartnerLogin } from "@/hooks/useLibertadoraPartner"
import { useLibertadoraPartnerStore } from "@/store/libertadoraPartnerStore"
import { LibertadoraProvider, useLibertadora } from "@/context/LibertadoraContext"
import { LibertadoraHeader } from "@/components/libertadora/LibertadoraHeader"
import { LibertadoraTabsBar } from "@/components/libertadora/LibertadoraTabsBar"
import { PartnerDashboardPanel } from "./PartnerDashboardPanel"
import { PartnerProspectosPanel } from "./PartnerProspectosPanel"
import { PartnerCitasPanel } from "./PartnerCitasPanel"
import { PartnerInformeView } from "./PartnerInformeView"
import "@/styles/libertadora.css"

function PartnerLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const login = usePartnerLogin()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    login.mutate({ email, password })
  }

  return (
    <div className="libertadora-scope flex min-h-screen items-center justify-center p-6" style={{ background: "var(--lib-navy)" }}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <h1 className="text-lg font-bold" style={{ color: "var(--lib-navy)" }}>Libertadora Seguros</h1>
        <p className="mb-6 mt-1 text-xs text-zinc-500">Acceso de socio · Skandia CREA</p>

        <div className="grid gap-1.5">
          <Label>Correo</Label>
          <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@skandia.com.co" />
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

function PartnerContent() {
  const { activeView } = useLibertadora()
  return (
    <>
      {activeView === "dashboard" && <PartnerDashboardPanel />}
      {activeView === "prospectos" && <PartnerProspectosPanel />}
      {activeView === "citas" && <PartnerCitasPanel />}
      {activeView === "informe" && <PartnerInformeView />}
    </>
  )
}

function PartnerPanel() {
  const clearSession = useLibertadoraPartnerStore((s) => s.clearSession)

  return (
    <LibertadoraProvider>
      <div className="libertadora-scope min-h-screen bg-zinc-50">
        <div className="relative">
          <LibertadoraHeader />
          <Button
            type="button"
            variant="ghost"
            className="absolute right-4 top-4 gap-1.5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => clearSession()}
          >
            <LogOut className="h-4 w-4" /> Salir
          </Button>
        </div>
        <LibertadoraTabsBar />
        <main className="p-6">
          <PartnerContent />
        </main>
      </div>
    </LibertadoraProvider>
  )
}

export function LibertadoraPartnerPage() {
  const token = useLibertadoraPartnerStore((s) => s.token)
  return token ? <PartnerPanel /> : <PartnerLoginForm />
}
