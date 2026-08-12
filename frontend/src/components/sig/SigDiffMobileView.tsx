import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, X, AlertCircle, FileText, GitCommit } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────
// Mismo shape que SigDiffEditor.tsx — duplicado a propósito porque ese archivo
// no exporta parseDiff/CommitDetail y no debe tocarse (vista de escritorio ya resuelta).

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

interface DiffRow {
  kind: "context" | "change" | "delete" | "insert" | "hunk"
  left?: string
  right?: string
  leftNo?: number
  rightNo?: number
  hunkHeader?: string
}

function parseDiff(patch: string): DiffRow[] {
  const rows: DiffRow[] = []
  const lines = patch.split("\n")

  let leftNo = 0
  let rightNo = 0
  const delBuf: Array<{ content: string; no: number }> = []
  const addBuf: Array<{ content: string; no: number }> = []

  function flush() {
    const max = Math.max(delBuf.length, addBuf.length)
    for (let i = 0; i < max; i++) {
      const d = delBuf[i]
      const a = addBuf[i]
      if (d && a)      rows.push({ kind: "change", left: d.content, right: a.content, leftNo: d.no, rightNo: a.no })
      else if (d)      rows.push({ kind: "delete", left: d.content, leftNo: d.no })
      else if (a)      rows.push({ kind: "insert", right: a.content, rightNo: a.no })
    }
    delBuf.length = 0
    addBuf.length = 0
  }

  for (const line of lines) {
    if (line.startsWith("@@")) {
      flush()
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) { leftNo = parseInt(m[1]) - 1; rightNo = parseInt(m[2]) - 1 }
      rows.push({ kind: "hunk", hunkHeader: line })
    } else if (line.startsWith("---") || line.startsWith("+++")) {
      // skip file headers
    } else if (line.startsWith("-")) {
      delBuf.push({ content: line.slice(1), no: ++leftNo })
    } else if (line.startsWith("+")) {
      addBuf.push({ content: line.slice(1), no: ++rightNo })
    } else {
      flush()
      leftNo++; rightNo++
      rows.push({ kind: "context", left: line.slice(1), right: line.slice(1), leftNo, rightNo })
    }
  }
  flush()
  return rows
}

interface Props {
  commitId: number
  isGerente: boolean
  /** Llamado tras aprobar/rechazar con éxito — el preview mobile lo usa para volver a la lista. */
  onActioned?: () => void
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SigDiffMobileView({ commitId, isGerente, onActioned }: Props) {
  const qc = useQueryClient()
  const [showReject, setShowReject] = useState(false)
  const [rejectComment, setRejectComment] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: commit, isLoading } = useQuery<CommitDetail>({
    queryKey: ["sig", "commit", commitId],
    queryFn: async () => (await sigApi.get(`/api/commits/${commitId}`)).data,
  })

