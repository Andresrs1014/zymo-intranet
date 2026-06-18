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

export function TyCDirectorioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [personas, setPersonas] = useState<Persona[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [busqueda, setBusqueda] = useState("")
  const [empresaFiltro, setEmpresaFiltro] = useState("")
  const [areaFiltro, setAreaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("Activo")

  // Abrir modal si viene ?nuevo=1 en la URL
  const [modalAbierto, setModalAbierto] = useState(searchParams.get("nuevo") === "1")

  // Cargar catálogos
  useEffect(() => {
    api.get("/tc/empresas")
      .then((r) => setEmpresas(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  // Recargar áreas cuando cambia empresa
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
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 border-b border-border space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/tc")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            T&C
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Directorio</span>
        </div>

        {/* Búsqueda y acciones */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o documento…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={cargarPersonas}
            className="p-2 rounded-md border border-input hover:bg-accent transition-colors"
            title="Recargar"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          {puedeEditar && (
            <button
              onClick={() => setModalAbierto(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva persona
            </button>
          )}
        </div>

        {/* Filtros combobox */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Empresa */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Empresa</label>
            <select
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
              className="combo"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo} — {e.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Área (solo si hay empresa seleccionada y hay áreas) */}
          {empresaFiltro && areas.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Área</label>
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
            </div>
          )}

          {/* Estado */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Estado</label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="combo"
            >
              <option value="">Todos</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando colaboradores…
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-sm">
            <span>No se encontraron colaboradores con los filtros actuales.</span>
          </div>
        ) : (
          <>
            <div className="px-6 py-2 text-xs text-muted-foreground border-b border-border/50">
              {total} colaborador{total !== 1 ? "es" : ""}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 sticky top-0">
                  <th className="px-6 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Colaborador
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Área
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Cargo
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {personas.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/tc/persona/${p.id}`)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {p.initials || p.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium leading-none">{p.nombre}</p>
                          {p.documento && (
                            <p className="text-xs text-muted-foreground mt-0.5">{p.documento}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {p.empresa_codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {p.area_nombre || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {p.cargo_nombre || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.estado === "Activo"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {p.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── Modal nueva persona ───────────────────────────────────── */}
      {modalAbierto && (
        <PersonaFormModal
          empresas={empresas}
          onCreada={handleCreada}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      <style>{`
        .combo {
          padding: 0.375rem 2rem 0.375rem 0.625rem;
          font-size: 0.8125rem;
          background: transparent;
          border: 1px solid hsl(var(--input));
          border-radius: 0.375rem;
          color: inherit;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          min-width: 160px;
        }
        .combo:focus { outline: none; box-shadow: 0 0 0 1px hsl(var(--ring)); }
      `}</style>
    </PageLayout>
  )
}
