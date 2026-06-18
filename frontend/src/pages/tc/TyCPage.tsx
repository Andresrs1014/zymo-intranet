import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { PersonaFormModal } from "./components/PersonaFormModal"
import { Search, Plus, RefreshCw } from "lucide-react"

interface Empresa {
  id: number
  nombre: string
  codigo: string
}

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

export function TyCPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [personas, setPersonas] = useState<Persona[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [busqueda, setBusqueda] = useState("")
  const [empresaFiltro, setEmpresaFiltro] = useState<number | null>(null)
  const [estadoFiltro, setEstadoFiltro] = useState<"Activo" | "Inactivo" | "">( "Activo")

  const [modalAbierto, setModalAbierto] = useState(false)

  const cargarEmpresas = useCallback(async () => {
    const { data } = await api.get("/tc/empresas")
    setEmpresas(data)
  }, [])

  const cargarPersonas = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string> = {}
      if (busqueda.trim()) params.q = busqueda.trim()
      if (empresaFiltro !== null) params.empresa_id = String(empresaFiltro)
      if (estadoFiltro) params.estado = estadoFiltro
      const { data } = await api.get("/tc/personas", { params })
      setPersonas(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudieron cargar los colaboradores.")
    } finally {
      setLoading(false)
    }
  }, [busqueda, empresaFiltro, estadoFiltro])

  useEffect(() => {
    cargarEmpresas()
  }, [cargarEmpresas])

  useEffect(() => {
    const timeout = setTimeout(cargarPersonas, 300)
    return () => clearTimeout(timeout)
  }, [cargarPersonas])

  function handleCreada() {
    setModalAbierto(false)
    cargarPersonas()
  }

  const ESTADO_LABELS: Record<string, string> = { Activo: "Activo", Inactivo: "Inactivo" }

  return (
    <PageLayout title="T&C — Talento y Cultura">
      {/* ── Controles ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 border-b border-border">
        {/* Fila 1: búsqueda + botón */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
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

        {/* Fila 2: filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Empresa */}
          <FilterPill
            active={empresaFiltro === null}
            onClick={() => setEmpresaFiltro(null)}
          >
            Todas
          </FilterPill>
          {empresas.map((e) => (
            <FilterPill
              key={e.id}
              active={empresaFiltro === e.id}
              onClick={() => setEmpresaFiltro(e.id)}
            >
              {e.codigo}
            </FilterPill>
          ))}

          <span className="mx-1 text-border">|</span>

          {/* Estado */}
          {(["Activo", "Inactivo", ""] as const).map((s) => (
            <FilterPill
              key={s || "todos"}
              active={estadoFiltro === s}
              onClick={() => setEstadoFiltro(s)}
            >
              {s === "" ? "Todos" : ESTADO_LABELS[s]}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando colaboradores…
          </div>
        ) : personas.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No se encontraron colaboradores con los filtros seleccionados.
          </div>
        ) : (
          <>
            <div className="px-4 py-2 text-xs text-muted-foreground">
              {total} colaborador{total !== 1 ? "es" : ""}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Colaborador</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Empresa</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Área</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Cargo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/tc/persona/${p.id}`)}
                    className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {p.area_nombre || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {p.cargo_nombre || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.estado === "Activo"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
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

      {/* ── Modal nueva persona ───────────────────────────────────────── */}
      {modalAbierto && (
        <PersonaFormModal
          empresas={empresas}
          onCreada={handleCreada}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </PageLayout>
  )
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-input text-muted-foreground hover:text-foreground hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  )
}
