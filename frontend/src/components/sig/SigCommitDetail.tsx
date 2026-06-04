import { useState } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"

interface CommitDetail {
  id: number
  mensaje: string
  autorNombre: string
  versionDoc: string | null
  sinCambios: boolean
  estado: "PENDIENTE_REVISION" | "APROBADO" | "RECHAZADO"
  contenidoOriginal: string
  contenidoAgente: string
  flujogramaMmd: string | null
  patch: string
  aprobadoNombre: string | null
  aprobadoEn: string | null
  comentarioRevision: string | null
  createdAt: string
  procedimiento: {
    id: number
    codigo: string
    titulo: string
    estado: string
    area: { nombre: string; color: string }
  }
}

type Tab = "diff" | "original" | "agente" | "flujograma"

export function SigCommitDetail() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const isGerente = user?.role === "admin" || user?.role === "gerente"
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>("diff")
  const [showRechazar, setShowRechazar] = useState(false)
  const [comentario, setComentario] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: commit, isLoading } = useQuery<CommitDetail>({
    queryKey: ["sig", "commit", id],
    queryFn: async () => (await sigApi.get(`/api/commits/${id}`)).data,
    enabled: !!id,
  })

  const aprobar = useMutation({
    mutationFn: async () => sigApi.post(`/api/commits/${id}/aprobar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig"] })
      setActionError(null)
    },
    onError: (e: any) => setActionError(e?.response?.data?.error ?? "Error al aprobar"),
  })

  const rechazar = useMutation({
    mutationFn: async () => sigApi.post(`/api/commits/${id}/rechazar`, { comentario }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig"] })
      setShowRechazar(false)
      setComentario("")
      setActionError(null)
    },
    onError: (e: any) => setActionError(e?.response?.data?.error ?? "Error al rechazar"),
  })

  if (isLoading) return <div className="p-8 text-zinc-600 text-sm">Cargando commit...</div>
  if (!commit) return <div className="p-8 text-zinc-600 text-sm">Commit no encontrado</div>

  const isPending = commit.estado === "PENDIENTE_REVISION"

  return (
    <div className="flex flex-col h-full">
      {/* Header del commit */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: commit.procedimiento.area.color }}
              />
              <span className="text-xs text-zinc-500">{commit.procedimiento.area.nombre}</span>
              <span className="text-xs text-zinc-700">·</span>
              <span className="text-xs text-zinc-500 font-mono">{commit.procedimiento.codigo}</span>
            </div>
            <h1 className="text-base font-semibold text-zinc-100">{commit.mensaje}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="text-xs text-zinc-600">por {commit.autorNombre}</span>
              {commit.versionDoc && (
                <span className="text-xs text-zinc-600 font-mono">doc v{commit.versionDoc}</span>
              )}
              <span className="text-xs text-zinc-700">
                {new Date(commit.createdAt).toLocaleString("es-CO")}
              </span>
              {commit.sinCambios && (
                <span className="text-xs text-zinc-500 italic">
                  — El agente no realizó cambios (el procedimiento estaba bien)
                </span>
              )}
            </div>
          </div>

          {/* Estado y acciones */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <CommitEstadoBadge estado={commit.estado} />
            {isGerente && isPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRechazar(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => aprobar.mutate()}
                  disabled={aprobar.isPending}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                >
                  {aprobar.isPending ? "Aprobando..." : "✓ Aprobar"}
                </button>
              </div>
            )}
            {!isPending && commit.aprobadoNombre && (
              <p className="text-[10px] text-zinc-600">
                {commit.estado === "APROBADO" ? "Aprobado" : "Rechazado"} por {commit.aprobadoNombre}
              </p>
            )}
          </div>
        </div>

        {commit.comentarioRevision && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="text-xs text-red-400 font-semibold mb-0.5">Motivo de rechazo</p>
            <p className="text-xs text-zinc-400">{commit.comentarioRevision}</p>
          </div>
        )}

        {actionError && (
          <p className="text-xs text-red-400 mt-2">{actionError}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-zinc-800 bg-zinc-900/20 shrink-0">
        {(["diff", "original", "agente", "flujograma"] as Tab[]).map((t) => {
          if (t === "flujograma" && !commit.flujogramaMmd) return null
          const labels: Record<Tab, string> = {
            diff: "Cambios (diff)",
            original: "Original",
            agente: "Procesado por IA",
            flujograma: "Flujograma",
          }
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "text-xs px-3 py-1.5 rounded transition-colors",
                tab === t
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "diff" && <DiffView patch={commit.patch} sinCambios={commit.sinCambios} />}
        {tab === "original" && <PlainTextView content={commit.contenidoOriginal} label="Documento original" />}
        {tab === "agente" && <MarkdownView content={commit.contenidoAgente} />}
        {tab === "flujograma" && commit.flujogramaMmd && <MermaidView mmd={commit.flujogramaMmd} />}
      </div>

      {/* Modal rechazar */}
      {showRechazar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-zinc-900 rounded-xl border border-zinc-800 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">Rechazar commit</h2>
            <p className="text-xs text-zinc-500 mb-4">Explica por qué se rechaza para que el SIG pueda corregir.</p>
            <textarea
              autoFocus
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-600"
              placeholder="Motivo del rechazo..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowRechazar(false); setComentario("") }}
                className="text-xs px-3 py-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!comentario.trim() || rechazar.isPending}
                onClick={() => rechazar.mutate()}
                className="text-xs px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 transition-colors"
              >
                {rechazar.isPending ? "Rechazando..." : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CommitEstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    PENDIENTE_REVISION: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    APROBADO:           "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    RECHAZADO:          "bg-red-500/15 text-red-400 border-red-500/30",
  }
  const labels: Record<string, string> = {
    PENDIENTE_REVISION: "Pendiente revisión",
    APROBADO: "Aprobado",
    RECHAZADO: "Rechazado",
  }
  return (
    <span className={cn("text-[10px] px-2 py-1 rounded border", map[estado] ?? "")}>
      {labels[estado] ?? estado}
    </span>
  )
}

function DiffView({ patch, sinCambios }: { patch: string; sinCambios: boolean }) {
  if (sinCambios) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center p-8">
        <div className="text-3xl mb-3">✓</div>
        <p className="text-sm text-zinc-400 font-medium">Sin cambios</p>
        <p className="text-xs text-zinc-600 mt-1">
          El agente revisó el procedimiento y lo encontró correcto. No realizó modificaciones.
        </p>
      </div>
    )
  }

  const lines = patch.split("\n")
  return (
    <div className="font-mono text-xs leading-5">
      {lines.map((line, i) => {
        const isAdd    = line.startsWith("+") && !line.startsWith("+++")
        const isDel    = line.startsWith("-") && !line.startsWith("---")
        const isHunk   = line.startsWith("@@")
        const isHeader = line.startsWith("+++") || line.startsWith("---")
        return (
          <div
            key={i}
            className={cn(
              "px-4 py-px whitespace-pre-wrap break-all",
              isAdd    ? "bg-emerald-950/40 text-emerald-300" :
              isDel    ? "bg-red-950/40 text-red-300" :
              isHunk   ? "bg-zinc-800/60 text-cyan-400" :
              isHeader ? "text-zinc-500" :
              "text-zinc-400"
            )}
          >
            {line || " "}
          </div>
        )
      })}
    </div>
  )
}

function PlainTextView({ content, label }: { content: string; label: string }) {
  return (
    <div className="p-6">
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3 font-mono">{label}</p>
      <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-6 bg-zinc-900/40 rounded-lg p-4 border border-zinc-800">
        {content}
      </pre>
    </div>
  )
}

function MarkdownView({ content }: { content: string }) {
  // Render simple markdown as pre — full renderer se puede agregar después
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3 font-mono">Procesado por IA — Markdown</p>
      <div className="prose prose-invert prose-sm max-w-none">
        <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-6 bg-zinc-900/30 rounded-lg p-4 border border-zinc-800">
          {content}
        </pre>
      </div>
    </div>
  )
}

function MermaidView({ mmd }: { mmd: string }) {
  return (
    <div className="p-6">
      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3 font-mono">Flujograma Mermaid</p>
      <pre className="text-xs text-cyan-300 font-mono whitespace-pre-wrap leading-5 bg-zinc-900/40 rounded-lg p-4 border border-zinc-800">
        {mmd}
      </pre>
      <p className="text-[10px] text-zinc-700 mt-2">
        Renderizado visual disponible en la próxima fase (se requiere librería mermaid).
      </p>
    </div>
  )
}
