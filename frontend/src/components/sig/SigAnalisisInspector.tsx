import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { useSigAnalisisStore, type AnalysisType } from "@/store/sigAnalisisStore"
import { useRunAnalysis } from "./SigAnalisisPanel"
import {
  X, Minus, Target, Lightbulb, GitCompare, Database,
  Loader, CheckCircle2, AlertTriangle, ChevronDown,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcMeta {
  id:     number
  codigo: string
  titulo: string
}

interface AnalisisResult {
  id:          number
  tipo:        string
  createdAt:   string
  resumen:     string
  coherente?:  boolean
  puntaje?:    number | null
  issues?:     Array<{ tipo: string; descripcion: string; severidad: string }>
  proposals?:  Array<{ descripcion: string; categoria?: string }>
  conflictos?: Array<{ instructivoCodigo: string; descripcion: string; severidad: string }>
}

interface ProcSyncData {
  latestApproved: { contenidoAgente: string } | null
}

interface Instructivo {
  id: number; codigo: string; titulo: string; contenido: string
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS: Array<{
  type:  AnalysisType
  label: string
  icon:  React.ReactNode
  color: string
  dot:   string
}> = [
  {
    type:  "coherencia",
    label: "Coherencia",
    icon:  <Target    className="h-3 w-3" />,
    color: "text-blue-600 border-blue-200",
    dot:   "bg-blue-400",
  },
  {
    type:  "mejoras",
    label: "Mejoras",
    icon:  <Lightbulb className="h-3 w-3" />,
    color: "text-amber-600 border-amber-200",
    dot:   "bg-amber-400",
  },
  {
    type:  "proc-vs-inst",
    label: "Proc/Inst",
    icon:  <GitCompare className="h-3 w-3" />,
    color: "text-violet-600 border-violet-200",
    dot:   "bg-violet-400",
  },
  {
    type:  "lightrag",
    label: "LightRAG",
    icon:  <Database  className="h-3 w-3" />,
    color: "text-emerald-600 border-emerald-200",
    dot:   "bg-emerald-400",
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export function SigAnalisisInspector() {
  const { inspectorProcId, inspectorMinimized, closeInspector, setInspectorMinimized } =
    useSigAnalisisStore()

  const [activeTab, setActiveTab] = useState<AnalysisType>("coherencia")

  if (inspectorProcId === null) return null

  return (
    <div
      className={cn(
        "absolute bottom-6 z-40 w-[340px] rounded-xl border border-zinc-200 shadow-2xl shadow-zinc-900/20 overflow-hidden bg-white transition-all duration-200",
        "left-[216px] xl:left-[264px]",
      )}
    >
      {/* Header */}
      <InspectorHeader
        procId={inspectorProcId}
        minimized={inspectorMinimized}
        onMinimize={() => setInspectorMinimized(!inspectorMinimized)}
        onClose={closeInspector}
      />

      {/* Body */}
      {!inspectorMinimized && (
        <InspectorBody procId={inspectorProcId} activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

function InspectorHeader({
  procId, minimized, onMinimize, onClose,
}: {
  procId:     number
  minimized:  boolean
  onMinimize: () => void
  onClose:    () => void
}) {
  const { data: proc } = useQuery<ProcMeta>({
    queryKey: ["sig", "proc-meta", procId],
    queryFn:  () => sigApi.get(`/api/procedimientos/${procId}`).then((r) => ({
      id: r.data.id, codigo: r.data.codigo, titulo: r.data.titulo,
    })),
  })

  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 bg-zinc-900 cursor-pointer select-none"
      onClick={onMinimize}
    >
      <Target className="h-3 w-3 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-mono text-white font-semibold truncate block">
          {proc?.codigo ?? `Proc #${procId}`}
        </span>
        {proc?.titulo && (
          <span className="text-[9px] text-zinc-400 font-mono truncate block mt-0.5">
            {proc.titulo}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onMinimize() }}
          className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          {minimized
            ? <ChevronDown className="h-3 w-3 rotate-180" />
            : <Minus className="h-3 w-3" />
          }
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── Body ──────────────────────────────────────────────────────────────────────

function InspectorBody({
  procId, activeTab, onTabChange,
}: {
  procId:       number
  activeTab:    AnalysisType
  onTabChange:  (t: AnalysisType) => void
}) {
  const { data: historial = [] } = useQuery<AnalisisResult[]>({
    queryKey: ["sig", "analisis", procId],
    queryFn:  () =>
      sigApi.get("/api/analisis/historial", {
        params: { procedimientoId: procId, limit: 50 },
      }).then((r) => r.data),
    refetchInterval: 10_000,
  })

  const latestByType: Partial<Record<AnalysisType, AnalisisResult>> = {}
  for (const item of historial) {
    const t = item.tipo as AnalysisType
    if (!latestByType[t]) latestByType[t] = item
  }

  const jobs = useSigAnalisisStore((s) => s.jobs)

  return (
    <>
      {/* Tab row */}
      <div className="flex border-b border-zinc-200 bg-zinc-50">
        {TABS.map((tab) => {
          const isActive  = activeTab === tab.type
          const running   = jobs.some((j) => j.procedimientoId === procId && j.type === tab.type && j.status === "running")
          const hasResult = !!latestByType[tab.type]
          return (
            <button
              key={tab.type}
              onClick={() => onTabChange(tab.type)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-mono transition-colors border-r last:border-r-0 border-zinc-200",
                isActive
                  ? "bg-white text-zinc-800 shadow-[inset_0_-1px_0_0_white]"
                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100",
              )}
            >
              <div className="relative">
                {tab.icon}
                {running && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                )}
                {!running && hasResult && (
                  <span className={cn("absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full", tab.dot)} />
                )}
              </div>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="h-[300px] overflow-y-auto">
        <AnalysisTabContent
          procId={procId}
          type={activeTab}
          result={latestByType[activeTab] ?? null}
        />
      </div>
    </>
  )
}

// ── Tab content ───────────────────────────────────────────────────────────────

function AnalysisTabContent({
  procId, type, result,
}: {
  procId: number
  type:   AnalysisType
  result: AnalisisResult | null
}) {
  const runAnalysis = useRunAnalysis()
  const jobs        = useSigAnalisisStore((s) => s.jobs)
  const [loading, setLoading] = useState(false)

  const isRunning = jobs.some((j) => j.procedimientoId === procId && j.type === type && j.status === "running")

  async function handleAnalyze() {
    if (loading || isRunning) return
    setLoading(true)
    try {
      const syncData: ProcSyncData = (await sigApi.get(`/api/procedimientos/${procId}/sync`)).data
      const text = syncData.latestApproved?.contenidoAgente
      if (!text) return

      const procMeta = (await sigApi.get(`/api/procedimientos/${procId}`)).data as ProcMeta & { codigo: string; titulo: string }
      let instructivos: Instructivo[] = []
      if (type === "proc-vs-inst") {
        instructivos = (await sigApi.get(`/api/instructivos?procedimientoId=${procId}&activo=true`)).data
      }
      void runAnalysis(
        { id: procId, codigo: procMeta.codigo, titulo: procMeta.titulo },
        type,
        text,
        instructivos.length > 0 ? instructivos : undefined,
      )
    } finally {
      setLoading(false)
    }
  }

  const tab = TABS.find((t) => t.type === type)!

  return (
    <div className="flex flex-col h-full">
      {/* Analyze button */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-100 bg-zinc-50/50">
        <span className={cn("flex items-center gap-1 text-[10px] font-mono", tab.color)}>
          {tab.icon}
          {tab.label}
        </span>
        <button
          onClick={handleAnalyze}
          disabled={isRunning || loading}
          className={cn(
            "flex items-center gap-1 text-[10px] px-2.5 py-1 rounded border font-mono transition-colors",
            isRunning || loading
              ? "border-zinc-200 text-zinc-400 cursor-not-allowed"
              : "border-violet-200 text-violet-600 hover:bg-violet-50",
          )}
        >
          {isRunning || loading
            ? <><Loader className="h-2.5 w-2.5 animate-spin" /> Analizando…</>
            : "Analizar"
          }
        </button>
      </div>

      {/* Result area */}
      <div className="flex-1 overflow-y-auto p-3">
        {isRunning && !result && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
            <Loader className="h-4 w-4 animate-spin text-violet-400" />
            <span className="text-[11px] font-mono">Analizando…</span>
          </div>
        )}

        {!isRunning && !result && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400 text-center">
            <div className={cn("opacity-30", tab.color)}>{tab.icon}</div>
            <span className="text-[11px] font-mono text-zinc-400">
              Sin análisis aún.
            </span>
            <span className="text-[10px] text-zinc-300 font-mono">
              Pulsa "Analizar" para ejecutar.
            </span>
          </div>
        )}

        {result && <ResultView type={type} result={result} />}
      </div>
    </div>
  )
}

// ── Result renders ────────────────────────────────────────────────────────────

function ResultView({ type, result }: { type: AnalysisType; result: AnalisisResult }) {
  const date = new Date(result.createdAt).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
  })

  return (
    <div className="space-y-3">
      {/* Timestamp */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-zinc-400">Último análisis</span>
        <span className="text-[9px] font-mono text-zinc-400">{date}</span>
      </div>

      {type === "coherencia" && (
        <CoherenciaResult result={result} />
      )}
      {type === "mejoras" && (
        <MejorasResult result={result} />
      )}
      {type === "proc-vs-inst" && (
        <ProcVsInstResult result={result} />
      )}
      {type === "lightrag" && (
        <LightRAGResult result={result} />
      )}

      {/* Resumen */}
      {result.resumen && (
        <div className="mt-2 pt-2 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">{result.resumen}</p>
        </div>
      )}
    </div>
  )
}

function CoherenciaResult({ result }: { result: AnalisisResult }) {
  const score = result.puntaje != null ? Math.round(result.puntaje * 100) : null
  const scoreColor =
    score == null  ? "text-zinc-400" :
    score >= 80    ? "text-emerald-600" :
    score >= 60    ? "text-amber-600"   : "text-red-600"
  const issues = result.issues ?? []

  return (
    <div className="space-y-2.5">
      {/* Score */}
      <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2.5 border border-zinc-100">
        <div className="flex items-center gap-1.5">
          {result.coherente
            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          }
          <span className="text-[11px] font-mono text-zinc-600">
            {result.coherente ? "Coherente" : "Con problemas"}
          </span>
        </div>
        {score != null && (
          <span className={cn("text-[18px] font-mono font-bold tabular-nums", scoreColor)}>
            {score}<span className="text-[10px] font-normal text-zinc-400">/100</span>
          </span>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div>
          <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
            Hallazgos ({issues.length})
          </p>
          <div className="space-y-1">
            {issues.slice(0, 5).map((issue, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px]">
                <span className={cn(
                  "shrink-0 mt-0.5 px-1 py-0.5 rounded text-[8px] font-mono font-semibold",
                  issue.severidad === "ALTA"   ? "bg-red-100 text-red-600" :
                  issue.severidad === "MEDIA"  ? "bg-amber-100 text-amber-600" :
                                                  "bg-zinc-100 text-zinc-500",
                )}>
                  {issue.severidad}
                </span>
                <span className="text-zinc-600 leading-tight">{issue.descripcion}</span>
              </div>
            ))}
            {issues.length > 5 && (
              <p className="text-[9px] text-zinc-400 font-mono">+{issues.length - 5} más…</p>
            )}
          </div>
        </div>
      )}

      {issues.length === 0 && (
        <p className="text-[10px] text-emerald-600 font-mono">Sin hallazgos — procedimiento coherente.</p>
      )}
    </div>
  )
}

function MejorasResult({ result }: { result: AnalisisResult }) {
  const proposals = result.proposals ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-600">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-semibold">{proposals.length}</span>
        <span>propuesta{proposals.length !== 1 ? "s" : ""} de mejora</span>
      </div>
      {proposals.length === 0 && (
        <p className="text-[10px] text-zinc-400 font-mono">Sin propuestas identificadas.</p>
      )}
      <div className="space-y-1.5">
        {proposals.slice(0, 6).map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-[10px]">
            <span className="shrink-0 font-mono text-amber-500 font-bold mt-0.5">{i + 1}.</span>
            <div>
              <span className="text-zinc-600 leading-tight">{p.descripcion}</span>
              {p.categoria && (
                <span className="ml-1.5 text-[9px] text-zinc-400 font-mono">({p.categoria})</span>
              )}
            </div>
          </div>
        ))}
        {proposals.length > 6 && (
          <p className="text-[9px] text-zinc-400 font-mono">+{proposals.length - 6} más…</p>
        )}
      </div>
    </div>
  )
}

function ProcVsInstResult({ result }: { result: AnalisisResult }) {
  const conflictos = result.conflictos ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
        {result.coherente
          ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> <span className="text-[11px] font-mono text-emerald-600">Alineado con instructivos</span></>
          : <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> <span className="text-[11px] font-mono text-amber-600">{conflictos.length} conflicto{conflictos.length !== 1 ? "s" : ""}</span></>
        }
      </div>
      {conflictos.length === 0 && result.coherente && (
        <p className="text-[10px] text-emerald-600 font-mono">Sin conflictos detectados.</p>
      )}
      <div className="space-y-1.5">
        {conflictos.slice(0, 5).map((c, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            <span className={cn(
              "shrink-0 mt-0.5 px-1 py-0.5 rounded text-[8px] font-mono font-semibold",
              c.severidad === "ALTA"   ? "bg-red-100 text-red-600" :
              c.severidad === "MEDIA"  ? "bg-amber-100 text-amber-600" :
                                          "bg-zinc-100 text-zinc-500",
            )}>
              {c.severidad}
            </span>
            <div>
              <span className="text-violet-600 font-mono text-[9px]">{c.instructivoCodigo}</span>
              <span className="text-zinc-600 ml-1">— {c.descripcion}</span>
            </div>
          </div>
        ))}
        {conflictos.length > 5 && (
          <p className="text-[9px] text-zinc-400 font-mono">+{conflictos.length - 5} más…</p>
        )}
      </div>
    </div>
  )
}

function LightRAGResult({ result }: { result: AnalisisResult }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      <div>
        <p className="text-[11px] font-mono text-zinc-600 font-semibold">Indexado en LightRAG</p>
        <p className="text-[10px] text-zinc-400 font-mono mt-1">
          {result.resumen || "El procedimiento fue indexado correctamente en el grafo de conocimiento."}
        </p>
      </div>
    </div>
  )
}
