import { useState, useEffect, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, ChevronDown, ChevronRight, Plus, X, Search, Users, Briefcase, LayoutGrid } from "lucide-react"

interface PersonaChip { id: number; nombre: string; initials: string }
interface CargoNode   { id: number; nombre: string; personas: PersonaChip[] }
interface AreaNode    { id: number; nombre: string; cargos: CargoNode[] }
interface GlobalArea  { id: number; name: string }

interface OrgData {
  empresa: { id: number; nombre: string; codigo: string }
  areas: AreaNode[]
  sin_area: CargoNode[]
}

interface Empresa { id: number; nombre: string; codigo: string }

interface PersonaBusqueda {
  id: number; nombre: string; initials: string; cargo_nombre: string; cargo_id: number | null
}

export function TyCOrganigramaPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const [empresas, setEmpresas]           = useState<Empresa[]>([])
  const [empresaActiva, setEmpresaActiva] = useState<number | null>(null)
  const [orgData, setOrgData]             = useState<OrgData | null>(null)
  const [loading, setLoading]             = useState(false)
  const [areasGlobales, setAreasGlobales] = useState<GlobalArea[]>([])
  const [areasAbiertas, setAreasAbiertas] = useState<Set<string>>(new Set())

  // Modal asignación de persona
  const [modalCargo, setModalCargo]   = useState<CargoNode | null>(null)
  const [busqueda, setBusqueda]       = useState("")
  const [resultados, setResultados]   = useState<PersonaBusqueda[]>([])
  const [asignando, setAsignando]     = useState<number | null>(null)

  // Modal nuevo cargo
  const [modalNuevoCargo, setModalNuevoCargo] = useState<{ area_id: number | null } | null>(null)
  const [nombreCargo, setNombreCargo]         = useState("")
  const [areaCargo, setAreaCargo]             = useState<number | null>(null)
  const [creando, setCreando]                 = useState(false)
  const [errorCargo, setErrorCargo]           = useState("")

  useEffect(() => {
    api.get("/tc/empresas").then((r) => {
      const lista: Empresa[] = Array.isArray(r.data) ? r.data : []
      setEmpresas(lista)
      if (lista.length > 0) setEmpresaActiva(lista[0].id)
    }).catch(() => {})
    api.get("/areas").then((r) => setAreasGlobales(Array.isArray(r.data) ? r.data : [])).catch(() => {})
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
    const params: Record<string, string | number> = { empresa_id: empresaActiva, estado: "Activo", limit: 20 }
    if (busqueda.trim()) params.q = busqueda.trim()
    const t = setTimeout(() => {
      api.get("/tc/personas", { params })
        .then((r) => setResultados(Array.isArray(r.data.items) ? r.data.items : []))
        .catch(() => setResultados([]))
    }, busqueda.trim() ? 300 : 0)
    return () => clearTimeout(t)
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

  async function crearCargo() {
    if (!nombreCargo.trim()) return
    setCreando(true)
    setErrorCargo("")
    try {
      await api.post("/tc/cargos", { nombre: nombreCargo.trim(), area_id: areaCargo })
      await recargarOrg()
      // abrir área recién creada
      if (areaCargo !== null) {
        setAreasAbiertas((prev) => new Set([...prev, String(areaCargo)]))
      } else {
        setAreasAbiertas((prev) => new Set([...prev, "sin_area"]))
      }
      setModalNuevoCargo(null)
      setNombreCargo("")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrorCargo(msg ?? "Error al crear el cargo.")
    } finally {
      setCreando(false)
    }
  }

  function abrirModalCargo(preArea: number | null) {
    setModalNuevoCargo({ area_id: preArea })
    setAreaCargo(preArea)
    setNombreCargo("")
    setErrorCargo("")
  }

  function toggleArea(key: string) {
    setAreasAbiertas((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function abrirAsignacion(cargo: CargoNode) {
    setModalCargo(cargo)
    setBusqueda("")
    setResultados([])
  }

  const totalCargos = (orgData?.areas.flatMap((a) => a.cargos).length ?? 0) + (orgData?.sin_area.length ?? 0)
  const totalPersonas = orgData
    ? orgData.areas.flatMap((a) => a.cargos.flatMap((c) => c.personas)).length +
      orgData.sin_area.flatMap((c) => c.personas).length
    : 0

  return (
    <PageLayout title="T&C — Organigrama" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate("/tc")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            T&C
          </button>
          <span className="text-muted-foreground/30 text-xs">/</span>
          <span className="text-sm font-medium">Organigrama</span>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
            {empresas.map((e) => (
              <button
                key={e.id}
                onClick={() => setEmpresaActiva(e.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  empresaActiva === e.id
                    ? "bg-teal-500/15 text-teal-400 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {e.codigo}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {orgData && !loading && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  <strong className="text-foreground font-semibold">{totalCargos}</strong> cargo{totalCargos !== 1 ? "s" : ""}
                </span>
                <span className="tabular-nums">
                  <strong className="text-emerald-500 font-semibold">{totalPersonas}</strong> activo{totalPersonas !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <button
              onClick={() => navigate("/tc/organigrama/canvas")}
              className="flex items-center gap-1.5 h-7 px-2.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <LayoutGrid className="w-3 h-3" />
              Vista canvas
            </button>
            {puedeEditar && (
              <button
                onClick={() => abrirModalCargo(null)}
                className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border border-dashed border-teal-500/40 rounded-lg text-teal-500/70 hover:border-teal-500/70 hover:text-teal-400 hover:bg-teal-500/5 transition-all"
              >
                <Plus className="w-3 h-3" />
                Nuevo cargo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Árbol */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando organigrama…
          </div>
        )}

        {!loading && orgData && orgData.areas.length === 0 && orgData.sin_area.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-20" />
            <span className="text-sm">Sin cargos definidos aún.</span>
            {puedeEditar && (
              <button
                onClick={() => abrirModalCargo(null)}
                className="mt-1 text-xs text-teal-500 hover:underline"
              >
                + Crear primer cargo
              </button>
            )}
          </div>
        )}

        {!loading && orgData && (
          <>
            {orgData.areas.map((area) => (
              <AreaCard
                key={area.id}
                nombre={area.nombre}
                cargos={area.cargos}
                abierta={areasAbiertas.has(String(area.id))}
                onToggle={() => toggleArea(String(area.id))}
                puedeEditar={puedeEditar}
                onAsignar={abrirAsignacion}
                onDesasignar={desasignar}
                onNuevoCargo={() => abrirModalCargo(area.id)}
              />
            ))}
            {orgData.sin_area.length > 0 && (
              <AreaCard
                nombre="Sin área asignada"
                cargos={orgData.sin_area}
                abierta={areasAbiertas.has("sin_area")}
                onToggle={() => toggleArea("sin_area")}
                puedeEditar={puedeEditar}
                onAsignar={abrirAsignacion}
                onDesasignar={desasignar}
                onNuevoCargo={() => abrirModalCargo(null)}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modal asignación de persona ───────────────────────────────────────── */}
      {modalCargo && (
        <Modal onClose={() => setModalCargo(null)}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-sm">Asignar colaborador</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> {modalCargo.nombre}
              </p>
            </div>
            <CloseBtn onClick={() => setModalCargo(null)} />
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
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/50 divide-y divide-border/40 bg-muted/10">
              {resultados.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {busqueda.trim() ? "Sin resultados" : "Cargando…"}
                </p>
              ) : (
                resultados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => asignar(p)}
                    disabled={asignando === p.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold">
                      {p.initials || p.nombre.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.nombre}</p>
                      {p.cargo_nombre && (
                        <p className="text-xs text-muted-foreground truncate">{p.cargo_nombre}</p>
                      )}
                    </div>
                    <span className="text-xs text-teal-500 shrink-0 font-semibold">
                      {asignando === p.id ? "…" : "Asignar"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal nuevo cargo ─────────────────────────────────────────────────── */}
      {modalNuevoCargo !== null && (
        <Modal onClose={() => setModalNuevoCargo(null)}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-sm">Nuevo cargo</p>
              <p className="text-xs text-muted-foreground mt-0.5">El cargo es global — aparece en todas las empresas</p>
            </div>
            <CloseBtn onClick={() => setModalNuevoCargo(null)} />
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Nombre del cargo
              </label>
              <input
                type="text"
                placeholder="ej. Auxiliar de IT, Analista de Operaciones…"
                value={nombreCargo}
                onChange={(e) => { setNombreCargo(e.target.value); setErrorCargo("") }}
                onKeyDown={(e) => e.key === "Enter" && crearCargo()}
                autoFocus
                className="w-full px-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Área
              </label>
              <select
                value={areaCargo ?? ""}
                onChange={(e) => setAreaCargo(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500/50 appearance-none"
              >
                <option value="">Sin área</option>
                {areasGlobales.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {errorCargo && (
              <p className="text-xs text-destructive px-1">{errorCargo}</p>
            )}
            <button
              onClick={crearCargo}
              disabled={!nombreCargo.trim() || creando}
              className="w-full h-9 text-sm font-medium bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors"
            >
              {creando ? "Creando…" : "Crear cargo"}
            </button>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}

// ── AreaCard ──────────────────────────────────────────────────────────────────

function AreaCard({
  nombre, cargos, abierta, onToggle, puedeEditar, onAsignar, onDesasignar, onNuevoCargo,
}: {
  nombre: string
  cargos: CargoNode[]
  abierta: boolean
  onToggle: () => void
  puedeEditar: boolean
  onAsignar: (c: CargoNode) => void
  onDesasignar: (id: number) => void
  onNuevoCargo: () => void
}) {
  const totalPersonas = cargos.reduce((s, c) => s + c.personas.length, 0)
  const filled = cargos.filter((c) => c.personas.length > 0).length

  return (
    <div className="rounded-xl overflow-hidden border border-border/70">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/15 hover:bg-muted/30 transition-colors text-left border-l-[3px] border-teal-500/60"
      >
        <span className="text-muted-foreground/60">
          {abierta ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <span className="font-semibold text-sm flex-1 tracking-tight">{nombre}</span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span>
            {filled}/{cargos.length} cargo{cargos.length !== 1 ? "s" : ""} cubierto{filled !== 1 ? "s" : ""}
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-emerald-500 font-medium">
            {totalPersonas} activo{totalPersonas !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {abierta && (
        <div className="relative">
          <div className="absolute left-[27px] top-3 bottom-3 w-px bg-teal-500/15" />
          <div className="divide-y divide-border/30">
            {cargos.length === 0 ? (
              <p className="px-10 py-4 text-xs text-muted-foreground italic">Sin cargos definidos.</p>
            ) : (
              cargos.map((cargo, idx) => (
                <CargoRow
                  key={cargo.id}
                  cargo={cargo}
                  isLast={idx === cargos.length - 1}
                  puedeEditar={puedeEditar}
                  onAsignar={onAsignar}
                  onDesasignar={onDesasignar}
                />
              ))
            )}
            {puedeEditar && (
              <div className="px-10 py-2">
                <button
                  onClick={onNuevoCargo}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-teal-500 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Nuevo cargo aquí
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CargoRow ──────────────────────────────────────────────────────────────────

function CargoRow({
  cargo, puedeEditar, onAsignar, onDesasignar,
}: {
  cargo: CargoNode
  isLast: boolean
  puedeEditar: boolean
  onAsignar: (c: CargoNode) => void
  onDesasignar: (id: number) => void
}) {
  const vacio = cargo.personas.length === 0
  return (
    <div className={`flex items-start gap-3 px-4 py-3 pl-10 group/row hover:bg-muted/10 transition-colors ${vacio ? "opacity-50 hover:opacity-80" : ""}`}>
      <div className="flex items-center pt-2 shrink-0">
        <div className="w-3 h-px bg-teal-500/20" />
      </div>
      <div className="w-44 shrink-0 pt-0.5">
        <p className="text-xs font-semibold text-foreground/80 leading-snug">{cargo.nombre}</p>
        <p className={`text-[10px] mt-0.5 tabular-nums ${vacio ? "text-muted-foreground/40 italic" : "text-muted-foreground/60"}`}>
          {vacio ? "Sin asignar" : `${cargo.personas.length} asignado${cargo.personas.length !== 1 ? "s" : ""}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1 min-h-[28px] pt-0.5">
        {cargo.personas.map((p) => (
          <Chip key={p.id} persona={p} puedeEditar={puedeEditar} onDesasignar={onDesasignar} />
        ))}
        {puedeEditar && (
          <button
            onClick={() => onAsignar(cargo)}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] border border-dashed border-border/60 rounded-full text-muted-foreground/50 hover:border-teal-500/50 hover:text-teal-500 transition-all"
          >
            <Plus className="w-2.5 h-2.5" />
            Asignar
          </button>
        )}
      </div>
    </div>
  )
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({
  persona, puedeEditar, onDesasignar,
}: {
  persona: PersonaChip; puedeEditar: boolean; onDesasignar: (id: number) => void
}) {
  const display = persona.nombre.split(" ").slice(0, 2).join(" ")
  return (
    <div className="group flex items-center gap-1.5 px-2 py-0.5 bg-muted/40 hover:bg-muted/70 border border-border/40 rounded-full text-[11px] transition-colors">
      <div className="w-3.5 h-3.5 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-[8px] font-bold shrink-0">
        {(persona.initials || persona.nombre)[0]}
      </div>
      <span className="max-w-[110px] truncate text-foreground/80">{display}</span>
      {puedeEditar && (
        <button
          onClick={(e) => { e.stopPropagation(); onDesasignar(persona.id) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-red-400"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  )
}

// ── Utilitarios ───────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  )
}
