import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, ExternalLink, Loader, X } from "lucide-react"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import { parseDiff, SplitDiff } from "@/components/sig/SigDiffEditor"

export interface CommitPendiente {
  id: number
  mensaje: string
  autorNombre: string
  createdAt: string
  versionDoc?: string | null
  procedimiento: { codigo: string; titulo: string; area: { nombre: string; color: string } }
}

interface Detalle {
  sinCambios: boolean
  contenidoOriginal: string
  contenidoAgente: string
  patch: string
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

const mensajeDe = (e: unknown, defecto: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? defecto

/** Una versión pendiente: cerrada es una fila; abierta muestra la versión anterior junto a la nueva y deja aprobar o rechazar ahí mismo. */
export function SigColaCommit({ commit, onVerCompleto }: { commit: CommitPendiente; onVerCompleto: () => void }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false) // el detalle se pide al abrir por primera vez y se conserva
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { data: det, isLoading, isError } = useQuery<Detalle>({
    queryKey: ["sig", "commit", commit.id],
    queryFn: async () => (await sigApi.get(`/api/commits/${commit.id}`)).data,
    enabled: montado,
  })

  const resolver = useMutation({
    mutationFn: (aprobar: boolean) =>
      aprobar ? sigApi.post(`/api/commits/${commit.id}/aprobar`) : sigApi.post(`/api/commits/${commit.id}/rechazar`, { comentario: motivo.trim() }),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ["sig"] }) },
    onError: (e) => setError(mensajeDe(e, "No se pudo guardar la decisión. Intenta de nuevo.")),
  })

  const filas = det ? parseDiff(det.patch) : []
  const primera = !!det && det.contenidoOriginal.trim() === ""
  const cambios = filas.filter((f) => f.kind === "insert" || f.kind === "delete" || f.kind === "change").length

  return (
    <article className={cn("overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow", abierto ? "border-zinc-400 shadow-md" : "border-zinc-300 hover:border-zinc-400")}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => { setAbierto((a) => !a); setMontado(true) }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-helix-accent"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: commit.procedimiento.area.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-700">
            <span className="font-mono text-zinc-800">{commit.procedimiento.codigo}</span>
            <span>{commit.procedimiento.area.nombre}</span>
            {commit.versionDoc && <span className="font-mono">v{commit.versionDoc}</span>}
          </span>
          <span className="mt-0.5 block truncate font-mono text-xs text-zinc-800">{commit.mensaje}</span>
          <span className="mt-0.5 block text-xs text-zinc-600">por {commit.autorNombre} · {fecha(commit.createdAt)}</span>
        </span>
        <span className="shrink-0 font-mono text-xs text-amber-700">#{String(commit.id).padStart(4, "0")}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-600 transition-transform duration-300 [transition-timing-function:cubic-bezier(.2,.8,.2,1)]", abierto && "rotate-180")} aria-hidden />
      </button>

      <div className={cn("grid transition-[grid-template-rows] duration-300 [transition-timing-function:cubic-bezier(.2,.8,.2,1)]", abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          {montado && (
            <div className="space-y-3 border-t border-zinc-300 bg-zinc-100 p-4">
              {isLoading && <p role="status" className="flex items-center gap-2 text-xs text-zinc-600"><Loader className="h-3.5 w-3.5 animate-spin" aria-hidden />Cargando las dos versiones…</p>}
              {isError && <p role="alert" className="text-xs text-red-700">No se pudo cargar esta versión. Ciérrala y ábrela de nuevo.</p>}

              {det && (
                <>
                  <p className="text-xs text-zinc-700">
                    {primera
                      ? "Es la primera versión de este procedimiento: no hay una anterior con la que comparar."
                      : det.sinCambios || cambios === 0
                        ? "Esta versión no cambia el texto frente a la anterior."
                        : `Frente a la versión vigente cambian ${cambios} bloques de texto.`}
                  </p>
                  <div className="h-80 overflow-hidden rounded-lg border border-zinc-300 bg-white">
                    {primera ? (
                      <div className="h-full overflow-auto">
                        <p className="sticky top-0 border-b border-zinc-300 bg-zinc-100 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-helix-ai">Versión nueva</p>
                        <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-zinc-800">{det.contenidoAgente}</pre>
                      </div>
                    ) : (
                      <SplitDiff rows={filas} portable />
                    )}
                  </div>
                </>
              )}

              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

              {rechazando && (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) resolver.mutate(false) }}
                >
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    autoFocus
                    maxLength={1000}
                    aria-label="Motivo del rechazo"
                    placeholder="Motivo del rechazo (lo ve quien subió la versión)…"
                    className="min-w-0 flex-1 basis-60 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-xs text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-helix-accent"
                  />
                  <button type="submit" disabled={!motivo.trim() || resolver.isPending} className="min-h-9 rounded-lg bg-red-700 px-3 font-mono text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-40">
                    Confirmar rechazo
                  </button>
                </form>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onVerCompleto} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-400 bg-white px-3 font-mono text-xs text-zinc-700 transition-colors hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-helix-accent">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />Ver completo
                </button>
                <span className="flex-1" />
                <button type="button" onClick={() => { setRechazando((r) => !r); setMotivo("") }} disabled={resolver.isPending} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 font-mono text-xs text-red-700 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-40">
                  <X className="h-3.5 w-3.5" aria-hidden />Rechazar
                </button>
                <button type="button" onClick={() => resolver.mutate(true)} disabled={resolver.isPending || !det} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 font-mono text-xs text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-40">
                  {resolver.isPending ? <Loader className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}Aprobar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
