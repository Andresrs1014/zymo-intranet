import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { useSedes, type SedeItem } from "@/hooks/useSedes"
import { PageLayout } from "@/components/layout/PageLayout"
import { ArrowLeft, LayoutGrid, Plus, X, ChevronRight, ChevronDown, Users } from "lucide-react"

interface PersonaMini {
  id: number
  nombre: string
  initials: string
  foto_url: string
}

interface ArbolNodo {
  id: number
  nombre: string
  area_id: number | null
  parent_id: number | null
  personas: PersonaMini[]
  hijos: ArbolNodo[]
}

interface ArbolData { raices: ArbolNodo[] }

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ p, size = 24 }: { p: PersonaMini; size?: number }) {
  const [err, setErr] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.38 }
  if (!err && p.foto_url) {
    return (
      <img
        src={p.foto_url}
        alt={p.nombre}
        title={p.nombre}
        onError={() => setErr(true)}
        style={style}
        className="rounded-full object-cover border-2 border-background ring-1 ring-white/10 shrink-0"
      />
    )
  }
  return (
    <div
      title={p.nombre}
      style={style}
      className="rounded-full bg-teal-600/30 text-teal-300 font-bold flex items-center justify-center border-2 border-background shrink-0 select-none"
    >
      {p.initials || p.nombre.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Nodo recursivo ────────────────────────────────────────────────────────────

function OrgNodo({
  nodo,
  depth,
  onClickPersonas,
}: {
  nodo: ArbolNodo
  depth: number
  onClickPersonas: (nodo: ArbolNodo) => void
}) {
  const [abierto, setAbierto] = useState(depth < 2)
  const hijos    = nodo.hijos   ?? []
  const personas = nodo.personas ?? []
  const tieneHijos = hijos.length > 0
  const count      = personas.length
  const visibles   = personas.slice(0, 4)
  const extra      = count - visibles.length

  return (
    <div className="relative">
      {/* Línea vertical de conexión */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 w-px bg-teal-500/15"
          style={{ left: -16 }}
        />
      )}

      <div
        className="group relative rounded-xl border border-border/60 bg-zinc-950/80 hover:border-teal-500/30 transition-all duration-200 overflow-hidden"
        style={{ marginLeft: depth > 0 ? 0 : 0 }}
      >
        {/* Borde izquierdo de profundidad */}
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl"
          style={{ backgroundColor: depthColor(depth) }}
        />

        <div className="flex items-center gap-3 px-4 py-3 pl-5">
          {/* Toggle hijos */}
          {tieneHijos ? (
            <button
              onClick={() => setAbierto((v) => !v)}
              className="text-muted-foreground/50 hover:text-teal-400 transition-colors shrink-0"
            >
              {abierto
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-3.5 h-3.5 shrink-0" />
          )}

          {/* Nombre del cargo */}
          <p className="flex-1 text-sm font-semibold text-foreground/90 leading-tight min-w-0 truncate">
            {nodo.nombre}
          </p>

          {/* Avatares + count */}
          {count > 0 && (
            <button
              onClick={() => onClickPersonas(nodo)}
              className="flex items-center gap-1.5 shrink-0 group/av"
              title={`${count} persona${count !== 1 ? "s" : ""}`}
            >
              <div className="flex -space-x-1.5">
                {visibles.map((p) => <Avatar key={p.id} p={p} size={22} />)}
              </div>
              {extra > 0 && (
                <span className="text-[10px] font-semibold text-muted-foreground group-hover/av:text-teal-400 transition-colors">
                  +{extra}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/50 group-hover/av:text-teal-400 transition-colors ml-0.5">
                {count}
              </span>
            </button>
          )}

          {count === 0 && (
            <span className="text-[10px] text-muted-foreground/30 shrink-0">Sin personas</span>
          )}
        </div>
      </div>

      {/* Hijos */}
      {tieneHijos && abierto && (
        <div className="mt-1.5 ml-6 pl-4 border-l border-teal-500/10 space-y-1.5">
          {hijos.map((hijo) => (
            <OrgNodo key={hijo.id} nodo={hijo} depth={depth + 1} onClickPersonas={onClickPersonas} />
          ))}
        </div>
      )}
    </div>
  )
}

function depthColor(depth: number): string {
  const colors = ["#14b8a6", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"]
  return colors[depth % colors.length]
}

// ── Drawer personas ───────────────────────────────────────────────────────────

function PersonasDrawer({ nodo, onClose }: { nodo: ArbolNodo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-xs bg-background border-l border-border shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <p className="font-semibold text-sm">{nodo.nombre}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(nodo.personas ?? []).length} colaborador{(nodo.personas ?? []).length !== 1 ? "es" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {(nodo.personas ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">Sin colaboradores activos</p>
          ) : (
            (nodo.personas ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <Avatar p={p} size={36} />
                <p className="text-sm font-medium text-foreground/90">{p.nombre}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal nuevo cargo ─────────────────────────────────────────────────────────

interface GlobalArea { id: number; name: string }

function ModalNuevoCargo({
  sedes,
  sedeActiva,
  onClose,
  onCreado,
}: {
  sedes: SedeItem[]
  sedeActiva: number | null
  onClose: () => void
  onCreado: () => void
}) {
  const [nombre, setNombre]   = useState("")
  const [sedeIds, setSedeIds] = useState<number[]>(sedeActiva ? [sedeActiva] : [])
  const [areas, setAreas]     = useState<GlobalArea[]>([])
  const [areaId, setAreaId]   = useState<number | "">("")
  const [error, setError]     = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api.get("/areas").then((r) => setAreas(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  function toggleSede(id: number) {
    setSedeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function crear() {
    if (!nombre.trim()) return
    setPending(true); setError("")
    try {
      await api.post("/tc/cargos", { nombre: nombre.trim(), area_id: areaId || null, sede_ids: sedeIds })
      onCreado()
      onClose()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? "Error al crear el cargo.")
    } finally { setPending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">Nuevo cargo</p>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre</label>
            <input
              autoFocus type="text" value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError("") }}
              onKeyDown={(e) => e.key === "Enter" && crear()}
              placeholder="ej. Analista de Operaciones"
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Área</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500/50 appearance-none"
            >
              <option value="">Sin área</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {sedes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Sedes</label>
              <div className="flex flex-wrap gap-2">
                {sedes.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={sedeIds.includes(s.id)} onChange={() => toggleSede(s.id)} className="rounded border-border" />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-destructive px-1">{error}</p>}
          <button
            onClick={crear} disabled={!nombre.trim() || pending}
            className="w-full h-9 text-sm font-medium bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            {pending ? "Creando…" : "Crear cargo"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function TyCOrganigramaPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore((s) => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false

  const { data: sedes = [] } = useSedes()
  const [sedeActiva, setSedeActiva]           = useState<number | null>(null)
  const [arbol, setArbol]                     = useState<ArbolData | null>(null)
  const [loading, setLoading]                 = useState(false)
  const [nodoSeleccionado, setNodoSeleccionado] = useState<ArbolNodo | null>(null)
  const [modalNuevoCargo, setModalNuevoCargo] = useState(false)

  function cargarArbol(sid: number | null) {
    setLoading(true)
    const params = sid ? { sede_id: sid } : {}
    api.get("/tc/organigrama-arbol", { params })
      .then((r) => setArbol(r.data))
      .catch(() => setArbol(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargarArbol(sedeActiva) }, [sedeActiva])

  const totalRaices   = arbol?.raices?.length ?? 0
  const totalCargos   = contarCargos(arbol?.raices ?? [])
  const totalPersonas = contarPersonas(arbol?.raices ?? [])

  return (
    <PageLayout title="T&C — Organigrama" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
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
          {/* Tabs de sede */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
            <button
              onClick={() => setSedeActiva(null)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sedeActiva === null
                  ? "bg-teal-500/15 text-teal-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>
            {(sedes as SedeItem[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSedeActiva(s.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  sedeActiva === s.id
                    ? "bg-teal-500/15 text-teal-400 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            {!loading && arbol && (
              <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                <strong className="text-foreground">{totalCargos}</strong> cargo{totalCargos !== 1 ? "s" : ""} ·{" "}
                <strong className="text-foreground">{totalPersonas}</strong> persona{totalPersonas !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={() => navigate("/tc/organigrama/canvas")}
              className="flex items-center gap-1.5 h-7 px-2.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <LayoutGrid className="w-3 h-3" />
              Canvas
            </button>
            {puedeEditar && (
              <button
                onClick={() => setModalNuevoCargo(true)}
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
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Cargando organigrama…
          </div>
        )}

        {!loading && (!arbol || totalRaices === 0) && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Users className="w-8 h-8 opacity-20" />
            <span className="text-sm">
              {sedeActiva ? "Sin cargos en esta sede." : "Sin cargos definidos aún."}
            </span>
            {puedeEditar && (
              <button onClick={() => setModalNuevoCargo(true)} className="mt-1 text-xs text-teal-500 hover:underline">
                + Crear primer cargo
              </button>
            )}
          </div>
        )}

        {!loading && arbol && totalRaices > 0 && (
          <div className="space-y-2 max-w-3xl">
            {arbol.raices.map((nodo) => (
              <OrgNodo key={nodo.id} nodo={nodo} depth={0} onClickPersonas={setNodoSeleccionado} />
            ))}
          </div>
        )}
      </div>

      {/* Drawer personas */}
      {nodoSeleccionado && (
        <PersonasDrawer nodo={nodoSeleccionado} onClose={() => setNodoSeleccionado(null)} />
      )}

      {/* Modal nuevo cargo */}
      {modalNuevoCargo && (
        <ModalNuevoCargo
          sedes={sedes as SedeItem[]}
          sedeActiva={sedeActiva}
          onClose={() => setModalNuevoCargo(false)}
          onCreado={() => cargarArbol(sedeActiva)}
        />
      )}
    </PageLayout>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function contarCargos(nodos: ArbolNodo[]): number {
  return nodos.reduce((acc, n) => acc + 1 + contarCargos(n.hijos), 0)
}

function contarPersonas(nodos: ArbolNodo[]): number {
  return nodos.reduce((acc, n) => acc + n.personas.length + contarPersonas(n.hijos), 0)
}
