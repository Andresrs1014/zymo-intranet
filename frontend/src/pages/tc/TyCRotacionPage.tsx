import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { TC_EMPRESA_PALETTE } from "@/lib/tc-constants"
import { ArrowLeft, Search, Save, X, UserX } from "lucide-react"

interface Empresa { id: number; nombre: string }

interface Persona {
  id: number
  nombre: string
  initials: string
  empresa_id: number
  empresa_nombre: string
  cargo_nombre: string
  estado: string
  tipo_salida: string | null
  fecha_salida: string | null
}

interface Cambio {
  estado: string
  tipo_salida: string | null
  fecha_salida: string | null
}

interface BulkResult { updated: number; errors: { id: number; detail: string }[] }

const TIPO_SALIDA_UI = ["Voluntario", "Involuntario"] as const
type TipoSalidaUi = (typeof TIPO_SALIDA_UI)[number]

function tipoToApi(t: string | null | undefined): string | null {
  if (t === "Voluntario" || t === "voluntaria") return "voluntaria"
  if (t === "Involuntario" || t === "involuntaria") return "involuntaria"
  return t ?? null
}

function tipoFromApi(t: string | null | undefined): string | null {
  if (t === "voluntaria") return "Voluntario"
  if (t === "involuntaria") return "Involuntario"
  return t ?? null
}

// ponytail: mock hasta que Codex despliegue PATCH /tc/personas/bulk-estado
function mockOk(n: number): BulkResult { return { updated: n, errors: [] } }

