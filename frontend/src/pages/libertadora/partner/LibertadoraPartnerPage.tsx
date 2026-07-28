import { useState } from "react"
import { LogOut, Users, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePartnerLogin } from "@/hooks/useLibertadoraPartner"
import { useLibertadoraPartnerStore } from "@/store/libertadoraPartnerStore"
import { PartnerProspectosPanel } from "./PartnerProspectosPanel"
import { PartnerCitasPanel } from "./PartnerCitasPanel"
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

function PartnerPanel() {
  const { nombre, email, clearSession } = useLibertadoraPartnerStore()
  const [tab, setTab] = useState<"prospectos" | "citas">("prospectos")

  return (
    <div className="libertadora-scope min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between px-6 py-4 text-white" style={{ background: "var(--lib-navy)" }}>
        <div>
          <h1 className="text-sm font-bold">Libertadora Seguros · Skandia CREA</h1>
          <p className="text-xs opacity-70">{nombre ?? email}</p>
        </div>
        <Button type="button" variant="ghost" className="gap-1.5 text-white hover:bg-white/10 hover:text-white" onClick={() => clearSession()}>
          <LogOut className="h-4 w-4" /> Salir
        </Button>
      </header>

      <div className="border-b border-zinc-200 bg-white px-6 py-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "prospectos" | "citas")}>
          <TabsList className="bg-[color:var(--lib-teal-l)]">
            <TabsTrigger value="prospectos" className="gap-1.5 data-[state=active]:bg-[color:var(--lib-teal)] data-[state=active]:text-white">
              <Users className="h-4 w-4" /> Prospectos
            </TabsTrigger>
            <TabsTrigger value="citas" className="gap-1.5 data-[state=active]:bg-[color:var(--lib-teal)] data-[state=active]:text-white">
              <CalendarDays className="h-4 w-4" /> Citas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <main className="p-6">
        {tab === "prospectos" && <PartnerProspectosPanel />}
        {tab === "citas" && <PartnerCitasPanel />}
      </main>
    </div>
  )
}

export function LibertadoraPartnerPage() {
  const token = useLibertadoraPartnerStore((s) => s.token)
  return token ? <PartnerPanel /> : <PartnerLoginForm />
}
