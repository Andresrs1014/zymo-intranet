import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, ChevronDown, ChevronRight, Plus, X, Search, Users } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonaChip {
  id: number
  nombre: string
  initials: string
}

interface CargoNode {
  id: number
  nombre: string
  personas: PersonaChip[]
}

interface AreaNode {
  id: number
  nombre: string
  cargos: CargoNode[]
}

interface OrgData {
  empresa: { id: number; nombre: string; codigo: string }
  areas: AreaNode[]
  sin_area: CargoNode[]
}

interface Empresa {
  id: number
  nombre: string
  codigo: string
}

interface PersonaBusqueda {
  id: number
  nombre: string
  initials: string
  cargo_nombre: string
  cargo_id: number | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TyCOrganigramaPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaActiva, setEmpresaActiva] = useState<number | null>(null)
  const [orgData, setOrgData] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(false)
  const [areasAbiertas, setAreasAbiertas] = useState<Set<string>>(new Set())

  const [modalCargo, setModalCargo] = useState<CargoNode | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState<PersonaBusqueda[]>([])
  const [asignando, setAsignando] = useState<number | null>(null)

  useEffect(() => {
    api.get("/tc/empresas").then((r) => {
      const lista: Empresa[] = Array.isArray(r.data) ? r.data : []
      setEmpresas(lista)
      if (lista.length > 0) setEmpresaActiva(lista[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!empresaActiva) return
    setLoading(true)
    api.get(`/tc/organigrama/${empresaActiva}`)
      .then((r) => {
        setOrgData(r.data)
        const keys = new Set<string>((r.data.areas as AreaNode[]).map((a) => String(a.id)))
        if ((r.data.sin_area as CargoNode[]).length > 0) keys.add("sin_area")
        setAreasAbiertas(keys)
      })
      .catch(() => setOrgData(null))
      .finally(() => setLoading(false))
  }, [empresaActiva])

  useEffect(() => {
    if (!modalCargo || !empresaActiva) { setResultados([]); return }
    const params: Record<string, string | number> = {
      empresa_id: empresaActiva,
      estado: "Activo",
      limit: 20,
    }
    if (busqueda.trim()) params.q = busqueda.trim()
    const delay = busqueda.trim() ? 300 : 0
    const timer = setTimeout(() => {
      api.get("/tc/personas", { params })
        .then((r) => setResultados(Array.isArray(r.data.items) ? r.data.items : []))
        .catch(() => setResultados([]))
    }, delay)
    return () => clearTimeout(timer)
  }, [busqueda, modalCargo, empresaActiva])

  async function recargarOrg() {
    if (!empresaActiva) return
    const { data } = await api.get(`/tc/organigrama/${empresaActiva}`)
    setOrgData(data)
  }

  async function asignar(persona: PersonaBusqueda) {
    if (!modalCargo) return
    setAsignando(persona.id)
    try {
      await api.put(`/tc/personas/${persona.id}`, { cargo_id: modalCargo.id })
      await recargarOrg()
      setModalCargo(null)
    } catch { /* ignore */ }
    finally { setAsignando(null) }
  }

  async function desasignar(personaId: number) {
    try {
      await api.put(`/tc/personas/${personaId}`, { cargo_id: null })
      await recargarOrg()
    } catch { /* ignore */ }
  }

  function toggleArea(key: string) {
    setAreasAbiertas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function abrirModal(cargo: CargoNode) {
    setModalCargo(cargo)
    setBusqueda("")
    setResultados([])
  }

  const totalAreas = orgData?.areas.length ?? 0
  const totalCargos =
    (orgData?.areas.flatMap((a) => a.cargos).length ?? 0) + (orgData?.sin_area.length ?? 0)
  const totalPersonas = orgData
    ? orgData.areas.flatMap((a) => a.cargos.flatMap((c) => c.personas)).length +
      orgData.sin_area.flatMap((c) => c.personas).length
    : 0

  return (
    <PageLayout title="T&C — Organigrama" mainClassName="flex-1 flex flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────── */}
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
          <span className="text-sm font-medium">Organigrama</span>
        </div>

        {/* Empresa tabs */}
        <div className="flex gap-1.5">
          {empresas.map((e) => (
            <button
              key={e.id}
              onClick={() => setEmpresaActiva(e.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all border ${
                empresaActiva === e.id
                  ? "bg-teal-500/10 text-teal-500 border-teal-500/30"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground border-transparent"
              }`}
            >
              {e.codigo}
            </button>
          ))}
        </div>

        {/* Stats */}
        {orgData && !loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{totalAreas} área{totalAreas !== 1 ? "s" : ""}</span>
            <span className="opacity-30">·</span>
            <span>{totalCargos} cargo{totalCargos !== 1 ? "s" : ""}</span>
            <span className="opacity-30">·</span>
            <span>{totalPersonas} persona{totalPersonas !== 1 ? "s" : ""} activa{totalPersonas !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ── Árbol ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-2.5">
        {loading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando organigrama…
          </div>
        )}

        {!loading && orgData && orgData.areas.length === 0 && orgData.sin_area.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-20" />
            <span className="text-sm">No hay áreas ni cargos para esta empresa.</span>
          </div>
        )}

        {!loading && orgData && (
          <>
            {orgData.areas.map((area) => (
              <AreaCard
                key={area.id}
                areaKey={String(area.id)}
                nombre={area.nombre}
                cargos={area.cargos}
                abierta={areasAbiertas.has(String(area.id))}
                onToggle={() => toggleArea(String(area.id))}
                puedeEditar={puedeEditar}
                onAsignar={abrirModal}
                onDesasignar={desasignar}
              />
            ))}
            {orgData.sin_area.length > 0 && (
              <AreaCard
                areaKey="sin_area"
                nombre="Sin área asignada"
                cargos={orgData.sin_area}
                abierta={areasAbiertas.has("sin_area")}
                onToggle={() => toggleArea("sin_area")}
                puedeEditar={puedeEditar}
                onAsignar={abrirModal}
                onDesasignar={desasignar}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modal asignación ─────────────────────────────────────────── */}
      {modalCargo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-semibold text-sm">Asignar colaborador</p>
                <p className="text-xs text-muted-foreground mt-0.5">{modalCargo.nombre}</p>
              </div>
              <button
                onClick={() => setModalCargo(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nombre…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
                {resultados.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {busqueda.trim() ? "Sin resultados para esa búsqueda" : "Cargando colaboradores…"}
                  </p>
                ) : (
                  resultados.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => asignar(p)}
                      disabled={asignando === p.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-500 text-xs font-semibold">
                        {p.initials || p.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nombre}</p>
                        {p.cargo_nombre && (
                          <p className="text-xs text-muted-foreground truncate">
                            Cargo actual: {p.cargo_nombre}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-teal-500 shrink-0 font-medium">
                        {asignando === p.id ? "…" : "Asignar"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AreaCard({
  areaKey,
  nombre,
  cargos,
  abierta,
  onToggle,
  puedeEditar,
  onAsignar,
  onDesasignar,
}: {
  areaKey: string
  nombre: string
  cargos: CargoNode[]
  abierta: boolean
  onToggle: () => void
  puedeEditar: boolean
  onAsignar: (c: CargoNode) => void
  onDesasignar: (id: number) => void
}) {
  const totalPersonas = cargos.reduce((s, c) => s + c.personas.length, 0)

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-area={areaKey}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        {abierta
          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        }
        <span className="font-medium text-sm flex-1">{nombre}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {cargos.length} cargo{cargos.length !== 1 ? "s" : ""}
          {" · "}
          {totalPersonas} persona{totalPersonas !== 1 ? "s" : ""}
        </span>
      </button>
      {abierta && (
        <div className="divide-y divide-border/40">
          {cargos.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground italic">
              Sin cargos definidos.
            </p>
          ) : (
            cargos.map((cargo) => (
              <CargoRow
                key={cargo.id}
                cargo={cargo}
                puedeEditar={puedeEditar}
                onAsignar={onAsignar}
                onDesasignar={onDesasignar}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function CargoRow({
  cargo,
  puedeEditar,
  onAsignar,
  onDesasignar,
}: {
  cargo: CargoNode
  puedeEditar: boolean
  onAsignar: (c: CargoNode) => void
  onDesasignar: (id: number) => void
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 pl-11">
      <div className="w-44 shrink-0 pt-0.5">
        <p className="text-sm font-medium leading-snug">{cargo.nombre}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {cargo.personas.length} asignado{cargo.personas.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 flex-1 pt-0.5 min-h-[28px]">
        {cargo.personas.map((p) => (
          <Chip
            key={p.id}
            persona={p}
            puedeEditar={puedeEditar}
            onDesasignar={onDesasignar}
          />
        ))}
        {puedeEditar && (
          <button
            onClick={() => onAsignar(cargo)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-dashed border-border rounded-full text-muted-foreground hover:border-teal-500 hover:text-teal-500 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Asignar
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({
  persona,
  puedeEditar,
  onDesasignar,
}: {
  persona: PersonaChip
  puedeEditar: boolean
  onDesasignar: (id: number) => void
}) {
  const display = persona.nombre.split(" ").slice(0, 2).join(" ")
  return (
    <div className="group flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 hover:bg-muted/80 rounded-full text-xs transition-colors">
      <div className="w-4 h-4 rounded-full bg-teal-500/15 text-teal-500 flex items-center justify-center text-[9px] font-bold shrink-0">
        {(persona.initials || persona.nombre)[0]}
      </div>
      <span className="max-w-[130px] truncate">{display}</span>
      {puedeEditar && (
        <button
          onClick={(e) => { e.stopPropagation(); onDesasignar(persona.id) }}
          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
