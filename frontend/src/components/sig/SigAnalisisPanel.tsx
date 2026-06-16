import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { useSigAnalisisStore, type AnalysisType } from "@/store/sigAnalisisStore"
import {
  Search, SlidersHorizontal, FileText,
  Target, Lightbulb, GitCompare, Database, Loader,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcListItem {
  id:     number
  codigo: string
  titulo: string
  estado: string
  area:   { id: number; nombre: string; color: string }
  _count: { commits: number }
}

interface SigArea {
  id:     number
  nombre: string
  color:  string
}

interface ProcSyncData {
  latestApproved: { contenidoAgente: string } | null
}

interface Instructivo {
  id:       number
  codigo:   string
  titulo:   string
  contenido: string
}

interface ProcSummary {
  id:     number
  codigo: string
  titulo: string
}

// ── Netvault polling ──────────────────────────────────────────────────────────

async function pollNetvaultJob(jobId: string): Promise<unknown> {
  for (let i = 0; i < 120; i++) {
    await new Promise<void>((r) => setTimeout(r, 2500))
    const { data } = await api.get(`/api/netvault/job/${jobId}`)
    if (data.status === "done")  return data.result
    if (data.status === "error") throw new Error(data.error ?? "El análisis falló en netvault")
  }
  throw new Error("Tiempo de espera agotado (5 min)")
}

// ── useRunAnalysis ────────────────────────────────────────────────────────────

export function useRunAnalysis() {
  const { addJob, updateJob } = useSigAnalisisStore()
  const qc = useQueryClient()

  const runAnalysis = useCallback(async (
    proc:        ProcSummary,
    type:        AnalysisType,
    textContent: string,
    instructivos?: Instructivo[],
  ) => {
    const localId = addJob({
      procedimientoId: proc.id,
      procedureCodigo: proc.codigo,
      procedureTitulo: proc.titulo,
      type,
    })

    try {
      let netvaultRes: { jobId: string }

      if (type === "coherencia") {
        netvaultRes = (await api.post("/api/netvault/analizar-coherencia", { textContent })).data
      } else if (type === "mejoras") {
        netvaultRes = (await api.post("/api/netvault/analizar-mejoras", { textContent })).data
      } else if (type === "proc-vs-inst") {
        const instText = (instructivos ?? [])
          .map((i) => `# ${i.codigo} — ${i.titulo}\n\n${i.contenido}`)
          .join("\n\n---\n\n")
        netvaultRes = (await api.post("/api/netvault/analizar-proc-vs-inst", {
          textContent, instructivosText: instText,
        })).data
      } else {
        netvaultRes = (await api.post("/api/netvault/indexar-lightrag", {
          textContent, codigo: proc.codigo, titulo: proc.titulo,
        })).data
      }

      updateJob(localId, { netvaultJobId: netvaultRes.jobId })
      const result = await pollNetvaultJob(netvaultRes.jobId)

      if (type !== "lightrag") {
        const endpoint =
          type === "coherencia" ? "/api/analisis/coherencia" :
          type === "mejoras"    ? "/api/analisis/mejoras"    :
                                  "/api/analisis/proc-vs-inst"
        await sigApi.post(endpoint, {
          procedimientoId: proc.id,
          ...(result as Record<string, unknown>),
        })
      }

      updateJob(localId, { status: "done", result, completedAt: Date.now() })
      qc.invalidateQueries({ queryKey: ["sig", "analisis", proc.id] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      updateJob(localId, { status: "error", error: msg, completedAt: Date.now() })
    }
  }, [addJob, updateJob, qc])

  return runAnalysis
}

// ── Analysis type config ──────────────────────────────────────────────────────

const ANALYSIS_TYPES: Array<{
  type:  AnalysisType
  label: string
  icon:  React.ReactNode
  color: string
}> = [
  { type: "coherencia",    label: "Coherencia",  icon: <Target    className="h-3 w-3" />, color: "text-blue-600   border-blue-200   bg-blue-50   hover:bg-blue-100" },
  { type: "mejoras",       label: "Mejoras",     icon: <Lightbulb className="h-3 w-3" />, color: "text-amber-600  border-amber-200  bg-amber-50  hover:bg-amber-100" },
  { type: "proc-vs-inst",  label: "Proc/Inst",   icon: <GitCompare className="h-3 w-3" />, color: "text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100" },
  { type: "lightrag",      label: "LightRAG",    icon: <Database  className="h-3 w-3" />, color: "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" },
]

// ── Main component ────────────────────────────────────────────────────────────

export function SigAnalisisPanel() {
  const [areaFilter, setAreaFilter] = useState<number | null>(null)
  const [searchQ,    setSearchQ]    = useState("")

  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn:  () => sigApi.get("/api/areas").then((r) => r.data),
  })

  const { data: allProcs = [], isLoading } = useQuery<ProcListItem[]>({
    queryKey: ["sig", "procedimientos-analisis", areaFilter],
    queryFn:  () =>
      sigApi.get("/api/procedimientos", {
        params: areaFilter ? { areaId: areaFilter } : {},
      }).then((r) => r.data),
  })

  const procedures = allProcs.filter(
    (p) =>
      p._count.commits > 0 &&
      (!searchQ ||
        p.codigo.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.titulo.toLowerCase().includes(searchQ.toLowerCase())),
  )

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">

      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-zinc-200 bg-white">
        <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          <AreaChip label="Todas" active={areaFilter === null} onClick={() => setAreaFilter(null)} />
          {areas.map((a) => (
            <AreaChip
              key={a.id}
              label={a.nombre}
              color={a.color}
              active={areaFilter === a.id}
              onClick={() => setAreaFilter(a.id)}
            />
          ))}
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Buscar procedimiento…"
            className="h-7 pl-7 pr-3 text-[11px] font-mono border border-zinc-200 rounded bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-helix-accent text-zinc-700 w-52"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 py-10 justify-center">
            <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
            <span className="text-xs font-mono">Cargando procedimientos…</span>
          </div>
        )}

        {!isLoading && procedures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="h-8 w-8 text-zinc-300" />
            <div className="text-center">
              <p className="text-sm font-mono text-zinc-500">Sin procedimientos commiteados</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Solo aparecen procedimientos con al menos un commit desde NetVault.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 max-w-3xl mx-auto">
          {procedures.map((proc) => (
            <ProcAnalisisCard key={proc.id} proc={proc} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Area chip ─────────────────────────────────────────────────────────────────

function AreaChip({
  label, color, active, onClick,
}: { label: string; color?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono transition-all border",
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700",
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {label}
    </button>
  )
}

// ── Per-procedure card ────────────────────────────────────────────────────────

function ProcAnalisisCard({ proc }: { proc: ProcListItem }) {
  const runAnalysis  = useRunAnalysis()
  const openInspector = useSigAnalisisStore((s) => s.openInspector)
  const jobs         = useSigAnalisisStore((s) => s.jobs)
  const [loading, setLoading] = useState<AnalysisType | "all" | null>(null)

  async function fetchContent(): Promise<{ text: string; instructivos: Instructivo[] } | null> {
    const syncData: ProcSyncData = (await sigApi.get(`/api/procedimientos/${proc.id}/sync`)).data
    const text = syncData.latestApproved?.contenidoAgente ?? null
    if (!text) return null
    const instructivos: Instructivo[] = (await sigApi.get(`/api/instructivos?procedimientoId=${proc.id}&activo=true`)).data
    return { text, instructivos }
  }

  async function handleRunType(type: AnalysisType) {
    if (loading) return
    setLoading(type)
    try {
      const content = await fetchContent()
      if (!content) return
      const { text, instructivos } = content
      const summary: ProcSummary = { id: proc.id, codigo: proc.codigo, titulo: proc.titulo }
      void runAnalysis(summary, type, text, type === "proc-vs-inst" ? instructivos : undefined)
    } finally {
      setLoading(null)
    }
  }

  async function handleRunAll() {
    if (loading) return
    setLoading("all")
    try {
      const content = await fetchContent()
      if (!content) return
      const { text, instructivos } = content
      const summary: ProcSummary = { id: proc.id, codigo: proc.codigo, titulo: proc.titulo }
      void runAnalysis(summary, "coherencia", text)
      void runAnalysis(summary, "mejoras", text)
      if (instructivos.length > 0) void runAnalysis(summary, "proc-vs-inst", text, instructivos)
      void runAnalysis(summary, "lightrag", text)
    } finally {
      setLoading(null)
    }
  }

  function isTypeRunning(type: AnalysisType) {
    return jobs.some((j) => j.procedimientoId === proc.id && j.type === type && j.status === "running")
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-all group">

      {/* Top row: info */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="h-9 w-0.5 rounded-full shrink-0" style={{ backgroundColor: proc.area.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-semibold text-zinc-700">{proc.codigo}</span>
            <span className="text-[10px] text-zinc-400">{proc.area.nombre}</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded border font-mono ml-auto",
              proc.estado === "VIGENTE"  ? "text-emerald-600 border-emerald-200 bg-emerald-50" :
              proc.estado === "OBSOLETO" ? "text-zinc-400 border-zinc-200 bg-zinc-50" :
                                           "text-zinc-500 border-zinc-300 bg-zinc-100",
            )}>{proc.estado.toLowerCase()}</span>
          </div>
          <p className="text-[12px] text-zinc-500 truncate mt-0.5">{proc.titulo}</p>
        </div>
      </div>

      {/* Bottom row: analysis chips + actions */}
      <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">

        {/* 4 individual analysis type chips */}
        {ANALYSIS_TYPES.map(({ type, label, icon, color }) => {
          const running = isTypeRunning(type) || (loading === type)
          return (
            <button
              key={type}
              onClick={() => handleRunType(type)}
              disabled={!!loading}
              title={`Ejecutar análisis de ${label}`}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all",
                color,
                loading && !running ? "opacity-50 cursor-not-allowed" : "",
              )}
            >
              {running
                ? <Loader className="h-2.5 w-2.5 animate-spin" />
                : icon
              }
              {label}
            </button>
          )
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Analizar todo */}
        <button
          onClick={handleRunAll}
          disabled={!!loading}
          className={cn(
            "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border font-mono transition-colors",
            loading === "all"
              ? "border-zinc-300 text-zinc-400"
              : "border-zinc-200 text-zinc-500 hover:border-violet-300 hover:text-violet-600",
          )}
        >
          {loading === "all"
            ? <><Loader className="h-2.5 w-2.5 animate-spin" /> Iniciando…</>
            : "Analizar todo"
          }
        </button>

        {/* Ver análisis — abre inspector flotante */}
        <button
          onClick={() => openInspector(proc.id)}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 font-mono transition-colors"
        >
          Ver análisis ↗
        </button>
      </div>
    </div>
  )
}
