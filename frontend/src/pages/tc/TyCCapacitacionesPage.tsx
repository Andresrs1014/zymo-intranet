import { useEffect, useState, useCallback, type ReactNode } from "react"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  Plus, RefreshCw, Search, X, GraduationCap,
  BookOpen, Clock, Users, Award,
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

interface Persona {
  id: number
  nombre: string
  cargo_nombre: string
}

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
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_STATS: CapStats = {
  total: 45, completadas: 32, completacion_pct: 71,
  horas_promedio: 12.5, personas_capacitadas: 28, cobertura_pct: 55,
}

const MOCK_CAPS: Capacitacion[] = [
  { id: 1, titulo: "Inducción HSEQ 2026", persona_nombre: "Carlos Pérez",
    persona_id: 1, cargo_nombre: "Auxiliar Logístico", area_nombre: "Operaciones",
    fecha: "2026-06-10", horas: 8, estado: "Completado" },
  { id: 2, titulo: "Manejo de Montacargas", persona_nombre: "Luisa Ramírez",
    persona_id: 2, cargo_nombre: "Operaria de Bodega", area_nombre: "Bodega",
    fecha: "2026-06-20", horas: 16, estado: "Pendiente" },
  { id: 3, titulo: "Normativa Aduanera 2026", persona_nombre: "Pedro Gómez",
    persona_id: 3, cargo_nombre: "Analista de Operaciones", area_nombre: "Comercial",
    fecha: "2026-07-05", horas: 4, estado: "Programado" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  "Completado": "bg-emerald-500/10 text-emerald-400",
  "Pendiente":  "bg-amber-500/10 text-amber-400",
  "Programado": "bg-blue-500/10 text-blue-400",
  "Cancelado":  "bg-white/5 text-muted-foreground",
}

const ESTADO_OPTS = ["Todos", "Programado", "Completado", "Pendiente", "Cancelado"]

function coberturaColor(pct: number) {
  if (pct >= 80) return "text-emerald-400"
  if (pct >= 50) return "text-amber-400"
  return "text-red-400"
}

// ── Componente principal ────────────────────────────────────────────────────────

export function TyCCapacitacionesPage() {
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [stats, setStats]   = useState<CapStats | null>(null)
  const [caps, setCaps]     = useState<Capacitacion[]>([])
  const [areas, setAreas]   = useState<Area[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])

  const [loading, setLoading] = useState(true)

  // Filtros
  const [busqueda, setBusqueda]   = useState("")
  const [areaFiltro, setAreaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("Todos")

  // Modales
  const [modalAgendar, setModalAgendar]     = useState(false)
  const [modalCompletar, setModalCompletar] = useState<Capacitacion | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/tc/capacitaciones/stats")
      setStats(data)
    } catch { setStats(MOCK_STATS) }
  }, [])

  const loadCaps = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (areaFiltro) params.area_id = areaFiltro
      if (estadoFiltro !== "Todos") params.estado = estadoFiltro
      const { data } = await api.get("/tc/capacitaciones", { params })
      setCaps(Array.isArray(data) ? data : [])
    } catch {
      setCaps(MOCK_CAPS)
    } finally { setLoading(false) }
  }, [areaFiltro, estadoFiltro])

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
    <PageLayout title="T&C — Capacitaciones" mainClassName="flex-1 overflow-y-auto">

      {/* ── Header ── */}
      <div className="border-b border-border px-8 pt-8 pb-6">
        <div className="max-w-6xl mx-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-500 mb-1">
              Talento y Cultura · Gestión corporativa
            </p>
            <h1 className="text-2xl font-bold">Capacitaciones</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestión y seguimiento de formación corporativa
            </p>
          </div>
          {puedeEditar && (
            <button
              onClick={() => setModalAgendar(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agendar capacitación
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6 space-y-6">

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

          <button
            onClick={() => { loadStats(); loadCaps() }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-input hover:bg-accent transition-colors"
            title="Recargar"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
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
                      Estado
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Acciones
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
                          ESTADO_BADGE[c.estado] ?? "bg-muted text-muted-foreground"
                        }`}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.estado !== "Completado" && puedeEditar && (
                          <button
                            onClick={() => setModalCompletar(c)}
                            className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                          >
                            Completar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Agendar ── */}
      {modalAgendar && (
        <ModalAgendar
          personas={personas}
          onPersonasLoad={setPersonas}
          onClose={() => setModalAgendar(false)}
          onCreada={() => { setModalAgendar(false); loadCaps(); loadStats() }}
        />
      )}

      {/* ── Modal Completar ── */}
      {modalCompletar && (
        <ModalCompletar
          cap={modalCompletar}
          onClose={() => setModalCompletar(null)}
          onCompletada={() => { setModalCompletar(null); loadCaps(); loadStats() }}
        />
      )}

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
    </PageLayout>
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

// ── Modal Agendar ─────────────────────────────────────────────────────────────

function ModalAgendar({
  personas,
  onPersonasLoad,
  onClose,
  onCreada,
}: {
  personas: Persona[]
  onPersonasLoad: (p: Persona[]) => void
  onClose: () => void
  onCreada: () => void
}) {
  const [loading, setLoading]   = useState(personas.length > 0)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")
  const [form, setForm] = useState({
    titulo: "", fecha: "", horas: "", observaciones: "",
  })
  const [seleccionados, setSeleccionados] = useState<number[]>([])

  useEffect(() => {
    if (personas.length > 0) { setLoading(false); return }
    api.get("/tc/personas?limit=300")
      .then((r) => {
        const items = Array.isArray(r.data.items) ? r.data.items
          : Array.isArray(r.data) ? r.data : []
        onPersonasLoad(items.map((p: Record<string, unknown>) => ({
          id: p.id as number,
          nombre: p.nombre as string,
          cargo_nombre: (p.cargo_nombre as string) || "",
        })))
      })
      .catch(() => onPersonasLoad([]))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id: number) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function guardar() {
    if (!form.titulo.trim() || !form.fecha || !form.horas || seleccionados.length === 0) {
      setError("Completa todos los campos obligatorios.")
      return
    }
    setSaving(true); setError("")
    try {
      await api.post("/tc/capacitaciones/bulk", {
        titulo: form.titulo.trim(),
        fecha: form.fecha,
        horas: parseFloat(form.horas),
        persona_ids: seleccionados,
        observaciones: form.observaciones.trim(),
      })
      onCreada()
    } catch {
      setError("No se pudo agendar la capacitación.")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Agendar capacitación</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Crea una sesión de formación para varias personas</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <Field label="Título *" required>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Ej: Capacitación en Seguridad Industrial"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha *" required>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input"
              />
            </Field>
            <Field label="Horas *" required>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.horas}
                onChange={(e) => setForm((p) => ({ ...p, horas: e.target.value }))}
                placeholder="Ej: 8"
                className="input"
              />
            </Field>
          </div>

          <Field label="Personas *" required>
            {loading ? (
              <div className="input flex items-center gap-2 text-muted-foreground text-sm">
                <div className="w-3.5 h-3.5 border border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                Cargando personas…
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-40 overflow-y-auto divide-y divide-border">
                  {personas.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionados.includes(p.id)}
                        onChange={() => toggle(p.id)}
                        className="rounded border-input"
                      />
                      <div>
                        <p className="text-sm font-medium leading-tight">{p.nombre}</p>
                        {p.cargo_nombre && (
                          <p className="text-[10px] text-muted-foreground">{p.cargo_nombre}</p>
                        )}
                      </div>
                    </label>
                  ))}
                  {personas.length === 0 && (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Sin personas disponibles
                    </div>
                  )}
                </div>
                {seleccionados.length > 0 && (
                  <div className="px-3 py-2 bg-teal-500/10 border-t border-border text-xs text-teal-400">
                    {seleccionados.length} persona{seleccionados.length !== 1 ? "s" : ""} seleccionada{seleccionados.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Observaciones">
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
              placeholder="Notas adicionales (opcional)"
              rows={3}
              className="input resize-none"
            />
          </Field>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-input rounded-lg hover:bg-accent transition-colors">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
            ) : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Completar ────────────────────────────────────────────────────────────

function ModalCompletar({
  cap,
  onClose,
  onCompletada,
}: {
  cap: Capacitacion
  onClose: () => void
  onCompletada: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [form, setForm]     = useState({ score: "", diploma_url: "" })

  async function guardar() {
    setSaving(true); setError("")
    try {
      await api.patch(`/tc/capacitaciones/${cap.id}/completar`, {
        score: form.score ? parseFloat(form.score) : null,
        diploma_url: form.diploma_url.trim() || null,
      })
      onCompletada()
    } catch {
      setError("No se pudo completar la capacitación.")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Completar capacitación</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{cap.titulo}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <p className="text-xs text-muted-foreground">Persona</p>
            <p className="text-sm font-medium">{cap.persona_nombre}</p>
            <p className="text-xs text-muted-foreground mt-1">{cap.cargo_nombre}</p>
          </div>

          <Field label="Score (0-100)">
            <input
              type="number"
              min="0"
              max="100"
              value={form.score}
              onChange={(e) => setForm((p) => ({ ...p, score: e.target.value }))}
              placeholder="Ej: 95"
              className="input"
            />
          </Field>

          <Field label="URL diploma">
            <input
              type="url"
              value={form.diploma_url}
              onChange={(e) => setForm((p) => ({ ...p, diploma_url: e.target.value }))}
              placeholder="https://..."
              className="input"
            />
          </Field>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-input rounded-lg hover:bg-accent transition-colors">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
            ) : "Marcar como completada"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared field helper ────────────────────────────────────────────────────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
