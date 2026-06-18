import { useEffect, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { PersonaFormModal } from "./components/PersonaFormModal"
import { Search, Plus, RefreshCw, ArrowLeft } from "lucide-react"

interface Empresa { id: number; nombre: string; codigo: string }
interface Area    { id: number; empresa_id: number; nombre: string }

interface Persona {
  id: number
  nombre: string
  initials: string
  documento: string
  empresa_id: number
  empresa_nombre: string
  empresa_codigo: string
  area_id: number | null
  area_nombre: string
  cargo_id: number | null
  cargo_nombre: string
  email: string
  telefono: string
  estado: string
  tipo_contrato: string
  fecha_ingreso: string | null
}

// Colores de empresa para badges
const EMPRESA_COLORS: Record<string, string> = {
  ZYMOLOGI: "bg-blue-500/10 text-blue-400",
  ZYMOIMCC: "bg-violet-500/10 text-violet-400",
  ZYMOIMDE: "bg-amber-500/10 text-amber-500",
}

export function TyCDirectorioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [personas, setPersonas]   = useState<Persona[]>([])
  const [empresas, setEmpresas]   = useState<Empresa[]>([])
  const [areas, setAreas]         = useState<Area[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState("")

  const [busqueda, setBusqueda]       = useState("")
  const [empresaFiltro, setEmpresaFiltro] = useState("")
  const [areaFiltro, setAreaFiltro]   = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("Activo")

  const [modalAbierto, setModalAbierto] = useState(searchParams.get("nuevo") === "1")

  useEffect(() => {
    api.get("/tc/empresas")
      .then((r) => setEmpresas(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setAreaFiltro("")
    if (!empresaFiltro) { setAreas([]); return }
    api.get("/tc/areas", { params: { empresa_id: empresaFiltro } })
      .then((r) => setAreas(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAreas([]))
  }, [empresaFiltro])

  const cargarPersonas = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string> = {}
      if (busqueda.trim())  params.q          = busqueda.trim()
      if (empresaFiltro)    params.empresa_id  = empresaFiltro
      if (areaFiltro)       params.area_id     = areaFiltro
      if (estadoFiltro)     params.estado      = estadoFiltro
      const { data } = await api.get("/tc/personas", { params })
      setPersonas(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
    } catch {
      setError("No se pudieron cargar los colaboradores.")
    } finally {
      setLoading(false)
    }
  }, [busqueda, empresaFiltro, areaFiltro, estadoFiltro])

  useEffect(() => {
    const t = setTimeout(cargarPersonas, 300)
    return () => clearTimeout(t)
  }, [cargarPersonas])

  function handleCreada() {
    setModalAbierto(false)
    cargarPersonas()
  }

  return (
    <PageLayout title="T&C — Directorio" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-0 border-b border-border">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate("/tc")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            T&C
          </button>
          <span className="text-muted-foreground/30 text-xs">/</span>
          <span className="text-sm font-medium">Directorio</span>
        </div>

        {/* Toolbar unificada — todo en una fila */}
        <div className="flex items-center gap-2 pb-3 flex-wrap">

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar nombre o documento…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/20 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Filtros inline */}
          <select
            value={empresaFiltro}
            onChange={(e) => setEmpresaFiltro(e.target.value)}
            className="combo"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.codigo}</option>
            ))}
          </select>

          {empresaFiltro && areas.length > 0 && (
            <select
              value={areaFiltro}
              onChange={(e) => setAreaFiltro(e.target.value)}
              className="combo"
            >
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
          )}

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="combo"
          >
            <option value="">Todos</option>
            <option value="Activo">Activos</option>
            <option value="Inactivo">Inactivos</option>
          </select>

          {/* Separador visual */}
          <div className="hidden sm:block w-px h-5 bg-border/60" />

          {/* Acciones */}
          <button
            onClick={cargarPersonas}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-input hover:bg-accent transition-colors"
            title="Recargar"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {puedeEditar && (
            <button
              onClick={() => setModalAbierto(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          )}
        </div>

        {/* Contador — pegado al borde inferior del header */}
        {!loading && !error && (
          <div className="text-[11px] text-muted-foreground pb-2">
            {total} colaborador{total !== 1 ? "es" : ""}
            {estadoFiltro && <span className="ml-1 opacity-60">· {estadoFiltro.toLowerCase()}s</span>}
          </div>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando colaboradores…
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-muted-foreground">
            <span className="text-sm">Sin resultados para los filtros actuales.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 bg-background border-b border-border z-10">
                <th className="px-6 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Colaborador
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Área / Cargo
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/tc/persona/${p.id}`)}
                  className={`cursor-pointer hover:bg-muted/20 transition-colors border-b border-border/40 ${
                    i % 2 === 0 ? "" : "bg-muted/5"
                  }`}
                >
                  {/* Colaborador */}
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {p.initials || p.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm leading-tight">{p.nombre}</p>
                        {p.documento && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.documento}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Empresa */}
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
                      EMPRESA_COLORS[p.empresa_codigo] ?? "bg-muted text-muted-foreground"
                    }`}>
                      {p.empresa_codigo}
                    </span>
                  </td>

                  {/* Área / Cargo — apilados */}
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <div>
                      {p.area_nombre
                        ? <p className="text-xs text-muted-foreground leading-tight">{p.area_nombre}</p>
                        : <p className="text-xs text-muted-foreground/30 leading-tight italic">Sin área</p>
                      }
                      {p.cargo_nombre
                        ? <p className="text-xs font-medium leading-tight mt-0.5">{p.cargo_nombre}</p>
                        : <p className="text-xs text-muted-foreground/30 leading-tight italic">Sin cargo</p>
                      }
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.estado === "Activo"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${p.estado === "Activo" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal nueva persona ─────────────────────────────────────── */}
      {modalAbierto && (
        <PersonaFormModal
          empresas={empresas}
          onCreada={handleCreada}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      <style>{`
        .combo {
          height: 32px;
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
          min-width: 130px;
          cursor: pointer;
        }
        .combo:focus { outline: none; box-shadow: 0 0 0 1px hsl(var(--ring)); }
      `}</style>
    </PageLayout>
  )
}
