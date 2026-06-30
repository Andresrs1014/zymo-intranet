import { useState, useEffect, useCallback, useRef } from "react"
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
import dagre from "@dagrejs/dagre"
import {
  ArrowLeft, X, ChevronLeft, ChevronRight, Inbox, Users, Plus,
  Upload, Link2, Trash2, Check, Loader2,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface PersonaMini { id: number; nombre: string; initials: string; foto_url: string }

interface ArbolNodo {
  id: number
  nombre: string
  area_id: number | null
  parent_id: number | null
  personas: PersonaMini[]
  org_number: string
  org_image_url: string
  org_pos_x?: number | null
  org_pos_y?: number | null
  hijos: ArbolNodo[]
}

interface CargoPendiente { id: number; nombre: string; area_id: number | null }
interface ArbolData    { raices: ArbolNodo[]; sin_colocar: CargoPendiente[] }
interface GlobalArea   { id: number; name: string }

type CargoNodeData = {
  nombre: string
  personas: PersonaMini[]
  org_number: string
  org_image_url: string
  isRoot: boolean
}

// ── Paleta Directorio ZYMO ──────────────────────────────────────────────────────

const ORG = {
  red: "#ef3340",
  cyan: "#00a8c8",
  gold: "#d6aa48",
  goldLine: "rgba(218,175,75,0.55)",
  goldBorder: "rgba(218,175,75,0.5)",
  cardBg: "#ffffff",
  rootFrom: "#4e1012",
  rootTo: "#74151d",
  ink: "#1f2430",
  numberBg: "#fff1c9",
  numberInk: "#74151d",
}

// ── Layout ─────────────────────────────────────────────────────────────────────

const NODE_W = 196
const NODE_H = 132

function orgContext(sedeId: number | null): string {
  return sedeId === null ? "corporativo" : `sede:${sedeId}`
}

function flattenArbol(nodos: ArbolNodo[], result: ArbolNodo[] = []): ArbolNodo[] {
  for (const n of nodos) { result.push(n); flattenArbol(n.hijos, result) }
  return result
}

function findNodo(nodos: ArbolNodo[], id: number): ArbolNodo | null {
  for (const n of nodos) {
    if (n.id === id) return n
    const found = findNodo(n.hijos, id)
    if (found) return found
  }
  return null
}

function buildNodesEdges(arbol: ArbolData): { nodes: Node<CargoNodeData>[]; edges: Edge[] } {
  const flat = flattenArbol(arbol.raices)

  const rootIds = new Set(arbol.raices.map((r) => r.id))

  const edges: Edge[] = flat.flatMap((nodo) =>
    nodo.hijos.map((hijo) => ({
      id: `e-${nodo.id}-${hijo.id}`,
      source: String(nodo.id),
      target: String(hijo.id),
      type: "smoothstep",
      style: { stroke: ORG.gold, strokeWidth: 1.6, opacity: 0.7 },
      animated: false,
    }))
  )

  // Dagre — vertical top-down (raíz arriba, ramas hacia abajo)
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", nodesep: 38, ranksep: 96, marginx: 24, marginy: 24 })
  flat.forEach((n) => g.setNode(String(n.id), { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)

  const nodes: Node<CargoNodeData>[] = flat.map((nodo) => {
    const dg = g.node(String(nodo.id))
    // Server positions override dagre per node
    const position =
      nodo.org_pos_x != null && nodo.org_pos_y != null
        ? { x: nodo.org_pos_x, y: nodo.org_pos_y }
        : { x: (dg?.x ?? 0) - NODE_W / 2, y: (dg?.y ?? 0) - NODE_H / 2 }
    return {
      id: String(nodo.id),
      type: "cargo",
      position,
      data: {
        nombre: nodo.nombre,
        personas: nodo.personas ?? [],
        org_number: nodo.org_number ?? "",
        org_image_url: nodo.org_image_url ?? "",
        isRoot: rootIds.has(nodo.id),
      },
    }
  })

  return { nodes, edges }
}

// ── Avatars ────────────────────────────────────────────────────────────────────

function AvatarMini({ p }: { p: PersonaMini }) {
  const [err, setErr] = useState(false)
  if (!err && p.foto_url) {
    return (
      <img
        src={p.foto_url} alt={p.nombre} title={p.nombre}
        onError={() => setErr(true)}
        className="w-5 h-5 rounded-full object-cover border-2 border-white shadow-sm"
      />
    )
  }
  return (
    <div
      title={p.nombre}
      className="w-5 h-5 rounded-full text-[7px] font-bold flex items-center justify-center border-2 border-white shadow-sm select-none"
      style={{ background: "rgba(0,168,200,0.12)", color: "#0a7c93" }}
    >
      {p.initials || p.nombre.slice(0, 2).toUpperCase()}
    </div>
  )
}

function Avatar({ p, size = 24 }: { p: PersonaMini; size?: number }) {
  const [err, setErr] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.38 }
  if (!err && p.foto_url) {
    return (
      <img
        src={p.foto_url} alt={p.nombre} title={p.nombre} onError={() => setErr(true)}
        style={style}
        className="rounded-full object-cover border-2 border-background ring-1 ring-white/10 shrink-0"
      />
    )
  }
  return (
    <div
      title={p.nombre}
      style={{ ...style, background: "rgba(0,168,200,0.14)", color: "#0a7c93" }}
      className="rounded-full font-bold flex items-center justify-center border-2 border-background shrink-0 select-none"
    >
      {p.initials || p.nombre.slice(0, 2).toUpperCase()}
    </div>
  )
}

function CargoAvatar({ orgImageUrl, nombre, size = 48 }: { orgImageUrl: string; nombre: string; size?: number }) {
  const [err, setErr] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.28 }
  if (!err && orgImageUrl) {
    return (
      <img
        src={orgImageUrl} alt={nombre} onError={() => setErr(true)}
        style={style}
        className="rounded-full object-cover border-2 border-[#dab04b]/50 ring-1 ring-black/5 shrink-0"
      />
    )
  }
  return (
    <div
      style={style}
      className="rounded-full bg-zinc-800 text-zinc-500 font-bold flex items-center justify-center border-2 border-border shrink-0 select-none"
    >
      {nombre.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── OrgChartNode (canvas card) ─────────────────────────────────────────────────

function OrgChartNode({ data }: NodeProps<Node<CargoNodeData>>) {
  const visibles = data.personas.slice(0, 4)
  const extra    = data.personas.length - visibles.length
  const root     = data.isRoot

  return (
    <div
      className="org-nodo-item relative rounded-xl select-none cursor-grab active:cursor-grabbing overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        width: NODE_W,
        background: root
          ? `linear-gradient(150deg, ${ORG.rootFrom}, ${ORG.rootTo})`
          : ORG.cardBg,
        border: `1px solid ${root ? "rgba(218,175,75,0.72)" : ORG.goldBorder}`,
        boxShadow: root
          ? "0 14px 34px rgba(116,21,29,0.28)"
          : "0 10px 26px rgba(35,38,45,0.10), inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      {/* Barra superior rojo→oro (Directorio) */}
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(90deg, ${ORG.red}, ${ORG.gold})` }}
      />

      <div className="px-3 pt-2.5 pb-2.5 relative">
        {/* Badge número jerárquico */}
        {data.org_number && (
          <span
            className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold tabular-nums leading-none"
            style={{
              fontFamily: "'DM Mono', monospace",
              color: root ? "#fff" : ORG.numberInk,
              background: root ? "rgba(255,255,255,0.16)" : ORG.numberBg,
              border: `1px solid ${root ? "rgba(255,255,255,0.24)" : "rgba(218,175,75,0.45)"}`,
            }}
          >
            {data.org_number}
          </span>
        )}

        {/* Foto del nodo — org_image_url, NO persona.foto_url */}
        <div className="flex justify-center mb-2 mt-1">
          {data.org_image_url ? (
            <img
              src={data.org_image_url} alt=""
              className="w-11 h-11 rounded-full object-cover"
              style={{ border: `2px solid ${root ? "rgba(246,195,74,0.7)" : "rgba(218,175,75,0.5)"}` }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: root ? "rgba(255,255,255,0.1)" : "rgba(0,168,200,0.08)",
                border: `1px solid ${root ? "rgba(246,195,74,0.4)" : "rgba(0,168,200,0.18)"}`,
              }}
            >
              <Users className="w-4 h-4" style={{ color: root ? "#f6c34a" : ORG.cyan }} />
            </div>
          )}
        </div>

        {/* Nombre del cargo */}
        <p
          className="text-[11px] font-semibold leading-snug text-center mb-2"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            color: root ? "#ffffff" : ORG.ink,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.nombre}
        </p>

        {/* Personas */}
        {data.personas.length > 0 ? (
          <div className="flex items-center justify-center gap-1.5">
            <div className="flex -space-x-1">{visibles.map((p) => <AvatarMini key={p.id} p={p} />)}</div>
            <span
              className="text-[9px] tabular-nums"
              style={{ color: root ? "#edcf91" : ORG.cyan, fontFamily: "'DM Mono', monospace" }}
            >
              {extra > 0 ? `+${extra} ` : ""}{data.personas.length}
            </span>
          </div>
        ) : (
          <p className="text-[9px] text-center" style={{ color: root ? "rgba(255,255,255,0.4)" : "#9aa3b2" }}>
            Sin colaboradores
          </p>
        )}
      </div>
    </div>
  )
}

const NODE_TYPES: NodeTypes = { cargo: OrgChartNode }

// ── Panel "Por colocar" (overlay sobre canvas) ─────────────────────────────────

function PanelPorColocar({ items, onSelect }: { items: CargoPendiente[]; onSelect: (c: CargoPendiente) => void }) {
  const [collapsed, setCollapsed] = useState(false)
  if (items.length === 0) return null
  return (
    <div
      className="absolute left-3 top-3 z-10 flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        width: collapsed ? 40 : 220, maxHeight: "calc(100% - 24px)",
        background: "#ffffff",
        border: `1px solid ${ORG.goldBorder}`,
        boxShadow: "0 16px 42px rgba(35,38,45,0.16), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0" style={{ borderColor: "rgba(218,175,75,0.25)" }}>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ORG.red, boxShadow: `0 0 6px ${ORG.red}` }} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest leading-none" style={{ color: ORG.red }}>Por colocar</p>
            <p className="text-[10px] mt-0.5" style={{ color: "#8a93a3", fontFamily: "'DM Mono', monospace" }}>
              {items.length} cargo{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="h-5 w-5 flex items-center justify-center rounded-lg transition-colors shrink-0"
          style={{ color: "#9aa3b2" }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>
      {!collapsed && (
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {items.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-medium transition-all hover:bg-[#fff7dc]"
              style={{ color: ORG.ink, fontFamily: "'DM Sans', sans-serif" }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── NodeDrawer — edit cargo en organigrama ─────────────────────────────────────

function NodeDrawer({ nodo, onClose, onUpdated }: { nodo: ArbolNodo; onClose: () => void; onUpdated: () => void }) {
  const navigate = useNavigate()
  const [orgNumber, setOrgNumber]       = useState(nodo.org_number ?? "")
  const [savingNumber, setSavingNumber] = useState(false)
  const [savedNumber, setSavedNumber]   = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [previewUrl, setPreviewUrl]     = useState(nodo.org_image_url ?? "")
  const [removing, setRemoving]         = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPreviewUrl(nodo.org_image_url ?? "") }, [nodo.org_image_url])

  async function guardarOrgNumber() {
    if (orgNumber === (nodo.org_number ?? "")) return
    setSavingNumber(true)
    try {
      await api.put(`/tc/cargos/${nodo.id}`, { org_number: orgNumber.trim() || null })
      setSavedNumber(true)
      setTimeout(() => { setSavedNumber(false); onUpdated() }, 700)
    } catch { setSavingNumber(false) }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const { data } = await api.post(`/tc/cargos/${nodo.id}/org-image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setPreviewUrl((data as { org_image_url?: string }).org_image_url ?? "")
      setTimeout(() => onUpdated(), 800)
    } catch { /* silent */ }
    finally { setUploading(false) }
  }

  async function quitarDelOrg() {
    if (!confirm(`¿Quitar "${nodo.nombre}" del organigrama?`)) return
    setRemoving(true)
    try {
      await api.put(`/tc/cargos/${nodo.id}`, { en_organigrama: false })
      onUpdated(); onClose()
    } catch { setRemoving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-xs bg-background border-l border-border shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <CargoAvatar orgImageUrl={previewUrl} nombre={nodo.nombre} size={40} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{nodo.nombre}</p>
            {nodo.org_number && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{nodo.org_number}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Número jerárquico */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Número jerárquico</p>
            <div className="flex items-center gap-2">
              <input
                value={orgNumber}
                onChange={(e) => setOrgNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && guardarOrgNumber()}
                placeholder="ej. 1.2.3"
                className="flex-1 px-3 py-2 text-sm font-mono bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ef3340]/40"
              />
              <button
                onClick={guardarOrgNumber}
                disabled={savingNumber}
                className={`h-9 w-9 flex items-center justify-center rounded-xl text-white transition-all shrink-0 ${savedNumber ? "bg-emerald-500" : "bg-[#ef3340] hover:bg-[#d62d39]"}`}
                title="Guardar número"
              >
                {savingNumber ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 opacity-60" />}
              </button>
            </div>
          </section>

          {/* Foto del nodo */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Foto del nodo</p>
            <div className="flex items-center gap-3">
              <CargoAvatar orgImageUrl={previewUrl} nombre={nodo.nombre} size={52} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {uploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Subiendo…</> : <><Upload className="w-3 h-3" /> Subir foto</>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
          </section>

          {/* Personas */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Colaboradores ({(nodo.personas ?? []).length})
            </p>
            {(nodo.personas ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">Sin colaboradores activos</p>
            ) : (
              <div className="space-y-1">
                {(nodo.personas ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { navigate(`/tc/persona/${p.id}`); onClose() }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors group text-left"
                  >
                    <Avatar p={p} size={32} />
                    <span className="flex-1 text-sm font-medium text-foreground/90 truncate">{p.nombre}</span>
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-[#00a8c8] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Quitar del organigrama */}
          <section>
            <button
              onClick={quitarDelOrg}
              disabled={removing}
              className="w-full flex items-center justify-center gap-2 h-9 text-xs font-medium text-destructive/80 border border-destructive/30 rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all disabled:opacity-50"
            >
              {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Quitar del organigrama
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Modal colocar cargo ────────────────────────────────────────────────────────

function ModalColocarCargo({
  cargo, cargosColocados, orgContextValue, onClose, onGuardado,
}: {
  cargo: CargoPendiente; cargosColocados: ArbolNodo[]
  orgContextValue: string; onClose: () => void; onGuardado: () => void
}) {
  const [parentId, setParentId] = useState<number | "">("")
  const [pending, setPending]   = useState(false)
  const [error, setError]       = useState("")

  function aplanar(nodos: ArbolNodo[]): ArbolNodo[] {
    return nodos.flatMap((n) => [n, ...aplanar(n.hijos)])
  }
  const opciones = aplanar(cargosColocados).filter((n) => n.id !== cargo.id)

  async function guardar() {
    setPending(true); setError("")
    try {
      await api.put(`/tc/cargos/${cargo.id}`, {
        parent_id: parentId || null, en_organigrama: true, org_context: orgContextValue,
      })
      onGuardado(); onClose()
    } catch { setError("No se pudo guardar.") }
    finally { setPending(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "#ffffff",
          border: `1px solid ${ORG.goldBorder}`,
          boxShadow: "0 24px 60px rgba(35,38,45,0.22), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${ORG.red}, ${ORG.gold})` }} />
        <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid rgba(218,175,75,0.22)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: ORG.red, fontFamily: "'DM Mono', monospace" }}>
              Colocar en organigrama
            </p>
            <p className="text-[15px] font-semibold" style={{ color: ORG.ink, fontFamily: "'DM Sans', sans-serif" }}>{cargo.nombre}</p>
          </div>
          <button onClick={onClose} className="mt-0.5 h-7 w-7 flex items-center justify-center rounded-lg shrink-0" style={{ color: "#9aa3b2", background: "#f1f3f7" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "#8a93a3", fontFamily: "'DM Mono', monospace" }}>
              Cargo padre (opcional)
            </label>
            <div className="rounded-xl overflow-y-auto" style={{ maxHeight: 196, border: "1px solid rgba(218,175,75,0.3)", background: "#fbfaf6" }}>
              <button
                onClick={() => setParentId("")}
                className="w-full text-left px-3.5 py-2.5 text-[12px] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif", color: parentId === "" ? ORG.red : "#5b6573", background: parentId === "" ? "#fff1c9" : "transparent", borderBottom: "1px solid rgba(218,175,75,0.16)", fontWeight: parentId === "" ? 600 : 400 }}
              >
                — Sin padre (raíz del árbol)
              </button>
              {opciones.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setParentId(c.id)}
                  className="w-full text-left px-3.5 py-2 text-[12px] transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif", color: parentId === c.id ? ORG.red : ORG.ink, background: parentId === c.id ? "#fff1c9" : "transparent", borderBottom: i < opciones.length - 1 ? "1px solid rgba(218,175,75,0.12)" : "none", fontWeight: parentId === c.id ? 600 : 400 }}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 px-1">{error}</p>}
          <button
            onClick={guardar} disabled={pending}
            className="w-full h-10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: pending ? "rgba(239,51,64,0.4)" : ORG.red, color: "white", boxShadow: pending ? "none" : "0 8px 22px rgba(239,51,64,0.28)", fontFamily: "'DM Sans', sans-serif" }}
          >
            {pending ? "Guardando…" : "Colocar en organigrama"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nuevo cargo ──────────────────────────────────────────────────────────

function ModalNuevoCargo({ sedes, sedeActiva, orgContextValue, onClose, onCreado }: {
  sedes: SedeItem[]; sedeActiva: number | null
  orgContextValue: string; onClose: () => void; onCreado: () => void
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
      await api.post("/tc/cargos", { nombre: nombre.trim(), area_id: areaId || null, sede_ids: sedeIds, org_context: orgContextValue })
      onCreado(); onClose()
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
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre del cargo</label>
            <input
              autoFocus type="text" value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError("") }}
              onKeyDown={(e) => e.key === "Enter" && crear()}
              placeholder="ej. Analista de Operaciones"
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none focus:ring-1 focus:ring-[#ef3340]/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Área</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-input rounded-xl focus:outline-none appearance-none"
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
            className="w-full h-9 text-sm font-medium bg-[#ef3340] text-white rounded-xl hover:bg-[#d62d39] disabled:opacity-50 transition-colors"
          >
            {pending ? "Creando…" : "Crear cargo"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────

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
  const [cargoAColocar, setCargoAColocar]     = useState<CargoPendiente | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CargoNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const ctxActivo = orgContext(sedeActiva)

  function cargarArbol(sid: number | null) {
    setLoading(true)
    api.get("/tc/organigrama-arbol", { params: sid ? { sede_id: sid } : {} })
      .then((r) => {
        const data: ArbolData = r.data
        setArbol(data)
        const { nodes: n, edges: e } = buildNodesEdges(data)
        setNodes(n); setEdges(e)
      })
      .catch(() => setArbol(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargarArbol(sedeActiva) }, [sedeActiva])

  const resetLayout = useCallback(() => {
    if (!arbol) return
    const limpio: ArbolData = {
      ...arbol,
      raices: stripServerPos(arbol.raices),
    }
    const { nodes: n, edges: e } = buildNodesEdges(limpio)
    setNodes(n); setEdges(e)
    // Persistir el reset: limpiar posiciones manuales para que el auto-layout aguante al recargar
    n.forEach((node) => {
      api.put(`/tc/cargos/${node.id}`, { org_pos_x: null, org_pos_y: null }).catch(() => {})
    })
  }, [arbol, setNodes, setEdges])

  // Drag stop → persistir posición en servidor (fire-and-forget)
  const handleNodeDragStop = (_: unknown, node: Node<CargoNodeData>) => {
    api.put(`/tc/cargos/${node.id}`, {
      org_pos_x: node.position.x,
      org_pos_y: node.position.y,
    }).catch(() => {})
  }

  const sinColocar = arbol?.sin_colocar ?? []

  return (
    <PageLayout title="T&C — Organigrama" mainClassName="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-3">
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
          {/* Tabs sede */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
            <button
              onClick={() => setSedeActiva(null)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${sedeActiva === null ? "bg-[#ef3340]/12 text-[#ef3340] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Corporativo
            </button>
            {(sedes as SedeItem[]).map((s) => (
              <button
                key={s.id}
                onClick={() => setSedeActiva(s.id)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${sedeActiva === s.id ? "bg-[#ef3340]/12 text-[#ef3340] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!loading && (
              <span className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
                <strong className="text-foreground">{nodes.length}</strong> colocado{nodes.length !== 1 ? "s" : ""}
                {sinColocar.length > 0 && (
                  <span className="ml-2 text-[#b8860b]">· {sinColocar.length} pendiente{sinColocar.length !== 1 ? "s" : ""}</span>
                )}
              </span>
            )}
            <button
              onClick={resetLayout}
              className="h-7 px-2.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Auto-ordenar
            </button>
            {puedeEditar && (
              <button
                onClick={() => setModalNuevoCargo(true)}
                className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium border border-dashed border-[#ef3340]/40 rounded-lg text-[#ef3340]/80 hover:border-[#ef3340]/70 hover:text-[#ef3340] hover:bg-[#ef3340]/5 transition-all"
              >
                <Plus className="w-3 h-3" />
                Nuevo cargo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 relative"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(239,51,64,.05), transparent 30%), linear-gradient(180deg,#f7f8fb 0%,#f4f6fa 46%,#eef1f6 100%)",
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#ef3340]/25 border-t-[#ef3340] animate-spin" />
              <p className="text-xs text-muted-foreground">Cargando organigrama…</p>
            </div>
          </div>
        )}

        {!loading && nodes.length === 0 && sinColocar.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Inbox className="w-10 h-10 opacity-20" />
            <p className="text-sm">{sedeActiva ? "Sin cargos en esta sede." : "Sin cargos definidos."}</p>
            {puedeEditar && (
              <button onClick={() => setModalNuevoCargo(true)} className="text-xs text-[#ef3340] hover:underline">
                + Crear primer cargo
              </button>
            )}
          </div>
        )}

        {!loading && nodes.length === 0 && sinColocar.length > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground pointer-events-none">
            <Inbox className="w-10 h-10 opacity-15" />
            <p className="text-sm opacity-60">El árbol está vacío — coloca cargos desde el panel izquierdo</p>
          </div>
        )}

        {puedeEditar && !loading && <PanelPorColocar items={sinColocar} onSelect={setCargoAColocar} />}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={(_, node) => {
            const nodo = findNodo(arbol?.raices ?? [], Number(node.id))
            if (nodo) setNodoSeleccionado(nodo)
          }}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.12}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(218,175,75,0.18)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {nodoSeleccionado && (
        <NodeDrawer
          nodo={nodoSeleccionado}
          onClose={() => setNodoSeleccionado(null)}
          onUpdated={() => { setNodoSeleccionado(null); cargarArbol(sedeActiva) }}
        />
      )}

      {modalNuevoCargo && (
        <ModalNuevoCargo
          sedes={sedes as SedeItem[]}
          sedeActiva={sedeActiva}
          orgContextValue={ctxActivo}
          onClose={() => setModalNuevoCargo(false)}
          onCreado={() => cargarArbol(sedeActiva)}
        />
      )}

      {cargoAColocar && (
        <ModalColocarCargo
          cargo={cargoAColocar}
          cargosColocados={arbol?.raices ?? []}
          orgContextValue={ctxActivo}
          onClose={() => setCargoAColocar(null)}
          onGuardado={() => { setCargoAColocar(null); cargarArbol(sedeActiva) }}
        />
      )}
    </PageLayout>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripServerPos(nodos: ArbolNodo[]): ArbolNodo[] {
  return nodos.map((n) => ({ ...n, org_pos_x: null, org_pos_y: null, hijos: stripServerPos(n.hijos) }))
}
