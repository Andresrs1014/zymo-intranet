import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import {
  ChevronRight, ChevronDown, FolderOpen, Folder,
  FileText, GitCommit, Inbox, Plus, Circle,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SigArea {
  id: number
  nombre: string
  descripcion?: string
  color: string
  _count: { procedimientos: number }
}

interface SigProcedimiento {
  id: number
  codigo: string
  titulo: string
  estado: "BORRADOR" | "VIGENTE" | "OBSOLETO"
}

interface SigCommit {
  id: number
  mensaje: string
  estado: "PENDIENTE_REVISION" | "APROBADO" | "RECHAZADO"
  createdAt: string
}

export interface ProcedureOpenInfo {
  codigo: string
  titulo: string
  areaColor: string
  areaNombre: string
}

export interface CommitOpenInfo {
  mensaje: string
  codigo: string
}

interface Props {
  activeKey: string | null
  isGerente: boolean
  pendingCount: number
  onSelectProcedure: (id: number, info: ProcedureOpenInfo) => void
  onSelectCommit: (id: number, info: CommitOpenInfo) => void
  onOpenQueue: () => void
}

const COLORS = [
  "#ef3340", "#3b82f6", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
]

// ── Main Explorer ──────────────────────────────────────────────────────────────

export function SigExplorer({
  activeKey, isGerente, pendingCount,
  onSelectProcedure, onSelectCommit, onOpenQueue,
}: Props) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "admin"
  const isManager = user?.role === "admin" || user?.role === "gerente"
  const qc = useQueryClient()

  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set())
  const [expandedProcs, setExpandedProcs] = useState<Set<number>>(new Set())
  const [showNewArea, setShowNewArea] = useState(false)
  const [newAreaForm, setNewAreaForm] = useState({ nombre: "", descripcion: "", color: "#ef3340" })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get("/api/areas")).data,
  })

  const createArea = useMutation({
    mutationFn: (data: typeof newAreaForm) => sigApi.post("/api/areas", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig", "areas"] })
      setShowNewArea(false)
      setNewAreaForm({ nombre: "", descripcion: "", color: "#ef3340" })
      setFormError(null)
    },
    onError: (e: any) => setFormError(e?.response?.data?.error ?? "Error al crear el área"),
  })

  function toggleArea(id: number) {
    setExpandedAreas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleProc(id: number) {
    setExpandedProcs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div
      className="flex flex-col shrink-0 border-r border-zinc-800/80 bg-[#111113] overflow-hidden"
      style={{ width: 264 }}
    >
      {/* Explorer header */}
      <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-zinc-800/60">
        <span className="text-[10px] font-semibold text-zinc-500 tracking-widest uppercase">Explorador</span>
        {isAdmin && (
          <button
            title="Nueva área"
            onClick={() => setShowNewArea(true)}
            className="h-5 w-5 rounded flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">

        {/* Review queue — managers only */}
        {isGerente && (
          <button
            onClick={onOpenQueue}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors group",
              activeKey === "queue"
                ? "bg-zinc-800/60 text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300",
            )}
          >
            <Inbox className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[12px] flex-1">Cola de revisión</span>
            {pendingCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold tabular-nums border border-amber-500/30">
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {isGerente && areas.length > 0 && (
          <div className="mx-3 my-1.5 h-px bg-zinc-800/60" />
        )}

        {/* Section label */}
        {areas.length > 0 && (
          <div className="px-3 pt-1 pb-0.5">
            <span className="text-[9px] text-zinc-700 font-mono uppercase tracking-widest">Áreas</span>
          </div>
        )}

        {/* Area tree */}
        {areas.length === 0 && (
          <div className="px-4 py-4 text-[11px] text-zinc-700 italic">
            {isAdmin ? "Crea un área con +" : "Sin áreas configuradas"}
          </div>
        )}

        {areas.map((area) => (
          <AreaNode
            key={area.id}
            area={area}
            expanded={expandedAreas.has(area.id)}
            expandedProcs={expandedProcs}
            activeKey={activeKey}
            onToggleArea={() => toggleArea(area.id)}
            onToggleProc={toggleProc}
            onSelectProcedure={onSelectProcedure}
            onSelectCommit={onSelectCommit}
            isManager={isManager}
          />
        ))}
      </div>

      {/* New area form */}
      {showNewArea && isAdmin && (
        <div className="border-t border-zinc-800 bg-[#0d0d0f] p-3 shrink-0">
          <p className="text-[10px] text-zinc-500 font-mono mb-2 uppercase tracking-widest">Nueva área</p>

          <input
            autoFocus
            value={newAreaForm.nombre}
            onChange={(e) => setNewAreaForm((f) => ({ ...f, nombre: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newAreaForm.nombre.trim()) createArea.mutate(newAreaForm)
              if (e.key === "Escape") { setShowNewArea(false); setFormError(null) }
            }}
            className="w-full bg-[#0a0a0b] border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-700 mb-2"
            placeholder="Nombre del área"
          />

          {/* Color palette */}
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewAreaForm((f) => ({ ...f, color: c }))}
                className="h-4 w-4 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: newAreaForm.color === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>

          {formError && <p className="text-[10px] text-red-400 font-mono mb-2">{formError}</p>}

          <div className="flex gap-1.5">
            <button
              onClick={() => { setShowNewArea(false); setFormError(null) }}
              className="flex-1 text-[10px] py-1.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors font-mono"
            >
              Cancelar
            </button>
            <button
              disabled={!newAreaForm.nombre.trim() || createArea.isPending}
              onClick={() => createArea.mutate(newAreaForm)}
              className="flex-1 text-[10px] py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 disabled:opacity-40 transition-colors font-mono"
            >
              Crear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Area Node ──────────────────────────────────────────────────────────────────

function AreaNode({
  area, expanded, expandedProcs, activeKey,
  onToggleArea, onToggleProc, onSelectProcedure, onSelectCommit, isManager,
}: {
  area: SigArea
  expanded: boolean
  expandedProcs: Set<number>
  activeKey: string | null
  onToggleArea: () => void
  onToggleProc: (id: number) => void
  onSelectProcedure: (id: number, info: ProcedureOpenInfo) => void
  onSelectCommit: (id: number, info: CommitOpenInfo) => void
  isManager: boolean
}) {
  const { data: procs = [] } = useQuery<SigProcedimiento[]>({
    queryKey: ["sig", "procs-by-area", area.id],
    queryFn: async () => (await sigApi.get(`/api/procedimientos?areaId=${area.id}`)).data,
    enabled: expanded,
  })

  return (
    <div>
      {/* Area row */}
      <button
        onClick={onToggleArea}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-zinc-800/40 transition-colors group"
      >
        <span className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        {expanded
          ? <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: area.color }} />
          : <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: area.color }} />
        }
        <span className="text-[12px] text-zinc-300 flex-1 truncate">{area.nombre}</span>
        <span className="text-[10px] text-zinc-700 font-mono tabular-nums pr-1">
          {area._count.procedimientos}
        </span>
      </button>

      {/* Procedures */}
      {expanded && (
        <div className="pl-5">
          {procs.length === 0 && (
            <div className="px-3 py-1 text-[11px] text-zinc-700 italic">Sin procedimientos</div>
          )}
          {procs.map((proc) => (
            <ProcNode
              key={proc.id}
              proc={proc}
              area={area}
              expanded={expandedProcs.has(proc.id)}
              activeKey={activeKey}
              onToggle={() => onToggleProc(proc.id)}
              onSelect={() =>
                onSelectProcedure(proc.id, {
                  codigo: proc.codigo,
                  titulo: proc.titulo,
                  areaColor: area.color,
                  areaNombre: area.nombre,
                })
              }
              onSelectCommit={onSelectCommit}
              isManager={isManager}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Procedure Node ─────────────────────────────────────────────────────────────

const ESTADO_DOT: Record<string, string> = {
  BORRADOR: "text-zinc-600",
  VIGENTE:  "text-emerald-500",
  OBSOLETO: "text-zinc-700",
}

function ProcNode({
  proc, expanded, activeKey, onToggle, onSelect, onSelectCommit,
}: {
  proc: SigProcedimiento
  area?: SigArea
  expanded: boolean
  activeKey: string | null
  onToggle: () => void
  onSelect: () => void
  onSelectCommit: (id: number, info: CommitOpenInfo) => void
  isManager?: boolean
}) {
  const isActive = activeKey === `proc-${proc.id}`

  const { data: commits = [] } = useQuery<SigCommit[]>({
    queryKey: ["sig", "commits-by-proc", proc.id],
    queryFn: async () => {
      const res = await sigApi.get(`/api/commits?procedimientoId=${proc.id}`)
      return res.data
    },
    enabled: expanded,
  })

  return (
    <div>
      <div className={cn(
        "flex items-center group rounded transition-colors",
        isActive ? "bg-zinc-800/60" : "hover:bg-zinc-800/30",
      )}>
        {/* Expand toggle for commits */}
        <button
          onClick={onToggle}
          className="h-6 w-5 flex items-center justify-center text-zinc-700 hover:text-zinc-500 shrink-0 transition-colors"
        >
          {expanded
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />
          }
        </button>

        {/* File row — click to open procedure */}
        <button
          onClick={onSelect}
          className="flex items-center gap-1.5 flex-1 min-w-0 py-1 pr-2 text-left"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
          <span className={cn(
            "text-[12px] font-mono flex-1 truncate transition-colors",
            isActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-300",
          )}>
            {proc.codigo}
          </span>
          <Circle
            className={cn("h-2 w-2 shrink-0 fill-current", ESTADO_DOT[proc.estado])}
          />
        </button>
      </div>

      {/* Commits */}
      {expanded && (
        <div className="pl-5">
          {commits.length === 0 && (
            <div className="px-3 py-1 text-[11px] text-zinc-700 italic">Sin commits</div>
          )}
          {commits.map((c) => (
            <CommitNode
              key={c.id}
              commit={c}
              procCodigo={proc.codigo}
              activeKey={activeKey}
              onSelect={() => onSelectCommit(c.id, { mensaje: c.mensaje, codigo: proc.codigo })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Commit Node ────────────────────────────────────────────────────────────────

const COMMIT_DOT: Record<string, string> = {
  PENDIENTE_REVISION: "text-amber-500 animate-pulse",
  APROBADO:           "text-emerald-500",
  RECHAZADO:          "text-red-500",
}

function CommitNode({
  commit, activeKey, onSelect,
}: {
  commit: SigCommit
  procCodigo?: string
  activeKey: string | null
  onSelect: () => void
}) {
  const isActive = activeKey === `commit-${commit.id}`

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-1.5 py-1 px-2 text-left rounded transition-colors group",
        isActive ? "bg-zinc-800/60" : "hover:bg-zinc-800/30",
      )}
    >
      <GitCommit className="h-3 w-3 shrink-0 text-zinc-700" />
      <span className={cn(
        "text-[11px] font-mono flex-1 truncate",
        isActive ? "text-zinc-300" : "text-zinc-600 group-hover:text-zinc-500",
      )}>
        #{String(commit.id).padStart(4, "0")}
      </span>
      <Circle className={cn("h-1.5 w-1.5 shrink-0 fill-current", COMMIT_DOT[commit.estado])} />
    </button>
  )
}
