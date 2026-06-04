import { ReactNode, useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"

interface SigArea {
  id: number
  nombre: string
  color: string
  _count: { procedimientos: number }
}

interface SigProcedimiento {
  id: number
  codigo: string
  titulo: string
  estado: "BORRADOR" | "VIGENTE" | "OBSOLETO"
}

interface Props {
  children: ReactNode
  isGerente: boolean
}

const ESTADO_BADGE: Record<string, string> = {
  BORRADOR:  "bg-zinc-700/40 text-zinc-400 border-zinc-600/40",
  VIGENTE:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  OBSOLETO:  "bg-zinc-600/20 text-zinc-500 border-zinc-600/30",
}

export function SigShell({ children, isGerente }: Props) {
  const navigate = useNavigate()
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set())
  const [sidebarW, setSidebarW] = useState(260)

  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn: async () => (await sigApi.get("/api/areas")).data,
  })

  const { data: pendientes = [] } = useQuery<unknown[]>({
    queryKey: ["sig", "commits", "pendientes"],
    queryFn: async () => (await sigApi.get("/api/commits/pendientes")).data,
    enabled: isGerente,
    refetchInterval: 30_000,
  })

  function toggleArea(id: number) {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top bar */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 font-mono">SIG</span>
          <span className="text-xs text-zinc-600">Sistema Integrado de Gestión</span>
        </div>
        <div className="flex items-center gap-3">
          {isGerente && pendientes.length > 0 && (
            <NavLink
              to="/sig/revision"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
            </NavLink>
          )}
          <NavLink
            to="/sig"
            end
            className={({ isActive }) =>
              cn("text-xs px-2 py-1 rounded transition-colors",
                isActive ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              )
            }
          >
            Áreas
          </NavLink>
          {isGerente && (
            <NavLink
              to="/sig/revision"
              className={({ isActive }) =>
                cn("text-xs px-2 py-1 rounded transition-colors",
                  isActive ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                )
              }
            >
              Revisión
            </NavLink>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — árbol de áreas y procedimientos */}
        <div
          className="flex flex-col border-r border-zinc-800 bg-zinc-900/60 shrink-0 overflow-y-auto"
          style={{ width: sidebarW }}
        >
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">Procedimientos</p>
          </div>

          {areas.length === 0 && (
            <div className="px-4 py-3 text-xs text-zinc-600 italic">
              Sin áreas. Crea una desde Configuración.
            </div>
          )}

          {areas.map((area) => (
            <AreaNode
              key={area.id}
              area={area}
              expanded={expandedAreas.has(area.id)}
              onToggle={() => toggleArea(area.id)}
              onSelectProcedimiento={(id) => navigate(`/sig/procedimientos/${id}`)}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto bg-zinc-950">
          {children}
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 flex items-center px-4 gap-4 border-t border-zinc-800 bg-zinc-900/80 shrink-0">
        <span className="text-[10px] text-zinc-600 font-mono">
          {areas.length} área{areas.length !== 1 ? "s" : ""}
          {" · "}
          {areas.reduce((s, a) => s + a._count.procedimientos, 0)} procedimientos
        </span>
        {isGerente && pendientes.length > 0 && (
          <span className="text-[10px] text-amber-500 font-mono">
            ● {pendientes.length} commit{pendientes.length !== 1 ? "s" : ""} pendiente{pendientes.length !== 1 ? "s" : ""} de revisión
          </span>
        )}
      </div>
    </div>
  )
}

// ── AreaNode ──────────────────────────────────────────────────────────────────

function AreaNode({
  area, expanded, onToggle, onSelectProcedimiento,
}: {
  area: SigArea
  expanded: boolean
  onToggle: () => void
  onSelectProcedimiento: (id: number) => void
}) {
  const { data: procs = [] } = useQuery<SigProcedimiento[]>({
    queryKey: ["sig", "procs-by-area", area.id],
    queryFn: async () => (await sigApi.get(`/api/procedimientos?areaId=${area.id}`)).data,
    enabled: expanded,
  })

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800/50 transition-colors group"
      >
        <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 transition-colors w-3">
          {expanded ? "▾" : "▸"}
        </span>
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: area.color }}
        />
        <span className="text-xs text-zinc-300 font-medium truncate flex-1">{area.nombre}</span>
        <span className="text-[10px] text-zinc-600 tabular-nums">{area._count.procedimientos}</span>
      </button>

      {expanded && (
        <div className="pl-6">
          {procs.length === 0 && (
            <div className="px-3 py-1 text-[11px] text-zinc-700 italic">Sin procedimientos</div>
          )}
          {procs.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectProcedimiento(p.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-zinc-800/40 transition-colors group"
            >
              <span className="text-[10px] text-zinc-700">📄</span>
              <span className="text-xs text-zinc-400 font-mono truncate flex-1">{p.codigo}</span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded border shrink-0",
                ESTADO_BADGE[p.estado]
              )}>
                {p.estado === "VIGENTE" ? "V" : p.estado === "BORRADOR" ? "B" : "O"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
