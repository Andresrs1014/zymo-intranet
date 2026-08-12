/**
 * SigAiEditorPanel — Chat de edición quirúrgica con IA.
 *
 * El usuario escribe una instrucción ("Corrige los responsables para incluir
 * al Jefe de Calidad"), la IA devuelve el documento modificado, el usuario
 * ve un resumen de cambios y confirma → se crea un nuevo commit en sig-backend.
 */
import { useState, useRef, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import {
  Sparkles, Send, Loader, CheckCircle2, XCircle,
  GitBranchPlus, ChevronRight, AlertCircle,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  procedimientoId: number
  procedureCode: string
  area: string
  contenidoActual: string
  onCommitCreated: () => void
}

interface EditResult {
  contenidoEditado: string
  resumen: string
  cambios: Array<{ seccion: string; tipo: string; descripcion: string }>
  contenidoOriginal: string
  instruccion: string
  tokensUsados?: number
  modeloUsado?: string
}

type Phase = "idle" | "sending" | "polling" | "done" | "error" | "committing"

// ── Component ──────────────────────────────────────────────────────────────────

export function SigAiEditorPanel({
  procedimientoId,
  procedureCode,
  area,
  contenidoActual,
  onCommitCreated,
}: Props) {
  const qc = useQueryClient()

  const [instruccion, setInstruccion] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [result, setResult] = useState<EditResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [commitMsg, setCommitMsg] = useState("")
  const [showDiff, setShowDiff] = useState(false)

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const textaRef  = useRef<HTMLTextAreaElement>(null)

  // Auto-focus instruction textarea
  useEffect(() => { textaRef.current?.focus() }, [])

  // ── Poll job ────────────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  async function startPolling(jobId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/netvault/job/${jobId}`)
        const job = res.data
        if (job.status === "done") {
          stopPolling()
          setResult(job.data as EditResult)
          setCommitMsg(`Edición IA: ${(job.data as EditResult).resumen.slice(0, 200)}`)
          setPhase("done")
        } else if (job.status === "error") {
          stopPolling()
          setErrorMsg(job.error ?? "Error en el servidor de IA")
          setPhase("error")
        }
      } catch {
        stopPolling()
        setErrorMsg("No se pudo consultar el estado del análisis.")
        setPhase("error")
      }
    }, 2500)
  }

  useEffect(() => () => stopPolling(), [])

  // ── Send instruction ────────────────────────────────────────────────────────

  async function handleSend() {
    if (!instruccion.trim() || phase !== "idle") return
    setPhase("sending")
    setErrorMsg("")
    setResult(null)

    try {
      const res = await api.post("/api/netvault/editar-con-ia", {
        procedimientoId,
        procedureCode,
        area,
        contenidoActual,
        instruccion: instruccion.trim(),
      })
      if (res.data?.job_id) {
        setPhase("polling")
        startPolling(res.data.job_id)
      } else {
        setErrorMsg("El servidor no devolvió un job_id.")
        setPhase("error")
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "Error al iniciar la edición."
      setErrorMsg(detail)
      setPhase("error")
    }
  }

  // ── Create commit ───────────────────────────────────────────────────────────

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Sin resultado")
      await sigApi.post("/api/commits", {
        procedimientoId,
        contenidoOriginal: result.contenidoOriginal,
        contenidoAgente:   result.contenidoEditado,
        mensaje:           commitMsg || `Edición IA: ${instruccion.slice(0, 200)}`,
        versionDoc:        undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig", "procedimiento", procedimientoId] })
      setPhase("idle")
      setResult(null)
      setInstruccion("")
      setCommitMsg("")
      onCommitCreated()
    },
    onError: (e: any) => {
      setErrorMsg(e?.response?.data?.error ?? "Error al crear el commit.")
    },
  })

  function handleReset() {
    stopPolling()
    setPhase("idle")
    setResult(null)
    setErrorMsg("")
    setInstruccion("")
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isLoading = phase === "sending" || phase === "polling"
  const canSend   = instruccion.trim().length >= 5 && phase === "idle"

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-8 border-b border-zinc-200 bg-zinc-50">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-[11px] text-zinc-600 font-mono font-medium">Editar con IA</span>
        <span className="text-[11px] text-zinc-400">— instrucción quirúrgica</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Instruction area */}
        {(phase === "idle" || phase === "error") && (
          <div className="space-y-2">
            <label className="text-[11px] text-zinc-500 font-mono block">
              ¿Qué deseas corregir o mejorar?
            </label>
            <textarea
              ref={textaRef}
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend() }}
              placeholder={`Ej: "Agrega al Jefe de Calidad como responsable en la sección de Responsables" o "Cambia el plazo de revisión de 5 a 3 días hábiles"`}
              rows={4}
              className="w-full text-[12px] text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5
                         focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400
                         placeholder:text-zinc-400 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-mono">Ctrl+Enter para enviar</span>
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-medium transition-all",
                  canSend
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                )}
              >
                <Send className="h-3 w-3" />
                Aplicar edición
              </button>
            </div>

            {/* Error message */}
            {phase === "error" && (
              <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-200">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-red-600 font-mono">{errorMsg}</p>
                  <button onClick={handleReset} className="text-[11px] text-red-400 underline mt-1">
                    Reintentar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-violet-200 animate-ping" />
              <div className="h-10 w-10 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[12px] text-zinc-600 font-mono">
                {phase === "sending" ? "Enviando instrucción…" : "Aplicando edición con IA…"}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {phase === "polling" ? "Esto puede tomar 15-30 segundos" : ""}
              </p>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono italic max-w-xs text-center">
              "{instruccion.slice(0, 100)}{instruccion.length > 100 ? "…" : ""}"
            </div>
          </div>
        )}

        {/* Result */}
        {phase === "done" && result && (
          <div className="space-y-4">

            {/* Summary */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-violet-50 border border-violet-200">
              <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono font-semibold text-violet-700 mb-1">Edición completada</p>
                <p className="text-[11px] text-violet-600 leading-relaxed">{result.resumen}</p>
              </div>
            </div>

            {/* Changes list */}
            {result.cambios?.length > 0 && (
              <div>
                <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest mb-2">
                  Cambios aplicados
                </p>
                <div className="space-y-1.5">
                  {result.cambios.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <ChevronRight className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono font-medium text-zinc-700">{c.seccion}</span>
                        <span className="text-zinc-400 mx-1">·</span>
                        <span className={cn(
                          "text-[11px] px-1.5 py-0.5 rounded font-mono",
                          c.tipo === "adicion"     ? "bg-emerald-50 text-emerald-600"  :
                          c.tipo === "eliminacion" ? "bg-red-50 text-red-500"          :
                                                     "bg-amber-50 text-amber-600"
                        )}>
                          {c.tipo}
                        </span>
                        <p className="text-zinc-500 mt-0.5">{c.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diff toggle */}
            <button
              onClick={() => setShowDiff(p => !p)}
              className="w-full text-left flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono hover:text-zinc-600 transition-colors"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", showDiff && "rotate-90")} />
              {showDiff ? "Ocultar" : "Ver"} texto editado
            </button>

            {showDiff && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 max-h-64 overflow-y-auto">
                <div className="px-3 py-2 border-b border-zinc-200 text-[11px] text-zinc-400 font-mono">
                  Contenido editado (preview)
                </div>
                <pre className="px-3 py-3 text-[11px] font-mono text-zinc-600 whitespace-pre-wrap break-words">
                  {result.contenidoEditado}
                </pre>
              </div>
            )}

            {/* Commit message + confirm */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="text-[11px] text-zinc-500 font-mono block">
                Mensaje del commit
              </label>
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                className="w-full text-[12px] font-mono bg-white border border-zinc-200 rounded px-3 py-2
                           focus:outline-none focus:ring-1 focus:ring-violet-400 text-zinc-700"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => commitMutation.mutate()}
                  disabled={commitMutation.isPending || !commitMsg.trim()}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded text-[11px] font-mono font-medium flex-1 justify-center transition-all",
                    commitMutation.isPending
                      ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                      : "bg-violet-600 text-white hover:bg-violet-700"
                  )}
                >
                  {commitMutation.isPending
                    ? <><Loader className="h-3 w-3 animate-spin" /> Guardando…</>
                    : <><GitBranchPlus className="h-3 w-3" /> Guardar como nueva versión</>
                  }
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-2 rounded text-[11px] font-mono text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>

              {commitMutation.isError && (
                <p className="text-[11px] text-red-500 font-mono">{errorMsg}</p>
              )}
            </div>

            {/* Meta */}
            {result.tokensUsados && (
              <p className="text-[11px] text-zinc-400 font-mono">
                {result.tokensUsados.toLocaleString()} tokens · {result.modeloUsado}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
