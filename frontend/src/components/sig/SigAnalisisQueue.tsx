import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useSigAnalisisStore, type AnalysisJob, type AnalysisType } from "@/store/sigAnalisisStore"
import { cancelAnalysisJob } from "./SigAnalisisPanel"
import { ChevronUp, X, CheckCircle2, AlertCircle, Loader, Target, Lightbulb, GitCompare, Database, Users } from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<AnalysisType, string> = {
  coherencia:    "Coherencia",
  mejoras:       "Mejoras",
  "proc-vs-inst":"Proc/Inst",
  cargos:        "Cargos",
  lightrag:      "LightRAG",
}

const TYPE_ICON: Record<AnalysisType, React.ReactNode> = {
  coherencia:    <Target className="h-3 w-3" />,
  mejoras:       <Lightbulb className="h-3 w-3" />,
  "proc-vs-inst":<GitCompare className="h-3 w-3" />,
  cargos:        <Users className="h-3 w-3" />,
  lightrag:      <Database className="h-3 w-3" />,
}

function useElapsed(job: AnalysisJob): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (job.status !== "running") return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [job.status])
  const ms      = (job.completedAt ?? now) - job.startedAt
  const secs    = Math.floor(ms / 1000)
  const minutes = Math.floor(secs / 60).toString().padStart(2, "0")
  const seconds = (secs % 60).toString().padStart(2, "0")
  return `${minutes}:${seconds}`
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: AnalysisJob }) {
  const elapsed = useElapsed(job)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 last:border-0">
      {/* Status icon */}
      <div className="shrink-0 w-5 flex justify-center">
        {job.status === "running" && (
          <Loader className="h-3.5 w-3.5 text-violet-500 animate-spin" />
        )}
        {job.status === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        )}
        {job.status === "error" && (
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        )}
        {job.status === "cancelled" && (
          <X className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </div>

      {/* Type chip */}
      <div className="shrink-0 flex items-center gap-1 text-[10px] font-mono text-zinc-500">
        {TYPE_ICON[job.type]}
        <span>{TYPE_LABEL[job.type]}</span>
      </div>

      {/* Procedure */}
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-mono font-medium text-zinc-700">{job.procedureCodigo}</span>
        <span className="text-[10px] text-zinc-400 ml-1.5 truncate">{job.procedureTitulo}</span>
      </div>

      {/* Elapsed */}
      <span className="text-[10px] font-mono text-zinc-400 shrink-0 tabular-nums">{elapsed}</span>

      {/* Cancel button (running only) */}
      {job.status === "running" && (
        <button
          onClick={() => cancelAnalysisJob(job.id)}
          title="Cancelar análisis"
          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Error tooltip */}
      {job.status === "error" && job.error && (
        <span
          title={job.error}
          className="text-[9px] text-red-500 font-mono truncate max-w-[100px]"
        >
          {job.error}
        </span>
      )}
    </div>
  )
}

// ── Queue tray ────────────────────────────────────────────────────────────────

export function SigAnalisisQueue() {
  const {
    jobs, clearCompleted,
    queueExpanded, setQueueExpanded,
    queueVisible, setQueueVisible,
  } = useSigAnalisisStore()

  if (!queueVisible || jobs.length === 0) return null

  const running   = jobs.filter((j) => j.status === "running").length
  const done      = jobs.filter((j) => j.status === "done").length
  const errors    = jobs.filter((j) => j.status === "error").length
  const allFinished = running === 0

  function handleClose() {
    clearCompleted()
    if (jobs.filter((j) => j.status === "running").length === 0) {
      setQueueVisible(false)
    }
  }

  return (
    <div
      className={cn(
        "absolute bottom-5 right-5 z-50 w-[380px] rounded-xl border border-zinc-200 shadow-2xl shadow-zinc-900/20 overflow-hidden",
        "bg-white transition-all duration-200",
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 bg-zinc-900 cursor-pointer select-none"
        onClick={() => setQueueExpanded(!queueExpanded)}
      >
        {/* Status summary */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {running > 0 ? (
            <Loader className="h-3.5 w-3.5 text-violet-400 animate-spin shrink-0" />
          ) : errors > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          )}

          <span className="text-[12px] font-mono text-white font-medium">
            {running > 0
              ? `Analizando — ${running} en proceso`
              : allFinished && errors === 0
              ? `${done} análisis completado${done !== 1 ? "s" : ""}`
              : `${done} listo${done !== 1 ? "s" : ""}${errors > 0 ? `, ${errors} error${errors !== 1 ? "es" : ""}` : ""}`
            }
          </span>

          {/* Running dots */}
          {running > 0 && (
            <span className="flex gap-0.5 shrink-0">
              {Array.from({ length: Math.min(running, 3) }).map((_, i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-violet-400 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            onClick={(e) => { e.stopPropagation(); setQueueExpanded(!queueExpanded) }}
          >
            <ChevronUp className={cn("h-3.5 w-3.5 transition-transform", !queueExpanded && "rotate-180")} />
          </button>
          <button
            className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            onClick={(e) => { e.stopPropagation(); handleClose() }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Job list */}
      {queueExpanded && (
        <div className="max-h-[220px] overflow-y-auto">
          {jobs.map((job) => <JobRow key={job.id} job={job} />)}
        </div>
      )}

      {/* Footer */}
      {queueExpanded && allFinished && (done > 0 || errors > 0) && (
        <div className="flex justify-between items-center px-4 py-2 border-t border-zinc-100 bg-zinc-50">
          <span className="text-[10px] text-zinc-400 font-mono">
            {errors > 0 ? `${errors} fallido${errors !== 1 ? "s" : ""}` : "Todos completados"}
          </span>
          <button
            onClick={handleClose}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  )
}
