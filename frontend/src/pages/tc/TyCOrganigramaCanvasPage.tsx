import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  BackgroundVariant,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ArrowLeft, List, LayoutGrid } from "lucide-react"

interface PersonaChip { id: number; nombre: string }
interface CargoNode   { id: number; nombre: string; personas: PersonaChip[] }
interface AreaNode    { id: number; nombre: string; cargos: CargoNode[] }
interface OrgData {
  empresa: { id: number; nombre: string; codigo: string }
  areas: AreaNode[]
  sin_area: CargoNode[]
}
interface Empresa { id: number; nombre: string; codigo: string }

type CargoNodeData = { nombre: string; areaNombre: string; areaColor: string; count: number }

const AREA_COLORS = [
  "#14b8a6", "#6366f1", "#f59e0b", "#3b82f6",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
]

function CargoFlowNode({ data }: NodeProps<Node<CargoNodeData>>) {
  return (
    <div
      className="rounded-xl border border-border/80 bg-zinc-950/90 shadow-xl px-3 py-2.5 w-48 select-none cursor-grab active:cursor-grabbing"
      style={{ boxShadow: `0 0 0 1px ${data.areaColor}22, 0 4px 16px #0008` }}
    >
      <p
        className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1 truncate"
        style={{ color: data.areaColor }}
      >
        {data.areaNombre}
      </p>
      <p className="text-xs font-semibold leading-tight text-white truncate">{data.nombre}</p>
      <p className="text-[10px] text-zinc-500 mt-1 tabular-nums">
        {data.count} persona{data.count !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

const NODE_TYPES: NodeTypes = { cargo: CargoFlowNode }

function lsKey(empresaId: number) { return `tc_org_pos_${empresaId}` }

function loadPositions(empresaId: number): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(lsKey(empresaId)) ?? "{}") }
  catch { return {} }
}

function buildNodes(orgData: OrgData, savedPos: Record<string, { x: number; y: number }>): Node<CargoNodeData>[] {
  const nodes: Node<CargoNodeData>[] = []

  orgData.areas.forEach((area, aIdx) => {
    const color = AREA_COLORS[aIdx % AREA_COLORS.length]
    area.cargos.forEach((cargo, cIdx) => {
      const id = String(cargo.id)
      nodes.push({
        id,
        type: "cargo",
        position: savedPos[id] ?? { x: aIdx * 220, y: cIdx * 110 },
        data: {
          nombre: cargo.nombre,
          areaNombre: area.nombre,
          areaColor: color,
          count: cargo.personas.length,
        },
      })
    })
  })

  const sinX = orgData.areas.length * 220
  orgData.sin_area.forEach((cargo, cIdx) => {
    const id = String(cargo.id)
    nodes.push({
      id,
      type: "cargo",
      position: savedPos[id] ?? { x: sinX, y: cIdx * 110 },
      data: {
        nombre: cargo.nombre,
        areaNombre: "Sin área",
        areaColor: "#6b7280",
        count: cargo.personas.length,
      },
    })
  })

  return nodes
}

export function TyCOrganigramaCanvasPage() {
  const navigate = useNavigate()

  const [empresas, setEmpresas]           = useState<Empresa[]>([])
  const [empresaActiva, setEmpresaActiva] = useState<number | null>(null)
  const [orgData, setOrgData]             = useState<OrgData | null>(null)
  const [loading, setLoading]             = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CargoNodeData>>([])

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
        const saved = loadPositions(empresaActiva)
        setNodes(buildNodes(r.data, saved))
      })
      .catch(() => setOrgData(null))
      .finally(() => setLoading(false))
  }, [empresaActiva, setNodes])

  const resetLayout = useCallback(() => {
    if (!orgData || !empresaActiva) return
    localStorage.removeItem(lsKey(empresaActiva))
    setNodes(buildNodes(orgData, {}))
  }, [orgData, empresaActiva, setNodes])

  function handleNodeDragStop(_evt: MouseEvent | TouchEvent, _node: Node<CargoNodeData>, allNodes: Node<CargoNodeData>[]) {
    if (!empresaActiva) return
    const pos: Record<string, { x: number; y: number }> = {}
    allNodes.forEach((n) => { pos[n.id] = n.position })
    localStorage.setItem(lsKey(empresaActiva), JSON.stringify(pos))
  }

  const totalCargos = nodes.length

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
            {/* Selector empresa */}
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

            {/* Toggle vista */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => navigate("/tc/organigrama")}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
              >
                <List className="w-3 h-3" />
                Lista
              </button>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-teal-500/15 text-teal-400 rounded"
              >
                <LayoutGrid className="w-3 h-3" />
                Canvas
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!loading && (
              <span className="text-xs text-muted-foreground tabular-nums">
                <strong className="text-foreground">{totalCargos}</strong> cargo{totalCargos !== 1 ? "s" : ""}
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
            Sin cargos definidos para esta empresa.
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
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
