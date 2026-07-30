import { useEffect, useState, useCallback, type ReactNode } from "react"
import { api } from "@/lib/api"
import { downloadBlob } from "@/lib/downloadBlob"
import {
  RefreshCw, Search, X, GraduationCap,
  BookOpen, Clock, Users, Award, Download,
} from "lucide-react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CapStats {
  total: number
  completadas: number
  completacion_pct: number
  horas_promedio: number
  personas_capacitadas: number
  cobertura_pct: number
}

interface Area { id: number; name: string }

interface Capacitacion {
  id: number
  titulo: string
  persona_nombre: string
  persona_id: number
  cargo_nombre: string
  area_nombre: string
  fecha: string
  horas: number
  estado: string
  tipo: string
  costo: number | null
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_STATS: CapStats = {
  total: 45, completadas: 32, completacion_pct: 71,
  horas_promedio: 12.5, personas_capacitadas: 28, cobertura_pct: 55,
}

const MOCK_CAPS: Capacitacion[] = [
  { id: 1, titulo: "Inducción HSEQ 2026", persona_nombre: "Carlos Pérez",
    persona_id: 1, cargo_nombre: "Auxiliar Logístico", area_nombre: "Operaciones",
    fecha: "2026-06-10", horas: 8, estado: "Completado", tipo: "Interna", costo: 0 },
  { id: 2, titulo: "Manejo de Montacargas", persona_nombre: "Luisa Ramírez",
    persona_id: 2, cargo_nombre: "Operaria de Bodega", area_nombre: "Bodega",
    fecha: "2026-06-20", horas: 16, estado: "Pendiente", tipo: "Externa", costo: 350000 },
  { id: 3, titulo: "Normativa Aduanera 2026", persona_nombre: "Pedro Gómez",
    persona_id: 3, cargo_nombre: "Analista de Operaciones", area_nombre: "Comercial",
    fecha: "2026-07-05", horas: 4, estado: "Programado", tipo: "Externa", costo: 180000 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  "Completado": "bg-emerald-500/10 text-emerald-400",
  "Pendiente":  "bg-amber-500/10 text-amber-400",
  "Programado": "bg-blue-500/10 text-blue-400",
  "Cancelado":  "bg-white/5 text-muted-foreground",
}

const ESTADO_OPTS = ["Todos", "Programado", "Completado", "Pendiente", "Cancelado"]
const TIPO_OPTS = ["Interna", "Externa"]

const TIPO_BADGE: Record<string, string> = {
  "Interna": "bg-teal-500/10 text-teal-400",
  "Externa": "bg-violet-500/10 text-violet-400",
}

function formatoCosto(v: number | null) {
  if (v == null) return "—"
  return `$${v.toLocaleString("es-CO")}`
}

function coberturaColor(pct: number) {
  if (pct >= 80) return "text-emerald-400"
  if (pct >= 50) return "text-amber-400"
  return "text-red-400"
}

// "2026-07" -> { desde: "2026-07-01", hasta: "2026-07-31" }
function rangoDelMes(mes: string): { desde: string; hasta: string } | null {
  if (!mes) return null
  const [anio, m] = mes.split("-").map(Number)
  const hasta = new Date(anio, m, 0).getDate()
  return { desde: `${mes}-01`, hasta: `${mes}-${String(hasta).padStart(2, "0")}` }
}

// ── Componente principal ────────────────────────────────────────────────────────
// Registro de solo lectura — la creación/edición real vive en Agenda
// (TyCAgendaEventoPage), este componente se embebe como pestaña "Registro"
// dentro de esa misma sección. No tiene acciones de escritura: cada fila
// viene de un evento de Agenda ya sincronizado en el backend.

export function CapacitacionesRegistro() {
  const [stats, setStats]   = useState<CapStats | null>(null)
  const [caps, setCaps]     = useState<Capacitacion[]>([])
  const [areas, setAreas]   = useState<Area[]>([])

  const [loading, setLoading] = useState(true)

  // Filtros
  const [busqueda, setBusqueda]   = useState("")
  const [areaFiltro, setAreaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("Todos")
  const [tipoFiltro, setTipoFiltro] = useState("Todos")
  const [mesFiltro, setMesFiltro] = useState("") // "YYYY-MM", vacío = todos los meses
  const [exportando, setExportando] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/tc/capacitaciones/stats")
      setStats(data)
    } catch { setStats(MOCK_STATS) }
  }, [])

  function filtrosActuales(): Record<string, string> {
    const params: Record<string, string> = {}
    if (areaFiltro) params.area_id = areaFiltro
    if (estadoFiltro !== "Todos") params.estado = estadoFiltro
    if (tipoFiltro !== "Todos") params.tipo = tipoFiltro
    const rango = rangoDelMes(mesFiltro)
    if (rango) { params.fecha_desde = rango.desde; params.fecha_hasta = rango.hasta }
    return params
  }

