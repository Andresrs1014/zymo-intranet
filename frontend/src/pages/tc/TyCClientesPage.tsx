import { useEffect, useState, useCallback, useMemo } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { TC_EMPRESA_PALETTE } from "@/lib/tc-constants"
import {
  ArrowLeft, Search, Building2, Users, UserCheck, Inbox, Info, Check,
} from "lucide-react"

interface SedeCol { id: number; nombre: string }

interface Asignacion {
  sede_id: number
  sede_nombre: string
  persona_id: number | null
  persona_nombre: string
  habilitada: boolean
}

interface Cliente {
  id: number
  client_no: string
  dume_no: string
  nombre: string
  activo: boolean
  asignaciones: Record<string, Asignacion>
}

interface ClientesResponse {
  total: number
  asignados: number
  pendientes: number
  sedes_activas: number[]
  items: Cliente[]
}

export function TyCClientesPage() {
  const navigate = useNavigate()

  const [sedes, setSedes]         = useState<SedeCol[]>([])
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [stats, setStats]         = useState({ total: 0, asignados: 0, pendientes: 0 })
  const [busqueda, setBusqueda]   = useState("")
  const [loading, setLoading]     = useState(true)
  const [banner, setBanner]       = useState<{ ok: boolean; msg: string } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (busqueda.trim()) params.q = busqueda.trim()
      const { data } = await api.get<ClientesResponse>("/tc/clientes", { params })
      setClientes(data.items)
      setStats({ total: data.total, asignados: data.asignados, pendientes: data.pendientes })

      const ids = data.sedes_activas ?? []
      const nameMap = new Map<number, string>()
      for (const c of data.items) {
        for (const a of Object.values(c.asignaciones)) {
          if (a.sede_nombre) nameMap.set(a.sede_id, a.sede_nombre)
        }
      }
      setSedes(ids.map((id) => ({ id, nombre: nameMap.get(id) ?? `Sede ${id}` })))
    } catch {
      setBanner({ ok: false, msg: "No se pudieron cargar los clientes." })
    } finally {
      setLoading(false)
    }
  }, [busqueda])

  useEffect(() => {
    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
  }, [cargar])

  const empresaColorMap = useMemo(
    () => new Map(sedes.map((e, i) => [e.id, TC_EMPRESA_PALETTE[i % TC_EMPRESA_PALETTE.length]])),
    [sedes],
  )

  return (
    <PageLayout title="T&C — Clientes" mainClassName="flex-1 flex flex-col overflow-hidden">

      <div className="px-8 pt-6 pb-0 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => navigate("/tc")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              T&C
            </button>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-sm font-medium">Clientes</span>
          </div>

          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <h1 className="text-base font-semibold">Clientes corporativos</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vista de consulta — importación y asignación en Operaciones.
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm text-indigo-200/90">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
            <p>
              Esta vista es <strong className="font-medium text-indigo-100">solo lectura</strong>.
              Coordinadores gestionan la cartera en{" "}
              <span className="font-mono text-xs text-indigo-300">Operativo → Cartera de clientes</span>.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <KpiCard icon={<Building2 className="w-4 h-4" />} label="Clientes activos" value={stats.total} />
            <KpiCard icon={<UserCheck className="w-4 h-4" />} label="Asignados" value={stats.asignados} color="text-emerald-400" />
            <KpiCard icon={<Inbox className="w-4 h-4" />} label="Por asignar" value={stats.pendientes} color="text-amber-400" />
            <KpiCard icon={<Users className="w-4 h-4" />} label="Sedes activas" value={sedes.length} color="text-teal-400" />
          </div>

          <div className="relative max-w-xs pb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por cliente, DUME o número…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/20 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {banner && (
        <div className="mx-8 mt-3 px-4 py-2.5 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20">
          {banner.msg}
        </div>
      )}

      <div className="flex-1 overflow-auto max-w-6xl mx-auto w-full px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm animate-pulse">
            Cargando clientes…
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Building2 className="w-8 h-8 opacity-30" />
            <span className="text-sm">Sin clientes registrados.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">No Cliente</th>
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Nombre</th>
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">DUME</th>
                {sedes.map((e) => (
                  <th key={e.id} className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[140px]">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${empresaColorMap.get(e.id)?.badge ?? ""}`}>
                      {e.nombre}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr key={c.id} className={`border-b border-border/40 transition-colors ${i % 2 ? "bg-muted/5" : ""}`}>
                  <td className="py-2.5 font-mono text-xs font-semibold">{c.client_no}</td>
                  <td className="py-2.5 text-sm">{c.nombre}</td>
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{c.dume_no || "—"}</td>
                  {sedes.map((e) => {
                    const asig = c.asignaciones[String(e.id)]
                    const habilitada = asig?.habilitada ?? false
                    return (
                      <td key={e.id} className="py-2 pr-2 align-top">
                        {habilitada ? (
                          <div className="rounded-lg border border-border/60 bg-muted/5 px-2.5 py-2 space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                              <Check className="w-3 h-3" />
                              En operación
                            </span>
                            <p className="text-xs text-foreground">{asig?.persona_nombre || "Sin analista"}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  )
}

function KpiCard({
  icon, label, value, color = "text-foreground",
}: { icon: ReactNode; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/5 px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`} style={{ fontFamily: "'DM Mono', monospace" }}>
        {value}
      </p>
    </div>
  )
}
