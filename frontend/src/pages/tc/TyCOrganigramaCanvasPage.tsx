import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
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
import { ArrowLeft, List, LayoutGrid } from "lucide-react"

interface PersonaMini { id: number; nombre: string; initials: string; foto_url: string }
interface ArbolNodo   { id: number; nombre: string; area_id: number | null; parent_id: number | null; personas: PersonaMini[]; hijos: ArbolNodo[] }
interface ArbolData   { raices: ArbolNodo[] }

type CargoNodeData = { nombre: string; personas: PersonaMini[]; depth: number }

const DEPTH_COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"]

function depthColor(depth: number) { return DEPTH_COLORS[depth % DEPTH_COLORS.length] }

// ── Nodo visual en ReactFlow ──────────────────────────────────────────────────

function CargoFlowNode({ data }: NodeProps<Node<CargoNodeData>>) {
  const color  = depthColor(data.depth)
  const visibles = data.personas.slice(0, 3)
  const extra    = data.personas.length - visibles.length

  return (
    <div
      className="rounded-xl border bg-zinc-950/90 shadow-xl px-3 py-2.5 w-52 select-none cursor-grab active:cursor-grabbing"
      style={{ borderColor: `${color}44`, boxShadow: `0 0 0 1px ${color}22, 0 4px 16px #0008` }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-xs font-semibold leading-tight text-white/90 truncate flex-1">{data.nombre}</p>
      </div>

      {data.personas.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {visibles.map((p) => <AvatarMini key={p.id} p={p} />)}
          </div>
          {extra > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extra}</span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {data.personas.length}
          </span>
        </div>
      )}
    </div>
  )
}

function AvatarMini({ p }: { p: PersonaMini }) {
  const [err, setErr] = useState(false)
  if (!err && p.foto_url) {
    return (
      <img
        src={p.foto_url} alt={p.nombre} title={p.nombre}
        onError={() => setErr(true)}
        className="w-5 h-5 rounded-full object-cover border border-background"
      />
    )
  }
  return (
    <div title={p.nombre} className="w-5 h-5 rounded-full bg-teal-600/30 text-teal-300 text-[8px] font-bold flex items-center justify-center border border-background">
      {p.initials || p.nombre.slice(0, 2).toUpperCase()}
    </div>
  )
}

const NODE_TYPES: NodeTypes = { cargo: CargoFlowNode }

// ── Layout automático (columnas por profundidad) ───────────────────────────────

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

  // Cuenta cuántos nodos hay por profundidad para el layout
  const countByDepth: Record<number, number> = {}
  const indexByDepth: Record<number, number> = {}
  for (const { depth } of flat) { countByDepth[depth] = (countByDepth[depth] ?? 0) + 1 }

  const nodes: Node<CargoNodeData>[] = flat.map(({ nodo, depth }) => {
    const idx = indexByDepth[depth] ?? 0
    indexByDepth[depth] = idx + 1
    const id = String(nodo.id)
    return {
      id,
      type: "cargo",
      position: savedPos[id] ?? { x: depth * 260, y: idx * 100 },
      data: { nombre: nodo.nombre, personas: nodo.personas, depth },
    }
  })

  const edges: Edge[] = []
  for (const { nodo } of flat) {
    for (const hijo of nodo.hijos) {
      edges.push({
        id: `e-${nodo.id}-${hijo.id}`,
        source: String(nodo.id),
        target: String(hijo.id),
        style: { stroke: depthColor(0), strokeWidth: 1, opacity: 0.4 },
        type: "smoothstep",
        animated: false,
      })
    }
  }

  return { nodes, edges }
}

function lsKey(sedeId: number | null) { return `tc_org_canvas_${sedeId ?? "all"}` }

function loadPositions(sedeId: number | null): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(lsKey(sedeId)) ?? "{}") }
  catch { return {} }
}

// ── Página ────────────────────────────────────────────────────────────────────

export function TyCOrganigramaCanvasPage() {
  const navigate = useNavigate()
  const { data: sedes = [] } = useSedes()

  const [sedeActiva, setSedeActiva]      = useState<number | null>(null)
  const [arbol, setArbol]                = useState<ArbolData | null>(null)
  const [loading, setLoading]            = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CargoNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    setLoading(true)
    const params = sedeActiva ? { sede_id: sedeActiva } : {}
    api.get("/tc/organigrama-arbol", { params })
      .then((r) => {
        setArbol(r.data)
        const saved = loadPositions(sedeActiva)
        const { nodes: n, edges: e } = buildNodesEdges(r.data, saved)
        setNodes(n)
        setEdges(e)
      })
      .catch(() => setArbol(null))
      .finally(() => setLoading(false))
  }, [sedeActiva, setNodes, setEdges])

  const resetLayout = useCallback(() => {
    if (!arbol) return
    localStorage.removeItem(lsKey(sedeActiva))
    const { nodes: n, edges: e } = buildNodesEdges(arbol, {})
    setNodes(n)
    setEdges(e)
  }, [arbol, sedeActiva, setNodes, setEdges])

  function handleNodeDragStop(_: MouseEvent | TouchEvent, _n: Node<CargoNodeData>, allNodes: Node<CargoNodeData>[]) {
    const pos: Record<string, { x: number; y: number }> = {}
    allNodes.forEach((n) => { pos[n.id] = n.position })
    localStorage.setItem(lsKey(sedeActiva), JSON.stringify(pos))
  }

  return (
    <PageLayout title="T&C — Organigrama canvas" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate("/tc/organigrama")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Organigrama
          </button>
          <span className="text-muted-foreground/30 text-xs">/</span>
          <span className="text-sm font-medium">Canvas</span>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
              <button
                onClick={() => setSedeActiva(null)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  sedeActiva === null ? "bg-teal-500/15 text-teal-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todas
              </button>
              {(sedes as SedeItem[]).map((s) => (
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
          </div>

          <div className="flex items-center gap-4">
            {!loading && (
              <span className="text-xs text-muted-foreground tabular-nums">
                <strong className="text-foreground">{nodes.length}</strong> cargo{nodes.length !== 1 ? "s" : ""}
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
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm z-10">
            Cargando…
          </div>
        )}
        {!loading && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            {sedeActiva ? "Sin cargos en esta sede." : "Sin cargos definidos."}
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ffffff10" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </PageLayout>
  )
}