  const loadCaps = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get("/tc/capacitaciones", { params: filtrosActuales() })
      setCaps(Array.isArray(data) ? data : [])
    } catch {
      setCaps(MOCK_CAPS)
    } finally { setLoading(false) }
  }, [areaFiltro, estadoFiltro, tipoFiltro, mesFiltro])

  async function handleExport() {
    setExportando(true)
    try {
      const res = await api.get("/tc/capacitaciones/exportar", {
        params: filtrosActuales(),
        responseType: "blob",
      })
      downloadBlob(res.data, "capacitaciones.xlsx")
    } finally {
      setExportando(false)
    }
  }

  const loadAreas = useCallback(async () => {
    try {
      const { data } = await api.get("/tc/areas")
      setAreas(Array.isArray(data) ? data : [])
    } catch {
      setAreas([])
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadAreas() }, [loadAreas])
  useEffect(() => { loadCaps() }, [loadCaps])

  const filtered = busqueda.trim()
    ? caps.filter((c) =>
        c.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.persona_nombre.toLowerCase().includes(busqueda.toLowerCase())
      )
    : caps

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Stats cards ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<BookOpen className="w-4 h-4 text-teal-400" />}
            label="Total registros"
            value={stats.total}
            sub={`${stats.completadas} completadas`}
            color="text-foreground"
          />
          <StatCard
            icon={<Award className="w-4 h-4 text-emerald-400" />}
            label="% Completación"
            value={`${stats.completacion_pct}%`}
            color="text-emerald-400"
            barColor="bg-emerald-400"
            barPct={stats.completacion_pct}
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-blue-400" />}
            label="Horas promedio / persona"
            value={stats.horas_promedio.toFixed(1)}
            color="text-blue-400"
          />
          <StatCard
            icon={<Users className="w-4 h-4 text-amber-400" />}
            label="% Cobertura personal"
            value={`${stats.cobertura_pct}%`}
            color={coberturaColor(stats.cobertura_pct)}
            barColor={
              stats.cobertura_pct >= 80 ? "bg-emerald-400"
                : stats.cobertura_pct >= 50 ? "bg-amber-400" : "bg-red-400"
            }
            barPct={stats.cobertura_pct}
          />
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por título o persona…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-muted/20 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {areas.length > 0 && (
          <select
            value={areaFiltro}
            onChange={(e) => setAreaFiltro(e.target.value)}
            className="combo"
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="combo"
        >
          {ESTADO_OPTS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="combo"
        >
          <option value="Todos">Interna y externa</option>
          {TIPO_OPTS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <input
          type="month"
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          title="Filtrar por mes"
          className="combo"
        />
        {mesFiltro && (
          <button
            onClick={() => setMesFiltro("")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors -ml-1"
            title="Quitar filtro de mes"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => { loadStats(); loadCaps() }}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-input hover:bg-accent transition-colors"
          title="Recargar"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        <button
          onClick={handleExport}
          disabled={exportando}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-input hover:bg-accent transition-colors text-sm disabled:opacity-50"
          title="Exportar a Excel según los filtros actuales"
        >
          {exportando ? (
            <div className="w-3.5 h-3.5 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          Exportar
        </button>
      </div>

      {/* ── Tabla ── */}
      <div className="rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-muted-foreground">
            <GraduationCap className="w-8 h-8 opacity-20" />
            <span className="text-sm">Sin resultados para los filtros actuales.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Título
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Persona
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Cargo
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Área
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Horas
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Costo
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${
                      i % 2 === 0 ? "" : "bg-muted/5"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium leading-tight">{c.titulo}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm">{c.persona_nombre}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <p className="text-xs text-muted-foreground">{c.cargo_nombre}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <p className="text-xs text-muted-foreground">{c.area_nombre}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground tabular-nums">{c.fecha}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground tabular-nums">{c.horas}h</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        TIPO_BADGE[c.tipo] ?? "bg-muted text-muted-foreground"
                      }`}>
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground tabular-nums">{formatoCosto(c.costo)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ESTADO_BADGE[c.estado] ?? "bg-muted text-muted-foreground"
                      }`}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .combo {
          height: 36px;
          padding: 0 1.75rem 0 0.625rem;
          font-size: 0.8rem;
          background: transparent;
          border: 1px solid hsl(var(--input));
          border-radius: 0.5rem;
          color: inherit;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.45rem center;
          min-width: 150px;
          cursor: pointer;
        }
        .combo:focus { outline: none; box-shadow: 0 0 0 1px hsl(var(--ring)); }
      `}</style>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color = "text-foreground", barColor, barPct,
}: {
  icon: ReactNode
  label: string
  value: number | string
  sub?: string
  color?: string
  barColor?: string
  barPct?: number
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3.5">
      <div className={`flex items-center gap-1.5 text-muted-foreground mb-2 ${color}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums tracking-tight font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      {barColor !== undefined && barPct !== undefined && (
        <div className="mt-3 h-[3px] bg-muted/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.max(barPct, 2)}%` }}
          />
        </div>
      )}
    </div>
  )
}
