import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { TC_EMPRESA_PALETTE } from "@/lib/tc-constants"
import {
  ArrowLeft, Search, Building2, Download, Upload, Users, UserCheck, Inbox,
} from "lucide-react"

interface Empresa { id: number; nombre: string }
interface Analista { id: number; nombre: string; sede_id: number }

interface Asignacion {
  sede_id: number
  sede_nombre: string
  persona_id: number | null
  persona_nombre: string
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
  items: Cliente[]
}

export function TyCClientesPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [analistas, setAnalistas]   = useState<Analista[]>([])
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [stats, setStats]           = useState({ total: 0, asignados: 0, pendientes: 0 })
  const [busqueda, setBusqueda]     = useState("")
  const [loading, setLoading]       = useState(true)
  const [importing, setImporting]   = useState(false)
  const [banner, setBanner]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [savingId, setSavingId]     = useState<number | null>(null)

  useEffect(() => {
    api.get("/tc/empresas").then((r) => setEmpresas(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    api.get("/tc/clientes/analistas").then((r) => setAnalistas(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (busqueda.trim()) params.q = busqueda.trim()
      const { data } = await api.get<ClientesResponse>("/tc/clientes", { params })
      setClientes(data.items)
      setStats({ total: data.total, asignados: data.asignados, pendientes: data.pendientes })
    } catch {
      setBanner({ ok: false, msg: "No se pudieron cargar los clientes." })
    } finally {
      setLoading(false)
    }
  }, [busqueda])

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [cargar])

  const analistasPorSede = useMemo(() => {
    const m = new Map<number, Analista[]>()
    for (const a of analistas) {
      const list = m.get(a.sede_id) ?? []
      list.push(a)
      m.set(a.sede_id, list)
    }
    return m
  }, [analistas])

  const empresaColorMap = useMemo(
    () => new Map(empresas.map((e, i) => [e.id, TC_EMPRESA_PALETTE[i % TC_EMPRESA_PALETTE.length]])),
    [empresas],
  )

  async function asignar(cliente: Cliente, sedeId: number, personaId: string) {
    if (!puedeEditar) return
    setSavingId(cliente.id)
    const asignaciones = empresas.map((e) => {
      const cur = cliente.asignaciones[String(e.id)]
      const pid = e.id === sedeId
        ? (personaId ? Number(personaId) : null)
        : (cur?.persona_id ?? null)
      return { sede_id: e.id, persona_id: pid }
    })
    try {
      const { data } = await api.put(`/tc/clientes/${cliente.id}`, { asignaciones })
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? data : c)))
      setStats((s) => {
        const asignados = clientes.filter((c) =>
          c.id === cliente.id
            ? asignaciones.some((a) => a.persona_id)
            : Object.values(c.asignaciones).some((a) => a.persona_id),
        ).length
        return { ...s, asignados, pendientes: s.total - asignados }
      })
      void cargar()
    } catch {
      setBanner({ ok: false, msg: "Error al guardar asignación." })
    } finally {
      setSavingId(null)
    }
  }

  async function descargarPlantilla() {
    try {
      const { data } = await api.get("/tc/clientes/plantilla", { responseType: "blob" })
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "Plantilla_Clientes_TYC.xlsx"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setBanner({ ok: false, msg: "No se pudo descargar la plantilla." })
    }
  }

  async function handleImport(file: File) {
    if (!puedeEditar) return
    setImporting(true)
    setBanner(null)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const { data } = await api.post("/tc/clientes/import/excel", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setBanner({
        ok: true,
        msg: `Importación: ${data.created} creados, ${data.updated} actualizados${data.skipped ? `, ${data.skipped} omitidos` : ""}.`,
      })
      void cargar()
    } catch {
      setBanner({ ok: false, msg: "No se pudo importar el Excel." })
    } finally {
      setImporting(false)
    }
  }

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
                Cartera activa y asignación de analistas de operaciones por empresa.
              </p>
            </div>
            {puedeEditar && (
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void descargarPlantilla()}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs border border-input rounded-lg hover:bg-accent transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Plantilla
                </button>
                <label className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors cursor-pointer">
                  {importing ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Importar Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={importing}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleImport(f)
                      e.target.value = ""
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <KpiCard icon={<Building2 className="w-4 h-4" />} label="Clientes activos" value={stats.total} />
            <KpiCard icon={<UserCheck className="w-4 h-4" />} label="Asignados" value={stats.asignados} color="text-emerald-400" />
            <KpiCard icon={<Inbox className="w-4 h-4" />} label="Por asignar" value={stats.pendientes} color="text-amber-400" />
            <KpiCard icon={<Users className="w-4 h-4" />} label="Analistas" value={analistas.length} color="text-teal-400" />
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
        <div className={`mx-8 mt-3 px-4 py-2.5 rounded-lg text-sm ${
          banner.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          {banner.msg}
        </div>
      )}

      <div className="flex-1 overflow-auto max-w-6xl mx-auto w-full px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando clientes…
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Building2 className="w-8 h-8 opacity-30" />
            <span className="text-sm">Sin clientes registrados.</span>
            {puedeEditar && (
              <span className="text-xs">Importa un Excel o crea clientes desde la plantilla.</span>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">No Cliente</th>
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Nombre</th>
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">DUME</th>
                {empresas.map((e) => (
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
                <tr key={c.id} className={`border-b border-border/40 ${i % 2 ? "bg-muted/5" : ""}`}>
                  <td className="py-2.5 font-mono text-xs font-semibold">{c.client_no}</td>
                  <td className="py-2.5 text-sm">{c.nombre}</td>
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{c.dume_no || "—"}</td>
                  {empresas.map((e) => {
                    const asig = c.asignaciones[String(e.id)]
                    const val = asig?.persona_id ? String(asig.persona_id) : ""
                    const opts = analistasPorSede.get(e.id) ?? []
                    return (
                      <td key={e.id} className="py-2 pr-2">
                        {puedeEditar ? (
                          <select
                            value={val}
                            disabled={savingId === c.id}
                            onChange={(ev) => void asignar(c, e.id, ev.target.value)}
                            className="w-full h-8 px-2 text-xs bg-muted/20 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— Sin asignar —</option>
                            {opts.map((a) => (
                              <option key={a.id} value={a.id}>{a.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">{asig?.persona_nombre || "—"}</span>
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
}: { icon: React.ReactNode; label: string; value: number; color?: string }) {
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
