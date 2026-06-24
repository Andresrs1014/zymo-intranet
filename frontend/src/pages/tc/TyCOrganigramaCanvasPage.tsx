import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { canEditTyC } from "@/lib/permissions"
import { useSedes, type SedeItem } from "@/hooks/useSedes"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { List, LayoutGrid, ChevronLeft, ChevronRight, X, Inbox } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface PersonaMini { id: number; nombre: string; initials: string; foto_url: string }
interface ArbolNodo   { id: number; nombre: string; area_id: number | null; parent_id: number | null; personas: PersonaMini[]; hijos: ArbolNodo[] }
interface CargoPendiente { id: number; nombre: string; area_id: number | null }
interface ArbolData   { raices: ArbolNodo[]; sin_colocar: CargoPendiente[] }

type CargoNodeData = { nombre: string; personas: PersonaMini[]; depth: number }

// ── Design tokens ──────────────────────────────────────────────────────────────

const DEPTH_COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"]
function depthColor(d: number) { return DEPTH_COLORS[d % DEPTH_COLORS.length] }

// ── Avatar mini ───────────────────────────────────────────────────────────────

function AvatarMini({ p }: { p: PersonaMini }) {
  const [err, setErr] = useState(false)
  if (!err && p.foto_url) {
    return (
      <img
        src={p.foto_url} alt={p.nombre} title={p.nombre}
        onError={() => setErr(true)}
        className="w-6 h-6 rounded-full object-cover border-2 border-[#0d0d0f]"
      />
    )
  }
  return (
    <div
      title={p.nombre}
      className="w-6 h-6 rounded-full bg-teal-600/25 text-teal-300 text-[8px] font-bold flex items-center justify-center border-2 border-[#0d0d0f] select-none"
    >
      {p.initials || p.nombre.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Nodo ReactFlow ────────────────────────────────────────────────────────────

function CargoFlowNode({ data }: NodeProps<Node<CargoNodeData>>) {
  const color   = depthColor(data.depth)
  const visibles = data.personas.slice(0, 4)
  const extra    = data.personas.length - visibles.length

  return (
    <div
      className="relative rounded-2xl select-none cursor-grab active:cursor-grabbing overflow-hidden"
      style={{
        width: 220,
        background: "linear-gradient(135deg, rgba(18,18,24,0.97) 0%, rgba(12,12,18,0.99) 100%)",
        border: `1px solid ${color}30`,
        boxShadow: `0 0 0 1px ${color}18, 0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${color}10`,
      }}
    >
      {/* Barra de color superior */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}40)` }} />

      <div className="px-3.5 py-3">
        {/* Dot + nombre */}
        <div className="flex items-start gap-2 mb-2.5">
          <div className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
          <p
            className="text-[11.5px] font-semibold leading-snug text-white/90 flex-1"
            style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em" }}
          >
            {data.nombre}
          </p>
        </div>

        {/* Personas */}
        {data.personas.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {visibles.map(p => <AvatarMini key={p.id} p={p} />)}
            </div>
            <span
              className="text-[10px] tabular-nums ml-auto"
              style={{ color: `${color}cc`, fontFamily: "'DM Mono', monospace" }}
            >
              {extra > 0 ? `+${extra} · ` : ""}{data.personas.length}
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-white/20">Sin colaboradores</p>
        )}
      </div>
    </div>
  )
}

const NODE_TYPES: NodeTypes = { cargo: CargoFlowNode }

// ── Layout ────────────────────────────────────────────────────────────────────

function flattenArbol(nodos: ArbolNodo[], depth: number, result: Array<{ nodo: ArbolNodo; depth: number }> = []) {
  for (const n of nodos) {
    result.push({ nodo: n, depth })
    flattenArbol(n.hijos, depth + 1, result)
  }
  return result
}

function buildNodesEdges(
  arbol: ArbolData,
  savedPos: Record<string, { x: number; y: number }>
): { nodes: Node<CargoNodeData>[]; edges: Edge[] } {
  const flat = flattenArbol(arbol.raices, 0)
  const indexByDepth: Record<number, number> = {}

  const nodes: Node<CargoNodeData>[] = flat.map(({ nodo, depth }) => {
    const idx = indexByDepth[depth] ?? 0
    indexByDepth[depth] = idx + 1
    const id = String(nodo.id)
    return {
      id, type: "cargo",
      position: savedPos[id] ?? { x: depth * 280, y: idx * 110 },
      data: { nombre: nodo.nombre, personas: nodo.personas ?? [], depth },
    }
  })

  const edges: Edge[] = flat.flatMap(({ nodo }) =>
    (nodo.hijos ?? []).map(hijo => ({
      id: `e-${nodo.id}-${hijo.id}`,
      source: String(nodo.id),
      target: String(hijo.id),
      style: { stroke: depthColor(0), strokeWidth: 1.5, opacity: 0.25 },
      type: "smoothstep",
      animated: false,
    }))
  )

  return { nodes, edges }
}

function lsKey(sedeId: number | null) { return `tc_org_canvas_${sedeId ?? "all"}` }
function loadPositions(sedeId: number | null): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(lsKey(sedeId)) ?? "{}") }
  catch { return {} }
}

// ── Modal colocar cargo ───────────────────────────────────────────────────────

function ModalColocarCargo({
  cargo,
  cargosColocados,
  onClose,
  onGuardado,
}: {
  cargo: CargoPendiente
  cargosColocados: ArbolNodo[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [parentId, setParentId] = useState<number | "">("")
  const [pending, setPending]   = useState(false)
  const [error, setError]       = useState("")

  function aplanar(nodos: ArbolNodo[]): ArbolNodo[] {
    return nodos.flatMap(n => [n, ...aplanar(n.hijos ?? [])])
  }
  const opciones = aplanar(cargosColocados).filter(n => n.id !== cargo.id)

  async function guardar() {
    setPending(true); setError("")
    try {
      await api.put(`/tc/cargos/${cargo.id}`, { parent_id: parentId || null, en_organigrama: true })
      onGuardado(); onClose()
    } catch { setError("No se pudo guardar.") }
    finally { setPending(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #1e1e2e 0%, #191928 100%)",
          border: "1px solid rgba(20,184,166,0.35)",
          boxShadow: "0 0 0 1px rgba(20,184,166,0.12), 0 24px 64px rgba(0,0,0,0.7), 0 0 60px rgba(20,184,166,0.06)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-teal-400/90 via-teal-500/40 to-transparent" />

        <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>
              Colocar en organigrama
            </p>
            <p className="text-[15px] font-semibold text-white leading-snug" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {cargo.nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 h-7 w-7 flex items-center justify-center rounded-lg transition-colors shrink-0"
            style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 block" style={{ fontFamily: "'DM Mono', monospace" }}>
              Cargo padre (opcional)
            </label>
            {/* Lista scrollable custom — evita estilos nativos del OS que rompen contraste */}
            <div
              className="rounded-xl overflow-y-auto"
              style={{
                maxHeight: 196,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <button
                onClick={() => setParentId("")}
                className="w-full text-left px-3.5 py-2.5 text-[12px] flex items-center gap-2 transition-colors"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: parentId === "" ? "#2dd4bf" : "rgba(255,255,255,0.5)",
                  background: parentId === "" ? "rgba(20,184,166,0.12)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  fontWeight: parentId === "" ? 600 : 400,
                }}
              >
                <span className="text-[10px] text-white/20 font-mono">—</span>
                Sin padre (raíz del árbol)
              </button>
              {opciones.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setParentId(c.id)}
                  className="w-full text-left px-3.5 py-2 text-[12px] transition-colors"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    color: parentId === c.id ? "#2dd4bf" : "rgba(255,255,255,0.75)",
                    background: parentId === c.id ? "rgba(20,184,166,0.12)" : "transparent",
                    borderBottom: i < opciones.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    fontWeight: parentId === c.id ? 600 : 400,
                  }}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <p className="text-[10px] mt-1.5 px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              Sin selección = aparece como raíz del organigrama
            </p>
          </div>

          {error && <p className="text-xs text-red-400 px-1">{error}</p>}

          <button
            onClick={guardar}
            disabled={pending}
            className="w-full h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: pending ? "rgba(20,184,166,0.3)" : "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
              color: "white",
              boxShadow: pending ? "none" : "0 4px 20px rgba(20,184,166,0.35)",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.01em",
            }}
          >
            {pending ? "Guardando…" : "Colocar en organigrama"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel "Por colocar" ───────────────────────────────────────────────────────

function PanelPorColocar({
  items,
  onSelect,
}: {
  items: CargoPendiente[]
  onSelect: (c: CargoPendiente) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (items.length === 0) return null

  return (
    <div
      className="absolute left-3 top-3 z-10 flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        width: collapsed ? 40 : 220,
        maxHeight: "calc(100% - 24px)",
        background: "linear-gradient(160deg, rgba(14,14,20,0.97) 0%, rgba(10,10,16,0.99) 100%)",
        border: "1px solid rgba(245,158,11,0.2)",
        boxShadow: "0 0 0 1px rgba(245,158,11,0.08), 0 16px 48px rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: "rgba(245,158,11,0.12)" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: "0 0 6px #f59e0b" }} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest leading-none">Por colocar</p>
            <p className="text-[10px] text-white/30 mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>
              {items.length} cargo{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="h-5 w-5 flex items-center justify-center rounded-lg text-white/25 hover:text-amber-400 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Lista */}
      {!collapsed && (
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {items.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-medium transition-all"
              style={{
                background: "transparent",
                border: "1px solid transparent",
                color: "rgba(255,255,255,0.6)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export function TyCOrganigramaCanvasPage() {
  const navigate    = useNavigate()
  const user        = useAuthStore(s => s.user)
  const puedeEditar = user ? canEditTyC(user.role, user.app_permissions) : false
  const { data: sedes = [] } = useSedes()

  const [sedeActiva, setSedeActiva]      = useState<number | null>(null)
  const [arbol, setArbol]                = useState<ArbolData | null>(null)
  const [loading, setLoading]            = useState(false)
  const [cargoAColocar, setCargoAColocar] = useState<CargoPendiente | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CargoNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  function cargarArbol(sid: number | null) {
    setLoading(true)
    const params = sid ? { sede_id: sid } : {}
    api.get("/tc/organigrama-arbol", { params })
      .then(r => {
        const data: ArbolData = r.data
        setArbol(data)
        const saved = loadPositions(sid)
        const { nodes: n, edges: e } = buildNodesEdges(data, saved)
        setNodes(n); setEdges(e)
      })
      .catch(() => setArbol(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargarArbol(sedeActiva) }, [sedeActiva])

  const resetLayout = useCallback(() => {
    if (!arbol) return
    localStorage.removeItem(lsKey(sedeActiva))
    const { nodes: n, edges: e } = buildNodesEdges(arbol, {})
    setNodes(n); setEdges(e)
  }, [arbol, sedeActiva, setNodes, setEdges])

  function handleNodeDragStop(_: MouseEvent | TouchEvent, _n: Node<CargoNodeData>, allNodes: Node<CargoNodeData>[]) {
    const pos: Record<string, { x: number; y: number }> = {}
    allNodes.forEach(n => { pos[n.id] = n.position })
    localStorage.setItem(lsKey(sedeActiva), JSON.stringify(pos))
  }

  const sinColocar = arbol?.sin_colocar ?? []

  return (
    <PageLayout title="T&C — Organigrama" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Sedes */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
            <button
              onClick={() => setSedeActiva(null)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sedeActiva === null ? "bg-teal-500/15 text-teal-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas
            </button>
            {(sedes as SedeItem[]).map(s => (
              <button
                key={s.id}
                onClick={() => setSedeActiva(s.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  sedeActiva === s.id ? "bg-teal-500/15 text-teal-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Vista lista / canvas */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => navigate("/tc/organigrama")}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
              >
                <List className="w-3 h-3" />
                Lista
              </button>
              <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-teal-500/15 text-teal-400 rounded">
                <LayoutGrid className="w-3 h-3" />
                Canvas
              </button>
            </div>

            {/* Stats */}
            {!loading && (
              <span className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
                <strong className="text-foreground">{nodes.length}</strong> colocado{nodes.length !== 1 ? "s" : ""}
                {sinColocar.length > 0 && (
                  <span className="ml-2 text-amber-400">· {sinColocar.length} pendiente{sinColocar.length !== 1 ? "s" : ""}</span>
                )}
              </span>
            )}

            <button
              onClick={resetLayout}
              className="h-7 px-2.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Auto-ordenar
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
              <p className="text-xs text-muted-foreground">Cargando organigrama…</p>
            </div>
          </div>
        )}

        {!loading && nodes.length === 0 && sinColocar.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Inbox className="w-10 h-10 opacity-20" />
            <p className="text-sm">{sedeActiva ? "Sin cargos en esta sede." : "Sin cargos definidos."}</p>
          </div>
        )}

        {!loading && nodes.length === 0 && sinColocar.length > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground pointer-events-none">
            <Inbox className="w-10 h-10 opacity-15" />
            <p className="text-sm opacity-60">El árbol está vacío — coloca cargos desde el panel izquierdo</p>
          </div>
        )}

        {/* Panel pendientes */}
        {puedeEditar && !loading && (
          <PanelPorColocar items={sinColocar} onSelect={setCargoAColocar} />
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#ffffff08" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Modal */}
      {cargoAColocar && (
        <ModalColocarCargo
          cargo={cargoAColocar}
          cargosColocados={arbol?.raices ?? []}
          onClose={() => setCargoAColocar(null)}
          onGuardado={() => { setCargoAColocar(null); cargarArbol(sedeActiva) }}
        />
      )}
    </PageLayout>
  )
}