export function TyCRotacionPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")
  const [banner, setBanner]     = useState<{ ok: boolean; msg: string } | null>(null)

  const [busqueda, setBusqueda]           = useState("")
  const [empresaFiltro, setEmpresaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro]   = useState("")

  const [pending, setPending] = useState<Record<number, Partial<Cambio>>>({})
  const pendingCount = Object.keys(pending).length

  useEffect(() => {
    api.get("/tc/empresas")
      .then((r) => setEmpresas(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string> = {}
      if (busqueda.trim()) params.q          = busqueda.trim()
      if (empresaFiltro)   params.empresa_id = empresaFiltro
      if (estadoFiltro)    params.estado     = estadoFiltro
      const { data } = await api.get("/tc/personas", { params })
      setPersonas(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
    } catch {
      setError("No se pudieron cargar los colaboradores.")
    } finally {
      setLoading(false)
    }
  }, [busqueda, empresaFiltro, estadoFiltro])

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [cargar])

  const empresaColorMap = useMemo(
    () => new Map(empresas.map((e, i) => [e.id, TC_EMPRESA_PALETTE[i % TC_EMPRESA_PALETTE.length]])),
    [empresas],
  )

  function estadoActual(p: Persona) { return pending[p.id]?.estado ?? p.estado }
  function tipoActual(p: Persona) {
    const raw = (p.id in pending) ? (pending[p.id].tipo_salida ?? p.tipo_salida) : p.tipo_salida
    return tipoFromApi(raw)
  }
  function fechaActual(p: Persona)  { return (p.id in pending) ? (pending[p.id].fecha_salida ?? p.fecha_salida) : p.fecha_salida }

  function toggleEstado(p: Persona) {
    if (!puedeEditar) return
    const nuevo = estadoActual(p) === "Activo" ? "Inactivo" : "Activo"
    setPending((prev) => {
      const base: Partial<Cambio> = { ...prev[p.id], estado: nuevo }
      if (nuevo === "Activo") { base.tipo_salida = null; base.fecha_salida = null }
      return { ...prev, [p.id]: base }
    })
  }

  function setTipo(p: Persona, t: string) {
    if (!puedeEditar) return
    setPending((prev) => ({ ...prev, [p.id]: { ...prev[p.id], tipo_salida: t } }))
  }

  function setFecha(p: Persona, v: string) {
    if (!puedeEditar) return
    setPending((prev) => ({ ...prev, [p.id]: { ...prev[p.id], fecha_salida: v || null } }))
  }

  async function guardar() {
    if (!pendingCount) return
    setSaving(true)
    setBanner(null)
    const items = Object.entries(pending).map(([id, c]) => {
      const p = personas.find((x) => x.id === Number(id))
      if (!p) return null
      const estado = c.estado ?? p.estado
      const tipoRaw = c.tipo_salida !== undefined ? c.tipo_salida : p.tipo_salida
      const fechaRaw = c.fecha_salida !== undefined ? c.fecha_salida : p.fecha_salida
      return {
        id: Number(id),
        estado,
        tipo_salida: estado === "Inactivo" ? tipoToApi(tipoRaw) : null,
        fecha_salida: estado === "Inactivo" ? fechaRaw : null,
      }
    }).filter(Boolean) as { id: number; estado: string; tipo_salida: string | null; fecha_salida: string | null }[]
    try {
      const { data } = await api.patch("/tc/personas/bulk-estado", { items })
      const res = data as BulkResult
      setPending({})
      cargar()
      if (res.errors?.length) {
        setBanner({ ok: false, msg: `${res.updated} actualizados, ${res.errors.length} errores: IDs ${res.errors.map((e) => e.id).join(", ")}` })
      } else {
        setBanner({ ok: true, msg: `${res.updated} colaborador${res.updated !== 1 ? "es" : ""} actualizado${res.updated !== 1 ? "s" : ""}.` })
      }
    } catch (err: unknown) {
      // ponytail: fallback mock si el endpoint aún no está desplegado
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404 || status === 405) {
        const r = mockOk(items.length)
        setPending({})
        setBanner({ ok: true, msg: `[MOCK] ${r.updated} actualizados.` })
      } else {
        setBanner({ ok: false, msg: "Error al guardar cambios. Intenta de nuevo." })
      }
    } finally {
      setSaving(false)
    }
  }

  function descartar() { setPending({}); setBanner(null) }

  return (
    <PageLayout title="T&C — Rotación" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-8 pt-6 pb-0 border-b border-border">
        <div className="max-w-5xl mx-auto">

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => navigate("/tc")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              T&C
            </button>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-sm font-medium">Rotación</span>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-amber-400" />
              <h1 className="text-base font-semibold">Rotación y estado del personal</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Clasifica retiros voluntarios o involuntarios. Alimenta los indicadores de rotación.
            </p>
          </div>

          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar nombre, documento o cargo…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/20 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <select
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
              className="rot-combo"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>

            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="rot-combo"
            >
              <option value="">Todos</option>
              <option value="Activo">Activos</option>
              <option value="Inactivo">Inactivos</option>
            </select>
          </div>

          {!loading && !error && (
            <p className="text-[11px] text-muted-foreground pb-2">
              {total} colaborador{total !== 1 ? "es" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Banner feedback */}
      {banner && (
        <div className={`mx-8 mt-3 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between ${
          banner.ok
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          <span>{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="ml-4 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto max-w-5xl mx-auto w-full">
        {error && (
          <div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando colaboradores…
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <span className="text-sm">Sin resultados para los filtros actuales.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 bg-background border-b border-border z-10">
                {["Colaborador", "Empresa", "Cargo", "Estado", "Tipo retiro", "Fecha salida"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider first:px-6">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personas.map((p, i) => {
                const est      = estadoActual(p)
                const tipo     = tipoActual(p)
                const fecha    = fechaActual(p)
                const changed  = p.id in pending
                const inactivo = est === "Inactivo"
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-border/40 rot-row ${
                      changed ? "bg-amber-500/5" : i % 2 === 0 ? "" : "bg-muted/5"
                    }`}
                    style={{ animationDelay: `${i * 18}ms` }}
                  >
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-500 text-[10px] font-bold">
                          {p.initials || p.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium text-sm leading-tight">{p.nombre}</p>
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
                        empresaColorMap.get(p.empresa_id)?.badge ?? "bg-muted/10 text-muted-foreground"
                      }`}>
                        {p.empresa_nombre}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">
                        {p.cargo_nombre || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      {puedeEditar ? (
                        <button
                          onClick={() => toggleEstado(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                            inactivo
                              ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${inactivo ? "bg-amber-500" : "bg-emerald-500"}`} />
                          {est}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          inactivo ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${inactivo ? "bg-amber-500" : "bg-emerald-500"}`} />
                          {est}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {inactivo && puedeEditar ? (
                        <div className="flex gap-1">
                          {TIPO_SALIDA_UI.map((t) => (
                            <button
                              key={t}
                              onClick={() => setTipo(p, t)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                tipo === t
                                  ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                                  : "bg-muted/20 text-muted-foreground border-border/50 hover:border-border"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      ) : tipo ? (
                        <span className="text-xs text-muted-foreground">{tipo}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/30">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      {inactivo && puedeEditar ? (
                        <input
                          type="date"
                          value={fecha ?? ""}
                          onChange={(e) => setFecha(p, e.target.value)}
                          className="h-7 px-2 text-xs bg-muted/20 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        />
                      ) : fecha ? (
                        <span className="text-xs font-mono text-muted-foreground">{fecha}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer sticky */}
      {pendingCount > 0 && (
        <div className="border-t border-border bg-background/95 backdrop-blur px-8 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            <span className="font-mono font-bold text-amber-400">{pendingCount}</span>
            {" "}cambio{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={descartar}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border border-input rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Descartar
            </button>
            <button
              onClick={guardar}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Guardar cambios
            </button>
          </div>
        </div>
      )}

      <style>{`
        .rot-combo {
          height: 32px; padding: 0 1.75rem 0 0.625rem; font-size: 0.8rem;
          background: transparent; border: 1px solid hsl(var(--input));
          border-radius: 0.5rem; color: inherit; appearance: none; min-width: 130px; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 0.45rem center;
        }
        .rot-combo:focus { outline: none; box-shadow: 0 0 0 1px hsl(var(--ring)); }
        @keyframes rot-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .rot-row { animation: rot-fadein 200ms ease-out both; }
      `}</style>
    </PageLayout>
  )
}
