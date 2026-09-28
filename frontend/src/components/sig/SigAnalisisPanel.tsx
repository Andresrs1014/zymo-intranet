import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useSigAnalisisStore, type AnalysisType } from "@/store/sigAnalisisStore"

// Los análisis con LLM del servidor (coherencia/mejoras/proc-vs-inst/cargos) se
// retiraron de la intranet — esa responsabilidad pasa al MCP-001 (rúbrica propia,
// suscripción propia). Lo único que queda acá es disparar la indexación LightRAG
// y el polling de su job, que sigue viviendo en el backend Python.

// ── Module-level AbortController map ─────────────────────────────────────────

const _jobControllers = new Map<string, AbortController>()

export function cancelAnalysisJob(id: string) {
  _jobControllers.get(id)?.abort()
  _jobControllers.delete(id)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Instructivo {
  id:       number
  codigo:   string
  titulo:   string
  contenido: string
}

interface ProcSummary {
  id:         number
  codigo:     string
  titulo:     string
  areaNombre: string
}

// ── Polling de jobs de análisis IA ──────────────────────────────────────────────

const SIG_IA_TERMINAL = new Set(["done", "error", "cancelled", "failed", "aborted"])

async function pollSigIaJob(jobId: string, signal: AbortSignal): Promise<unknown> {
  for (let i = 0; i < 120; i++) {
    if (signal.aborted) throw new DOMException("Cancelled by user", "AbortError")
    await new Promise<void>((r) => setTimeout(r, 2500))
    if (signal.aborted) throw new DOMException("Cancelled by user", "AbortError")
    const { data } = await api.get(`/api/sig-ia/job/${jobId}`, { signal })
    if (data.status === "done") return data.data
    if (data.status === "error") throw new Error(data.error ?? "El análisis falló")
    if (SIG_IA_TERMINAL.has(data.status as string))
      throw new Error(`Estado inesperado del job: ${data.status as string}`)
  }
  throw new Error("Tiempo de espera agotado (5 min)")
}

// ── useRunAnalysis ────────────────────────────────────────────────────────────

export function useRunAnalysis() {
  const { addJob, updateJob, cancelJob } = useSigAnalisisStore()
  const qc = useQueryClient()

  const runAnalysis = useCallback(async (
    proc:        ProcSummary,
    type:        AnalysisType,
    textContent: string,
    instructivos?: Instructivo[],
  ) => {
    const controller = new AbortController()
    const localId = addJob({
      procedimientoId: proc.id,
      procedureCodigo: proc.codigo,
      procedureTitulo: proc.titulo,
      type,
    })
    _jobControllers.set(localId, controller)

    try {
      const instList = (instructivos ?? []).map((i) => ({
        id: i.id, codigo: i.codigo, titulo: i.titulo, contenido: i.contenido,
      }))

      const sigIaRes: { job_id: string } = (await api.post("/api/sig-ia/indexar-lightrag", {
        procedimientoId: proc.id,
        procedureCode:   proc.codigo,
        area:            proc.areaNombre,
        textContent,
        instructivos:    instList,
      })).data

      updateJob(localId, { sigIaJobId: sigIaRes.job_id })
      const result = await pollSigIaJob(sigIaRes.job_id, controller.signal)

      updateJob(localId, { status: "done", result, completedAt: Date.now() })
      qc.invalidateQueries({ queryKey: ["sig", "analisis", proc.id] })
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (isAbort) {
        cancelJob(localId)
      } else {
        const msg = err instanceof Error ? err.message : "Error desconocido"
        updateJob(localId, { status: "error", error: msg, completedAt: Date.now() })
      }
    } finally {
      _jobControllers.delete(localId)
    }
  }, [addJob, updateJob, cancelJob, qc])

  return runAnalysis
}