  const aprobar = useMutation({
    mutationFn: () => sigApi.post(`/api/commits/${commitId}/aprobar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig"] })
      setActionError(null)
      onActioned?.()
    },
    onError: (e: unknown) => setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al aprobar"),
  })

  const rechazar = useMutation({
    mutationFn: () => sigApi.post(`/api/commits/${commitId}/rechazar`, { comentario: rejectComment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig"] })
      setShowReject(false); setRejectComment(""); setActionError(null)
      onActioned?.()
    },
    onError: (e: unknown) => setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al rechazar"),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="flex items-center gap-2 text-zinc-500">
          <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-500 animate-spin" />
          <span className="text-[13px]">Cargando…</span>
        </div>
      </div>
    )
  }
  if (!commit) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <span className="text-[13px] text-zinc-500">Commit no encontrado</span>
      </div>
    )
  }

  const isPending = commit.estado === "PENDIENTE_REVISION"
  const rows      = parseDiff(commit.patch)
  const additions = rows.filter((r) => r.kind === "insert" || r.kind === "change").length
  const deletions = rows.filter((r) => r.kind === "delete"  || r.kind === "change").length
  const hasDiff   = !commit.sinCambios && rows.length > 0
  const showBar   = isGerente && isPending

  return (
    <div className="relative flex flex-col h-full bg-white overflow-hidden isolate">

      {/* Header — todo apilado verticalmente, pensado para pantalla angosta */}
      <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-4 pt-3 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: commit.procedimiento.area.color }} />
          <span className="text-[11px] text-zinc-600 font-mono font-medium">{commit.procedimiento.area.nombre}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1.5">
          <GitCommit className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[13px] text-zinc-700 font-mono font-semibold">{commit.procedimiento.codigo}</span>
          <span className="text-[11px] text-zinc-400 font-mono">#{String(commit.id).padStart(4, "0")}</span>
        </div>

        <p className="text-[15px] font-semibold text-zinc-900 leading-snug mt-2">{commit.mensaje}</p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
          <span className="text-[12px] text-zinc-700">{commit.autorNombre}</span>
          {commit.versionDoc && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="text-[11px] text-zinc-500 font-mono">v{commit.versionDoc}</span>
            </>
          )}
          <span className="text-zinc-300">·</span>
          <span className="text-[11px] text-zinc-500 font-mono">
            {new Date(commit.createdAt).toLocaleString("es-CO", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <EstadoBadge estado={commit.estado} />
          {hasDiff && (
            <>
              <span className="text-[11px] text-helix-done font-mono font-semibold">+{additions}</span>
              <span className="text-[11px] text-helix-accent font-mono font-semibold">−{deletions}</span>
            </>
          )}
          {!isPending && commit.aprobadoNombre && (
            <span className="text-[11px] text-zinc-500">
              por {commit.aprobadoNombre}
              {commit.aprobadoEn && " · " + new Date(commit.aprobadoEn).toLocaleDateString("es-CO")}
            </span>
          )}
        </div>

        {commit.comentarioRevision && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border-l-[3px] border-helix-accent bg-red-50 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-helix-accent mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-helix-accent">Motivo del rechazo — </span>
              <span className="text-[12px] text-zinc-700">{commit.comentarioRevision}</span>
            </div>
          </div>
        )}
        {actionError && <p className="mt-2 text-[11px] text-helix-accent font-mono">{actionError}</p>}
      </div>

      {/* Contenido — una sola columna, nunca split. Padding inferior para no quedar tapado por la barra fija. */}
      <div className={cn("flex-1 overflow-y-auto", showBar ? "pb-20" : "pb-6")}>
        {!hasDiff ? (
          <DocumentBody
            content={commit.contenidoAgente || commit.contenidoOriginal}
            banner={commit.sinCambios
              ? "El agente revisó el procedimiento y lo encontró conforme — sin cambios."
              : "Primera versión — no hay versión anterior con la que comparar."}
          />
        ) : (
          <MobileDiff rows={rows} />
        )}
      </div>

      {/* Barra de acción fija abajo — sin scroll para encontrarla */}
      {showBar && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 border-t border-zinc-200 bg-white/95 backdrop-blur px-4 py-3">
          <button
            onClick={() => setShowReject(true)}
            className="flex items-center justify-center gap-1.5 flex-1 h-11 rounded-xl border border-helix-accent/40 text-helix-accent text-[13px] font-medium active:bg-red-50 transition-colors"
          >
            <X className="h-4 w-4" />
            Rechazar
          </button>
          <button
            onClick={() => aprobar.mutate()}
            disabled={aprobar.isPending}
            className="flex items-center justify-center gap-1.5 flex-[1.4] h-11 rounded-xl bg-helix-done text-white text-[13px] font-semibold disabled:opacity-50 active:opacity-90 transition-colors"
          >
            <Check className="h-4 w-4" />
            {aprobar.isPending ? "Aprobando…" : "Aprobar"}
          </button>
        </div>
      )}

      {/* Bottom sheet — motivo de rechazo, sube desde abajo (no modal centrado) */}
      {showReject && <RejectSheet
        commitId={commitId}
        rejectComment={rejectComment}
        setRejectComment={setRejectComment}
        isPending={rechazar.isPending}
        onCancel={() => { setShowReject(false); setRejectComment("") }}
        onConfirm={() => rechazar.mutate()}
      />}
    </div>
  )
}

// ── Reject bottom sheet — animación de entrada manual (sin plugin tailwindcss-animate) ──

function RejectSheet({
  commitId, rejectComment, setRejectComment, isPending, onCancel, onConfirm,
}: {
  commitId: number
  rejectComment: string
  setRejectComment: (v: string) => void
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="absolute inset-0 z-20 flex items-end">
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity duration-200", entered ? "opacity-100" : "opacity-0")}
        onClick={() => { if (!isPending) onCancel() }}
      />
      <div
        className={cn(
          "relative w-full bg-white rounded-t-2xl border-t border-zinc-200 px-4 pt-3 pb-4 shadow-2xl transition-transform duration-200 ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" />
        <h2 className="text-[14px] font-semibold text-zinc-900">
          Rechazar #{String(commitId).padStart(4, "0")}
        </h2>
        <p className="text-[12px] text-zinc-500 mt-1 mb-3">
          Explica el motivo para que el equipo pueda corregir el documento.
        </p>
        <textarea
          autoFocus
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          rows={4}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-[15px] text-zinc-900 resize-none focus:outline-none focus:ring-1 focus:ring-helix-accent/50 placeholder:text-zinc-400"
          placeholder="Motivo del rechazo…"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl text-[13px] text-zinc-500 border border-zinc-200 active:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!rejectComment.trim() || isPending}
            onClick={onConfirm}
            className="flex-[1.4] h-11 rounded-xl bg-helix-accent text-white text-[13px] font-semibold disabled:opacity-40 active:opacity-90 transition-colors"
          >
            {isPending ? "Rechazando…" : "Confirmar rechazo"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Documento completo — cuando no hay diff que mostrar ────────────────────────

function DocumentBody({ content, banner }: { content: string; banner: string }) {
  if (!content?.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-16 text-center px-6">
        <FileText className="h-7 w-7 text-zinc-200" />
        <p className="text-[13px] text-zinc-500">Sin contenido en este commit</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start gap-2 mx-4 mt-3 rounded-lg border-l-[3px] border-sky-300 bg-sky-50 px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-sky-500 mt-0.5 shrink-0" />
        <p className="text-[12px] text-sky-700 leading-relaxed">{banner}</p>
      </div>
      <div className="px-4 py-4">
        <div className="prose prose-base max-w-none
          prose-headings:text-zinc-800 prose-headings:font-semibold
          prose-p:text-zinc-700 prose-p:text-[15px] prose-p:leading-relaxed
          prose-li:text-zinc-700 prose-li:text-[15px] prose-li:leading-relaxed
          prose-strong:text-zinc-800 prose-strong:font-semibold
          prose-code:text-helix-ai prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px]
          prose-hr:border-zinc-200
          prose-blockquote:border-l-zinc-300 prose-blockquote:text-zinc-500
          prose-a:text-helix-ai prose-a:no-underline"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// ── Diff inline — una sola columna, cambios apilados (borrado arriba, agregado abajo) ──

function MobileDiff({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="divide-y divide-zinc-100">
      {rows.map((row, i) => {
        if (row.kind === "hunk") {
          return (
            <div key={i} className="flex items-center justify-center py-2 bg-zinc-50">
              <span className="text-[11px] text-zinc-400 font-mono tracking-widest">· · ·</span>
            </div>
          )
        }
        if (row.kind === "context") {
          return (
            <p key={i} className="px-4 py-2 text-[15px] leading-relaxed text-zinc-700 whitespace-pre-wrap break-words">
              {row.left || " "}
            </p>
          )
        }
        if (row.kind === "delete") {
          return (
            <div key={i} className="flex gap-2 px-4 py-2 bg-red-50/70 border-l-[3px] border-helix-accent/50">
              <span className="text-helix-accent font-bold shrink-0 select-none">−</span>
              <p className="text-[15px] leading-relaxed text-red-800 line-through decoration-red-300 whitespace-pre-wrap break-words">
                {row.left || " "}
              </p>
            </div>
          )
        }
        if (row.kind === "insert") {
          return (
            <div key={i} className="flex gap-2 px-4 py-2 bg-green-50/70 border-l-[3px] border-helix-done/50">
              <span className="text-helix-done font-bold shrink-0 select-none">+</span>
              <p className="text-[15px] leading-relaxed text-green-800 whitespace-pre-wrap break-words">
                {row.right || " "}
              </p>
            </div>
          )
        }
        // change → apilado: borrado arriba, agregado abajo
        return (
          <div key={i}>
            <div className="flex gap-2 px-4 py-2 bg-red-50/70 border-l-[3px] border-helix-accent/50">
              <span className="text-helix-accent font-bold shrink-0 select-none">−</span>
              <p className="text-[15px] leading-relaxed text-red-800 line-through decoration-red-300 whitespace-pre-wrap break-words">
                {row.left || " "}
              </p>
            </div>
            <div className="flex gap-2 px-4 py-2 bg-green-50/70 border-l-[3px] border-helix-done/50">
              <span className="text-helix-done font-bold shrink-0 select-none">+</span>
              <p className="text-[15px] leading-relaxed text-green-800 whitespace-pre-wrap break-words">
                {row.right || " "}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Estado badge ───────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    PENDIENTE_REVISION: "text-amber-700 bg-amber-50 border-amber-200",
    APROBADO:           "text-helix-done bg-helix-done/10 border-helix-done/30",
    RECHAZADO:          "text-helix-accent bg-helix-accent/10 border-helix-accent/30",
  }
  const labels: Record<string, string> = {
    PENDIENTE_REVISION: "pendiente",
    APROBADO: "aprobado",
    RECHAZADO: "rechazado",
  }
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-mono tracking-wide", map[estado] ?? "")}>
      {labels[estado] ?? estado}
    </span>
  )
}
