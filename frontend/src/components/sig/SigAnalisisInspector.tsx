import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { useSigAnalisisStore, type AnalysisType } from "@/store/sigAnalisisStore"
import { useRunAnalysis, cancelAnalysisJob } from "./SigAnalisisPanel"
import {
  X, Minus, Target, Database,
  Loader, CheckCircle2, ChevronDown,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcMeta {
  id:         number
  codigo:     string
  titulo:     string
  areaNombre: string
}

interface AnalisisResult {
  id:                number
  tipo:              string
  createdAt:         string
  resumen:           string
}

interface ProcSyncData {
  latestApproved: { contenidoAgente: string; flujogramaMmd?: string | null } | null
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

  const [activeTab, setActiveTab] = useState<AnalysisType>("lightrag")

  if (inspectorProcId === null) return null

  return (
    <div
      className={cn(
        "absolute bottom-6 z-40 w-[520px] rounded-xl border border-zinc-200 shadow-2xl shadow-zinc-900/20 overflow-hidden bg-white transition-all duration-200",
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
      areaNombre: (r.data.area?.nombre as string | undefined) ?? "",
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
          <span className="text-[11px] text-zinc-400 font-mono truncate block mt-0.5">
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
                "flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-mono transition-colors border-r last:border-r-0 border-zinc-200",
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
      <div className="h-[460px] overflow-y-auto">
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
  const runningJob = jobs.find((j) => j.procedimientoId === procId && j.type === type && j.status === "running")

  async function handleAnalyze() {
    if (loading || isRunning) return
    setLoading(true)
    try {
      const syncData: ProcSyncData = (await sigApi.get(`/api/procedimientos/${procId}/sync`)).data
      const contenido = syncData.latestApproved?.contenidoAgente
      if (!contenido) return
      const flujograma = syncData.latestApproved?.flujogramaMmd
      const text = flujograma
        ? `${contenido}\n\n## Flujograma del Proceso (Mermaid)\n\n\`\`\`mermaid\n${flujograma}\n\`\`\``
        : contenido

      const procMeta = (await sigApi.get(`/api/procedimientos/${procId}`)).data
      const instructivos: Instructivo[] = (await sigApi.get(`/api/instructivos?procedimientoId=${procId}&activo=true`)).data
      void runAnalysis(
        {
          id:         procId,
          codigo:     procMeta.codigo as string,
          titulo:     procMeta.titulo as string,
          areaNombre: (procMeta.area?.nombre as string | undefined) ?? "",
        },
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
        <span className={cn("flex items-center gap-1 text-[11px] font-mono", tab.color)}>
          {tab.icon}
          {tab.label}
        </span>
        <button
          onClick={() => {
            if (isRunning && runningJob) {
              cancelAnalysisJob(runningJob.id)
            } else {
              void handleAnalyze()
            }
          }}
          disabled={!isRunning && loading}
          className={cn(
            "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded border font-mono transition-colors",
            isRunning
              ? "border-red-200 text-red-500 hover:bg-red-50"
              : loading
              ? "border-zinc-200 text-zinc-400 cursor-not-allowed"
              : "border-violet-200 text-violet-600 hover:bg-violet-50",
          )}
        >
          {isRunning
            ? <><X className="h-2.5 w-2.5" /> Cancelar</>
            : loading
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
            <span className="text-[11px] text-zinc-300 font-mono">
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
        <span className="text-[11px] font-mono text-zinc-400">Último análisis</span>
        <span className="text-[11px] font-mono text-zinc-400">{date}</span>
      </div>

      {type === "lightrag" && (
        <LightRAGResult result={result} />
      )}

      {/* Resumen */}
      {result.resumen && (
        <div className="mt-2 pt-2 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400 font-mono leading-relaxed">{result.resumen}</p>
        </div>
      )}
    </div>
  )
}

function LightRAGResult({ result }: { result: AnalisisResult }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      <div>
        <p className="text-[11px] font-mono text-zinc-600 font-semibold">Indexado en LightRAG</p>
        <p className="text-[11px] text-zinc-400 font-mono mt-1">
          {result.resumen || "El procedimiento fue indexado correctamente en el grafo de conocimiento."}
        </p>
      </div>
    </div>
  )
}
