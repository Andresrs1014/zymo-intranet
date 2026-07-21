import { useEffect, useState, useCallback, useMemo } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { TC_EMPRESA_PALETTE } from "@/lib/tc-constants"
import {
  ArrowLeft, Search, Building2, Download, Upload, Users, UserCheck, Inbox,
  Settings2, X, AlertTriangle,
} from "lucide-react"

interface SedeCartera { id: number; nombre: string; activa_en_cartera: boolean }
interface Analista { id: number; nombre: string; sede_id: number }

interface Asignacion {
  sede_id: number
  sede_nombre: string
  persona_id: number | null
  persona_nombre: string
  habilitada: boolean
}

interface AnalistaTicket { id: number; nombre: string; email: string }

interface Cliente {
  id: number
  client_no: string
  dume_no: string
  nombre: string
  activo: boolean
  asignaciones: Record<string, Asignacion>
  analistas_tickets: AnalistaTicket[]
}

interface ClientesResponse {
  total: number
  asignados: number
  pendientes: number
  sedes_activas: number[]
  items: Cliente[]
}

export function OperClientesPage() {
  const navigate = useNavigate()

  const [sedes, setSedes]           = useState<SedeCartera[]>([])
  const [analistas, setAnalistas]   = useState<Analista[]>([])
  const [personasLista, setPersonasLista] = useState<{ id: number; nombre: string }[]>([])
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [stats, setStats]           = useState({ total: 0, asignados: 0, pendientes: 0 })
  const [busqueda, setBusqueda]     = useState("")
  const [loading, setLoading]       = useState(true)
  const [importing, setImporting]   = useState(false)
  const [banner, setBanner]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [savingId, setSavingId]     = useState<number | null>(null)
  const [drawerSedes, setDrawerSedes] = useState(false)
  const [sedesDraft, setSedesDraft] = useState<SedeCartera[]>([])
  const [savingSedes, setSavingSedes] = useState(false)

  const sedesActivas = useMemo(
    () => sedes.filter((s) => s.activa_en_cartera),
    [sedes],
  )

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
    () => new Map(sedesActivas.map((e, i) => [e.id, TC_EMPRESA_PALETTE[i % TC_EMPRESA_PALETTE.length]])),
    [sedesActivas],
  )

  const cargarMeta = useCallback(async () => {
    const [sRes, aRes, pRes] = await Promise.all([
      api.get<SedeCartera[]>("/operativo/clientes/sedes"),
      api.get<Analista[]>("/operativo/clientes/analistas"),
      api.get("/tc/personas", { params: { estado: "Activo", limit: 500 } }),
    ])
    setSedes(Array.isArray(sRes.data) ? sRes.data : [])
    setAnalistas(Array.isArray(aRes.data) ? aRes.data : [])
    setPersonasLista(Array.isArray(pRes.data?.items) ? pRes.data.items : [])
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (busqueda.trim()) params.q = busqueda.trim()
      const { data } = await api.get<ClientesResponse>("/operativo/clientes", { params })
      setClientes(data.items)
      setStats({ total: data.total, asignados: data.asignados, pendientes: data.pendientes })
    } catch {
      setBanner({ ok: false, msg: "No se pudieron cargar los clientes." })
    } finally {
      setLoading(false)
    }
  }, [busqueda])

  useEffect(() => { void cargarMeta() }, [cargarMeta])
  useEffect(() => {
    const t = setTimeout(() => { void cargar() }, 300)
    return () => clearTimeout(t)
  }, [cargar])

  function buildPayload(cliente: Cliente, patch: Partial<Record<number, { habilitada: boolean; persona_id: number | null }>>) {
    const merged: Record<number, { habilitada: boolean; persona_id: number | null }> = {}
    for (const s of sedesActivas) {
      const cur = cliente.asignaciones[String(s.id)]
      merged[s.id] = {
        habilitada: cur?.habilitada ?? false,
        persona_id: cur?.persona_id ?? null,
      }
    }
    Object.assign(merged, patch)
    return sedesActivas
      .filter((s) => merged[s.id]?.habilitada)
      .map((s) => ({
        sede_id: s.id,
        persona_id: merged[s.id]?.persona_id ?? null,
      }))
  }

  async function guardarAsignacion(
    cliente: Cliente,
    sedeId: number,
    patch: { habilitada?: boolean; persona_id?: number | null },
  ) {
    setSavingId(cliente.id)
    const cur = cliente.asignaciones[String(sedeId)]
    const habilitada = patch.habilitada ?? cur?.habilitada ?? false
    let personaId = patch.persona_id !== undefined ? patch.persona_id : (cur?.persona_id ?? null)

    if (patch.habilitada === true && personaId == null) {
      const opts = analistasPorSede.get(sedeId) ?? []
      if (opts.length === 1) personaId = opts[0].id
    }

    const asignaciones = buildPayload(cliente, {
      [sedeId]: { habilitada, persona_id: personaId },
    })

    try {
      const { data } = await api.put(`/operativo/clientes/${cliente.id}`, { asignaciones })
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? data : c)))
      void cargar()
    } catch {
      setBanner({ ok: false, msg: "Error al guardar asignación." })
    } finally {
      setSavingId(null)
    }
  }

  async function guardarAnalistasTickets(cliente: Cliente, personaIds: number[]) {
    setSavingId(cliente.id)
    try {
      const { data } = await api.put(`/operativo/clientes/${cliente.id}`, { analistas_tickets: personaIds })
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? data : c)))
    } catch {
      setBanner({ ok: false, msg: "Error al guardar analistas de tickets." })
    } finally {
      setSavingId(null)
    }
  }

  async function descargarPlantilla() {
    try {
      const { data } = await api.get("/operativo/clientes/plantilla", { responseType: "blob" })
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "Plantilla_Cargue_Clientes.xlsx"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setBanner({ ok: false, msg: "No se pudo descargar la plantilla." })
    }
  }

  async function handleImport(file: File) {
    setImporting(true)
    setBanner(null)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const { data } = await api.post("/operativo/clientes/import/excel", fd, {
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

  function abrirDrawerSedes() {
    setSedesDraft(sedes.map((s) => ({ ...s })))
    setDrawerSedes(true)
  }

  async function guardarSedes() {
    setSavingSedes(true)
    try {
      const inactivas = sedesDraft.filter((s) => !s.activa_en_cartera).map((s) => s.id)
      const { data } = await api.put<SedeCartera[]>("/operativo/clientes/sedes", {
        sedes_inactivas: inactivas,
      })
      setSedes(data)
      setDrawerSedes(false)
      void cargar()
      setBanner({ ok: true, msg: "Sedes de cartera actualizadas." })
    } catch {
      setBanner({ ok: false, msg: "No se pudo guardar la configuración de sedes." })
    } finally {
      setSavingSedes(false)
    }
  }

  return (
    <PageLayout title="Operativo — Cartera de clientes" mainClassName="flex-1 flex flex-col overflow-hidden">

      <div className="px-8 pt-6 pb-0 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => navigate("/operativo")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Operativo
            </button>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-sm font-medium">Cartera de clientes</span>
          </div>

          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h1 className="text-base font-semibold">Clientes corporativos</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Importación y asignación de analistas de operaciones por sede activa.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={abrirDrawerSedes}
                className="flex items-center gap-1.5 h-8 px-3 text-xs border border-input rounded-lg hover:bg-accent transition-colors"
                title="Configurar sedes visibles"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Sedes
              </button>
              <button
                type="button"
                onClick={() => void descargarPlantilla()}
                className="flex items-center gap-1.5 h-8 px-3 text-xs border border-input rounded-lg hover:bg-accent transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Plantilla
              </button>
              <label className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
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
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <KpiCard icon={<Building2 className="w-4 h-4" />} label="Clientes activos" value={stats.total} />
            <KpiCard icon={<UserCheck className="w-4 h-4" />} label="Asignados" value={stats.asignados} color="text-emerald-500" />
            <KpiCard icon={<Inbox className="w-4 h-4" />} label="Por asignar" value={stats.pendientes} color="text-amber-500" />
            <KpiCard icon={<Users className="w-4 h-4" />} label="Analistas" value={analistas.length} color="text-primary" />
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
          banner.ok ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
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
            <span className="text-xs">Importa el Excel con la plantilla oficial.</span>
          </div>
        ) : sedesActivas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <AlertTriangle className="w-8 h-8 opacity-40 text-amber-500" />
            <span className="text-sm">No hay sedes activas en la cartera.</span>
            <button type="button" onClick={abrirDrawerSedes} className="text-xs text-primary hover:underline">
              Configurar sedes
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">No Cliente</th>
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Nombre</th>
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">DUME</th>
                {sedesActivas.map((e) => (
                  <th key={e.id} className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[168px]">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${empresaColorMap.get(e.id)?.badge ?? ""}`}>
                      {e.nombre}
                    </span>
                  </th>
                ))}
                <th className="py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase min-w-[180px]">
                  Analistas de tickets
                </th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr key={c.id} className={`border-b border-border/40 ${i % 2 ? "bg-muted/5" : ""}`}>
                  <td className="py-2.5 font-mono text-xs font-semibold">{c.client_no}</td>
                  <td className="py-2.5 text-sm">{c.nombre}</td>
                  <td className="py-2.5 font-mono text-xs text-muted-foreground">{c.dume_no || "—"}</td>
                  {sedesActivas.map((e) => {
                    const asig = c.asignaciones[String(e.id)]
                    const habilitada = asig?.habilitada ?? false
                    const val = asig?.persona_id ? String(asig.persona_id) : ""
                    const opts = analistasPorSede.get(e.id) ?? []
                    const busy = savingId === c.id
                    return (
                      <td key={e.id} className="py-2 pr-2 align-top">
                        <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/5 p-2">
                          <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={habilitada}
                              disabled={busy}
                              onChange={(ev) => void guardarAsignacion(c, e.id, { habilitada: ev.target.checked })}
                              className="rounded border-input"
                            />
                            Operación en sede
                          </label>
                          <select
                            value={val}
                            disabled={!habilitada || busy}
                            onChange={(ev) => void guardarAsignacion(c, e.id, {
                              habilitada: true,
                              persona_id: ev.target.value ? Number(ev.target.value) : null,
                            })}
                            className="w-full h-8 px-2 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                          >
                            <option value="">{opts.length ? "Seleccione analista" : "Sin analistas en sede"}</option>
                            {opts.map((a) => (
                              <option key={a.id} value={a.id}>{a.nombre}</option>
                            ))}
                          </select>
                          {habilitada && !val && (
                            <p className="text-[9px] text-amber-600 font-medium">Analista obligatorio</p>
                          )}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-2 pr-2 align-top">
                    <select
                      multiple
                      size={Math.min(4, Math.max(2, personasLista.length))}
                      value={c.analistas_tickets.map((a) => String(a.id))}
                      disabled={savingId === c.id}
                      onChange={(ev) => {
                        const ids = Array.from(ev.target.selectedOptions).map((o) => Number(o.value))
                        void guardarAnalistasTickets(c, ids)
                      }}
                      className="w-full text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                      title="Quién atiende los tickets de este cliente — usado para autocompletar Zymo Ally"
                    >
                      {personasLista.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drawerSedes && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar"
            onClick={() => setDrawerSedes(false)}
          />
          <aside className="relative w-full max-w-sm h-full bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold">Sedes en cartera</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Solo las sedes activas aparecen en la matriz de asignación.
                </p>
              </div>
              <button type="button" onClick={() => setDrawerSedes(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {sedesDraft.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border hover:bg-muted/30 cursor-pointer"
                >
                  <span className="text-sm font-medium">{s.nombre}</span>
                  <input
                    type="checkbox"
                    checked={s.activa_en_cartera}
                    onChange={(ev) => setSedesDraft((prev) =>
                      prev.map((x) => x.id === s.id ? { ...x, activa_en_cartera: ev.target.checked } : x),
                    )}
                    className="rounded border-input"
                  />
                </label>
              ))}
            </div>
            <div className="p-5 border-t border-border">
              <button
                type="button"
                disabled={savingSedes}
                onClick={() => void guardarSedes()}
                className="w-full h-9 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {savingSedes ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          </aside>
        </div>
      )}
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
