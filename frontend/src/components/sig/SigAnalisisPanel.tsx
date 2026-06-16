import { useState, useCallback, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { useSigAnalisisStore, type AnalysisType } from "@/store/sigAnalisisStore"
import {
  ChevronLeft, ChevronDown, Search, SlidersHorizontal,
  Target, Lightbulb, GitCompare, Database,
  Loader, RotateCcw, AlertTriangle, CheckCircle2,
  FileText, BookOpen,
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
  id:    number
  nombre: string
  color:  string
}

interface ProcSyncData {
  procedimientoId: number
  codigo:  string
  titulo:  string
  estado:  string
  area:    { nombre: string; color: string }
  latestApproved: {
    commitId:       number
    contenidoAgente: string
    versionDoc:     string | null
  } | null
}

interface CoherenciaIssue {
  tipo:        string
  descripcion: string
  severidad:   "critica" | "alta" | "media" | "baja"
}

interface AnalisisCoherencia {
  id:        number
  coherente: boolean
  puntaje:   number | null
  resumen:   string
  issues:    CoherenciaIssue[]
  autorNombre: string
  createdAt: string
}

interface MejorasProposal {
  descripcion: string
  categoria?:  string
  prioridad?:  string
}

interface AnalisisMejoras {
  id:        number
  proposals: MejorasProposal[]
  resumen:   string
  autorNombre: string
  createdAt: string
}

interface ProcVsInstConflicto {
  instructivoCodigo: string
  descripcion:       string
  severidad:         "critica" | "alta" | "media" | "baja"
}

interface AnalisisProcVsInst {
  id:        number
  coherente: boolean
  resumen:   string
  conflictos: ProcVsInstConflicto[]
  autorNombre: string
  createdAt: string
}

interface Instructivo {
  id:      number
  codigo:  string
  titulo:  string
  contenido: string
  activo:  boolean
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

// ── useRunAnalysis hook ───────────────────────────────────────────────────────

function useRunAnalysis() {
  const { addJob, updateJob } = useSigAnalisisStore()
  const qc = useQueryClient()

  const runAnalysis = useCallback(async (
    proc:         ProcSummary,
    type:         AnalysisType,
    textContent:  string,
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
        netvaultRes = (await api.post("/api/netvault/analizar-proc-vs-inst", { textContent, instructivosText: instText })).data
      } else {
        netvaultRes = (await api.post("/api/netvault/indexar-lightrag", {
          textContent,
          codigo: proc.codigo,
          titulo: proc.titulo,
        })).data
      }

      updateJob(localId, { netvaultJobId: netvaultRes.jobId })

      const result = await pollNetvaultJob(netvaultRes.jobId)

      if (type !== "lightrag") {
        const endpoint =
          type === "coherencia"    ? "/api/analisis/coherencia" :
          type === "mejoras"       ? "/api/analisis/mejoras"    :
                                     "/api/analisis/proc-vs-inst"
        await sigApi.post(endpoint, { procedimientoId: proc.id, ...(result as Record<string, unknown>) })
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

// ── Main component ────────────────────────────────────────────────────────────

export function SigAnalisisPanel() {
  const [selectedProcId, setSelectedProcId] = useState<number | null>(null)
  const [areaFilter, setAreaFilter]         = useState<number | null>(null)
  const [searchQ, setSearchQ]               = useState("")
  const runAnalysis = useRunAnalysis()

  const { data: areas = [] } = useQuery<SigArea[]>({
    queryKey: ["sig", "areas"],
    queryFn: () => sigApi.get("/api/areas").then((r) => r.data),
  })

  const { data: allProcs = [], isLoading: procsLoading } = useQuery<ProcListItem[]>({
    queryKey: ["sig", "procedimientos", areaFilter],
    queryFn: () =>
      sigApi
        .get("/api/procedimientos", { params: areaFilter ? { areaId: areaFilter } : {} })
        .then((r) => r.data),
  })

  const procedures = allProcs.filter(
    (p) =>
      p._count.commits > 0 &&
      (!searchQ ||
        p.codigo.toLowerCase().includes(searchQ.toLowerCase()) ||
        p.titulo.toLowerCase().includes(searchQ.toLowerCase())),
  )

  if (selectedProcId) {
    return (
      <ProcDrilldownView
        procId={selectedProcId}
        onBack={() => setSelectedProcId(null)}
        runAnalysis={runAnalysis}
      />
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">

      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-zinc-200 bg-white">
        <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400 shrink-0" />

        {/* Area chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          <AreaChip
            label="Todas"
            active={areaFilter === null}
            onClick={() => setAreaFilter(null)}
          />
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

        {/* Search */}
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
        {procsLoading && (
          <div className="flex items-center gap-2 text-zinc-400 py-10 justify-center">
            <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
            <span className="text-xs font-mono">Cargando procedimientos…</span>
          </div>
        )}

        {!procsLoading && procedures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="h-8 w-8 text-zinc-300" />
            <div className="text-center">
              <p className="text-sm font-mono text-zinc-500">Sin procedimientos commiteados</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Solo aparecen procedimientos con al menos un commit enviado desde NetVault.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 max-w-3xl mx-auto">
          {procedures.map((proc) => (
            <ProcListCard
              key={proc.id}
              proc={proc}
              onOpen={() => setSelectedProcId(proc.id)}
              runAnalysis={runAnalysis}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Area chip ─────────────────────────────────────────────────────────────────

function AreaChip({ label, color, active, onClick }: { label: string; color?: string; active: boolean; onClick: () => void }) {
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

// ── Procedure list card ───────────────────────────────────────────────────────

function ProcListCard({
  proc, onOpen, runAnalysis,
}: {
  proc:        ProcListItem
  onOpen:      () => void
  runAnalysis: (proc: ProcSummary, type: AnalysisType, text: string, instructivos?: Instructivo[]) => Promise<void>
}) {
  const jobs        = useSigAnalisisStore((s) => s.jobs)
  const runningJobs = jobs.filter((j) => j.procedimientoId === proc.id && j.status === "running")
  const [analyzing, setAnalyzing] = useState(false)

  async function handleAnalyzeAll() {
    setAnalyzing(true)
    try {
      const syncData: ProcSyncData = (await sigApi.get(`/api/procedimientos/${proc.id}/sync`)).data
      const textContent = syncData.latestApproved?.contenidoAgente
      if (!textContent) return
      const instructivos: Instructivo[] = (await sigApi.get(`/api/instructivos?procedimientoId=${proc.id}&activo=true`)).data
      const summary: ProcSummary = { id: proc.id, codigo: proc.codigo, titulo: proc.titulo }
      void runAnalysis(summary, "coherencia", textContent)
      void runAnalysis(summary, "mejoras", textContent)
      if (instructivos.length > 0) {
        void runAnalysis(summary, "proc-vs-inst", textContent, instructivos)
      }
      void runAnalysis(summary, "lightrag", textContent)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-all group">

      {/* Area bar */}
      <div className="h-10 w-0.5 rounded-full shrink-0" style={{ backgroundColor: proc.area.color }} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono font-medium text-zinc-700">{proc.codigo}</span>
          <span className="text-[10px] text-zinc-400">·</span>
          <span className="text-[11px] text-zinc-400">{proc.area.nombre}</span>
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded border font-mono ml-auto",
            proc.estado === "VIGENTE" ? "text-emerald-600 border-emerald-300 bg-emerald-50" :
            proc.estado === "OBSOLETO" ? "text-zinc-400 border-zinc-200 bg-zinc-50" :
            "text-zinc-500 border-zinc-300 bg-zinc-100",
          )}>{proc.estado.toLowerCase()}</span>
        </div>
        <p className="text-[12px] text-zinc-600 truncate mt-0.5">{proc.titulo}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-400 font-mono">{proc._count.commits} commit{proc._count.commits !== 1 ? "s" : ""}</span>
          {runningJobs.length > 0 && (
            <>
              <span className="text-[10px] text-zinc-300">·</span>
              <span className="flex items-center gap-1 text-[10px] text-violet-500 font-mono">
                <Loader className="h-2.5 w-2.5 animate-spin" />
                {runningJobs.length} análisis en curso
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleAnalyzeAll}
          disabled={analyzing}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors font-mono disabled:opacity-50"
        >
          {analyzing
            ? <><Loader className="h-3 w-3 animate-spin" /> Iniciando…</>
            : <><Target className="h-3 w-3" /> Analizar todo</>
          }
        </button>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors font-mono"
        >
          <ChevronDown className="h-3 w-3 -rotate-90" />
          Ver análisis
        </button>
      </div>
    </div>
  )
}

// ── Proc drill-down ───────────────────────────────────────────────────────────

function ProcDrilldownView({
  procId, onBack, runAnalysis,
}: {
  procId:      number
  onBack:      () => void
  runAnalysis: (proc: ProcSummary, type: AnalysisType, text: string, instructivos?: Instructivo[]) => Promise<void>
}) {
  const [showInstructivos, setShowInstructivos] = useState(false)
  const qc = useQueryClient()

  const { data: procSync } = useQuery<ProcSyncData>({
    queryKey: ["sig", "proc-sync", procId],
    queryFn:  () => sigApi.get(`/api/procedimientos/${procId}/sync`).then((r) => r.data),
  })

  const { data: coherencias = [] } = useQuery<AnalisisCoherencia[]>({
    queryKey: ["sig", "analisis", procId, "coherencia"],
    queryFn:  () => sigApi.get(`/api/analisis/coherencia?procedimientoId=${procId}&limit=1`).then((r) => r.data),
    enabled:  !!procId,
  })

  const { data: mejoras = [] } = useQuery<AnalisisMejoras[]>({
    queryKey: ["sig", "analisis", procId, "mejoras"],
    queryFn:  () => sigApi.get(`/api/analisis/mejoras?procedimientoId=${procId}&limit=1`).then((r) => r.data),
    enabled:  !!procId,
  })

  const { data: procVsInstList = [] } = useQuery<AnalisisProcVsInst[]>({
    queryKey: ["sig", "analisis", procId, "proc-vs-inst"],
    queryFn:  () => sigApi.get(`/api/analisis/proc-vs-inst?procedimientoId=${procId}&limit=1`).then((r) => r.data),
    enabled:  !!procId,
  })

  const { data: instructivos = [] } = useQuery<Instructivo[]>({
    queryKey: ["sig", "instructivos", procId],
    queryFn:  () => sigApi.get(`/api/instructivos?procedimientoId=${procId}&activo=true`).then((r) => r.data),
    enabled:  !!procId,
  })

  const runningJobs  = useSigAnalisisStore((s) => s.jobs.filter((j) => j.procedimientoId === procId && j.status === "running"))
  const textContent  = procSync?.latestApproved?.contenidoAgente ?? null
  const canRun       = !!textContent

  function isRunning(type: AnalysisType) {
    return runningJobs.some((j) => j.type === type)
  }

  async function handleRun(type: AnalysisType) {
    if (!procSync || !textContent) return
    const proc: ProcSummary = { id: procId, codigo: procSync.codigo, titulo: procSync.titulo }
    void runAnalysis(proc, type, textContent, type === "proc-vs-inst" ? instructivos : undefined)
  }

  async function handleRunAll() {
    if (!procSync || !textContent) return
    const proc: ProcSummary = { id: procId, codigo: procSync.codigo, titulo: procSync.titulo }
    void runAnalysis(proc, "coherencia", textContent)
    void runAnalysis(proc, "mejoras", textContent)
    if (instructivos.length > 0) {
      void runAnalysis(proc, "proc-vs-inst", textContent, instructivos)
    }
    void runAnalysis(proc, "lightrag", textContent)
  }

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["sig", "analisis", procId] })
  }, [qc, procId])

  // Re-fetch when a job for this proc completes
  useEffect(() => {
    const completed = runningJobs.length === 0
    if (completed) invalidateAll()
  }, [runningJobs.length, invalidateAll])

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-11 border-b border-zinc-200 bg-white">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 font-mono transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Procedimientos
        </button>
        <div className="h-4 w-px bg-zinc-200" />
        {procSync ? (
          <>
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: procSync.area.color }}
            />
            <span className="text-[12px] font-mono font-semibold text-zinc-700">{procSync.codigo}</span>
            <span className="text-[11px] text-zinc-500 truncate">{procSync.titulo}</span>
            <span className="text-[10px] text-zinc-400">{procSync.area.nombre}</span>
          </>
        ) : (
          <div className="h-3 w-40 bg-zinc-100 rounded animate-pulse" />
        )}

        <div className="ml-auto flex items-center gap-2">
          {!canRun && (
            <span className="text-[10px] text-amber-600 font-mono flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Sin contenido aprobado
            </span>
          )}
          <button
            onClick={() => setShowInstructivos(!showInstructivos)}
            className={cn(
              "flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded border font-mono transition-colors",
              showInstructivos
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700",
            )}
          >
            <BookOpen className="h-3 w-3" />
            Instructivos {instructivos.length > 0 && `(${instructivos.length})`}
          </button>
          <button
            onClick={handleRunAll}
            disabled={!canRun}
            className={cn(
              "flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded border font-mono transition-colors",
              canRun
                ? "border-violet-200 text-violet-600 hover:bg-violet-50"
                : "border-zinc-200 text-zinc-300 cursor-not-allowed",
            )}
          >
            <Target className="h-3 w-3" />
            Analizar todo
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Analysis cards */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-2xl mx-auto space-y-3">
            <CoherenciaCard
              latest={coherencias[0] ?? null}
              isRunning={isRunning("coherencia")}
              canRun={canRun}
              onRun={() => handleRun("coherencia")}
            />
            <MejorasCard
              latest={mejoras[0] ?? null}
              isRunning={isRunning("mejoras")}
              canRun={canRun}
              onRun={() => handleRun("mejoras")}
            />
            <ProcVsInstCard
              latest={procVsInstList[0] ?? null}
              isRunning={isRunning("proc-vs-inst")}
              canRun={canRun && instructivos.length > 0}
              noInstructivos={instructivos.length === 0}
              onRun={() => handleRun("proc-vs-inst")}
            />
            <LightRAGCard
              isRunning={isRunning("lightrag")}
              canRun={canRun}
              onRun={() => handleRun("lightrag")}
            />
          </div>
        </div>

        {/* Instructivos side panel */}
        {showInstructivos && (
          <div className="w-64 shrink-0 border-l border-zinc-200 flex flex-col bg-white">
            <div className="flex items-center gap-2 px-3 h-8 border-b border-zinc-200">
              <BookOpen className="h-3 w-3 text-zinc-400" />
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Instructivos</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {instructivos.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[11px] text-zinc-400 font-mono">Sin instructivos vinculados</p>
                </div>
              ) : (
                instructivos.map((inst) => (
                  <div key={inst.id} className="px-3 py-2 border-b border-zinc-100">
                    <p className="text-[11px] font-mono font-medium text-zinc-700">{inst.codigo}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{inst.titulo}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Analysis cards ────────────────────────────────────────────────────────────

function CardShell({
  icon, title, lastDate, lastAuthor, isRunning, canRun, onRun,
  headerRight, children, hasResult,
}: {
  icon:        React.ReactNode
  title:       string
  lastDate?:   string
  lastAuthor?: string
  isRunning:   boolean
  canRun:      boolean
  onRun:       () => void
  headerRight?: React.ReactNode
  children?:   React.ReactNode
  hasResult:   boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-7 w-7 rounded border border-zinc-200 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono font-semibold text-zinc-700 uppercase tracking-widest">{title}</p>
          {lastDate && !isRunning && (
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
              {new Date(lastDate).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
              {lastAuthor && ` · ${lastAuthor}`}
            </p>
          )}
        </div>

        {headerRight && <div className="shrink-0">{headerRight}</div>}

        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <span className="flex items-center gap-1.5 text-[10px] text-violet-500 font-mono">
              <Loader className="h-3 w-3 animate-spin" />
              Analizando…
            </span>
          ) : (
            <button
              onClick={onRun}
              disabled={!canRun}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded border font-mono transition-all",
                canRun
                  ? hasResult
                    ? "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                    : "border-helix-accent/40 text-helix-accent hover:bg-helix-accent/10"
                  : "border-zinc-100 text-zinc-300 cursor-not-allowed",
              )}
            >
              {hasResult ? <><RotateCcw className="inline h-2.5 w-2.5 mr-1" />Re-analizar</> : "Analizar"}
            </button>
          )}
          {hasResult && !isRunning && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && hasResult && !isRunning && (
        <div className="border-t border-zinc-100">{children}</div>
      )}

      {/* No result state */}
      {!hasResult && !isRunning && (
        <div className="border-t border-zinc-100 px-4 py-3 text-center">
          <p className="text-[11px] text-zinc-400">
            {canRun ? "Sin análisis previo para este procedimiento." : "Sin contenido aprobado o instructivos disponibles."}
          </p>
        </div>
      )}
    </div>
  )
}

function SeverityDot({ severity }: { severity: "critica" | "alta" | "media" | "baja" }) {
  const colors = {
    critica: "bg-red-500",
    alta:    "bg-orange-400",
    media:   "bg-amber-400",
    baja:    "bg-zinc-300",
  }
  const filled = severity === "critica" || severity === "alta"
  return (
    <div className={cn(
      "h-2 w-2 rounded-full shrink-0 mt-1",
      filled ? colors[severity] : "border-2 " + colors[severity].replace("bg-", "border-"),
    )} />
  )
}

// ── Coherencia card ───────────────────────────────────────────────────────────

function CoherenciaCard({
  latest, isRunning, canRun, onRun,
}: {
  latest:    AnalisisCoherencia | null
  isRunning: boolean
  canRun:    boolean
  onRun:     () => void
}) {
  const score    = latest?.puntaje != null ? Math.round(latest.puntaje * 100) : null
  const barColor = score == null ? "" : score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"
  const txtColor = score == null ? "" : score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"
  const issues   = (latest?.issues as CoherenciaIssue[] | undefined) ?? []

  return (
    <CardShell
      icon={<Target className="h-3.5 w-3.5 text-zinc-500" />}
      title="Coherencia"
      lastDate={latest?.createdAt}
      lastAuthor={latest?.autorNombre}
      isRunning={isRunning}
      canRun={canRun}
      onRun={onRun}
      hasResult={!!latest}
      headerRight={
        score != null ? (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full", barColor)} style={{ width: `${score}%` }} />
            </div>
            <span className={cn("text-[13px] font-mono font-bold", txtColor)}>{score}</span>
            <span className="text-[10px] text-zinc-400 font-mono">/100</span>
          </div>
        ) : null
      }
    >
      <div className="px-4 py-3 space-y-1">
        {latest?.resumen && (
          <p className="text-[11px] text-zinc-500 mb-3">{latest.resumen}</p>
        )}
        {issues.length === 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Sin hallazgos
          </div>
        ) : (
          issues.map((issue, i) => (
            <div key={i} className="flex gap-2.5 py-1">
              <SeverityDot severity={issue.severidad} />
              <div className="min-w-0">
                <p className="text-[11px] text-zinc-600 leading-snug">{issue.descripcion}</p>
                {issue.tipo && (
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">{issue.tipo}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </CardShell>
  )
}

// ── Mejoras card ──────────────────────────────────────────────────────────────

function MejorasCard({
  latest, isRunning, canRun, onRun,
}: {
  latest:    AnalisisMejoras | null
  isRunning: boolean
  canRun:    boolean
  onRun:     () => void
}) {
  const proposals = (latest?.proposals as MejorasProposal[] | undefined) ?? []

  return (
    <CardShell
      icon={<Lightbulb className="h-3.5 w-3.5 text-zinc-500" />}
      title="Mejoras"
      lastDate={latest?.createdAt}
      lastAuthor={latest?.autorNombre}
      isRunning={isRunning}
      canRun={canRun}
      onRun={onRun}
      hasResult={!!latest}
      headerRight={
        proposals.length > 0 ? (
          <span className="text-[11px] font-mono text-zinc-500">
            <span className="font-bold text-zinc-700">{proposals.length}</span> propuesta{proposals.length !== 1 ? "s" : ""}
          </span>
        ) : null
      }
    >
      <div className="px-4 py-3 space-y-2">
        {latest?.resumen && (
          <p className="text-[11px] text-zinc-500 mb-3">{latest.resumen}</p>
        )}
        {proposals.map((p, i) => (
          <div key={i} className="flex gap-2.5 py-1 border-b border-zinc-50 last:border-0">
            <div className="h-4 w-4 rounded bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] font-mono font-bold text-amber-600">{i + 1}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-600 leading-snug">{p.descripcion}</p>
              {p.categoria && (
                <span className="text-[9px] font-mono text-zinc-400 uppercase">{p.categoria}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ── Proc vs Inst card ─────────────────────────────────────────────────────────

function ProcVsInstCard({
  latest, isRunning, canRun, noInstructivos, onRun,
}: {
  latest:          AnalisisProcVsInst | null
  isRunning:       boolean
  canRun:          boolean
  noInstructivos:  boolean
  onRun:           () => void
}) {
  const conflictos = (latest?.conflictos as ProcVsInstConflicto[] | undefined) ?? []

  return (
    <CardShell
      icon={<GitCompare className="h-3.5 w-3.5 text-zinc-500" />}
      title="Proc vs Instructivos"
      lastDate={latest?.createdAt}
      lastAuthor={latest?.autorNombre}
      isRunning={isRunning}
      canRun={canRun}
      onRun={onRun}
      hasResult={!!latest}
      headerRight={
        latest ? (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded",
            latest.coherente
              ? "text-emerald-600 bg-emerald-50"
              : "text-red-600 bg-red-50",
          )}>
            {latest.coherente
              ? <><CheckCircle2 className="h-3 w-3" /> Coherente</>
              : <><AlertTriangle className="h-3 w-3" /> {conflictos.length} conflicto{conflictos.length !== 1 ? "s" : ""}</>
            }
          </div>
        ) : noInstructivos ? (
          <span className="text-[10px] font-mono text-zinc-400">Sin instructivos</span>
        ) : null
      }
    >
      <div className="px-4 py-3 space-y-2">
        {latest?.resumen && (
          <p className="text-[11px] text-zinc-500 mb-3">{latest.resumen}</p>
        )}
        {conflictos.map((c, i) => (
          <div key={i} className="flex gap-2.5 py-1">
            <SeverityDot severity={c.severidad} />
            <div className="min-w-0">
              <span className="text-[9px] font-mono text-zinc-400 mr-2">{c.instructivoCodigo}</span>
              <p className="text-[11px] text-zinc-600 leading-snug">{c.descripcion}</p>
            </div>
          </div>
        ))}
        {conflictos.length === 0 && latest?.coherente && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Totalmente alineado con instructivos
          </div>
        )}
      </div>
    </CardShell>
  )
}

// ── LightRAG card ─────────────────────────────────────────────────────────────

function LightRAGCard({
  isRunning, canRun, onRun,
}: {
  isRunning: boolean
  canRun:    boolean
  onRun:     () => void
}) {
  const completedJobs = useSigAnalisisStore((s) =>
    s.jobs.filter((j) => j.type === "lightrag" && j.status === "done"),
  )
  const lastJob = completedJobs.at(-1)

  return (
    <CardShell
      icon={<Database className="h-3.5 w-3.5 text-zinc-500" />}
      title="LightRAG"
      isRunning={isRunning}
      canRun={canRun}
      onRun={onRun}
      hasResult={!!lastJob}
      headerRight={
        lastJob ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Indexado
          </span>
        ) : (
          <span className="text-[10px] font-mono text-zinc-400">Sin indexar</span>
        )
      }
    >
      <div className="px-4 py-3">
        <p className="text-[11px] text-zinc-500">
          Procedimiento indexado en LightRAG. Disponible para consultas semánticas.
        </p>
      </div>
    </CardShell>
  )
}
