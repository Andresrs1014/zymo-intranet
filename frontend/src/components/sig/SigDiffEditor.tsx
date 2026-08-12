import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  GitCommit, Check, X, AlertCircle,
  SplitSquareHorizontal, AlignLeft, FileText,
} from "lucide-react"
import type { ProcedureOpenInfo } from "@/components/sig/SigExplorer"

// ── Types ──────────────────────────────────────────────────────────────────────

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

type DiffMode = "split" | "inline" | "documento"

interface DiffRow {
  kind: "context" | "change" | "delete" | "insert" | "hunk"
  left?: string
  right?: string
  leftNo?: number
  rightNo?: number
  hunkHeader?: string
}

// Flattened row for inline rendering — change expands into del + ins
type InlineRow =
  | { kind: "context" | "hunk" | "delete" | "insert"; row: DiffRow }
  | { kind: "change-del" | "change-ins"; row: DiffRow }

interface Props {
  commitId: number
  isGerente: boolean
  onOpenProcedure?: (id: number, info: ProcedureOpenInfo) => void
}

// ── Diff Parser ────────────────────────────────────────────────────────────────

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

function flattenForInline(rows: DiffRow[]): InlineRow[] {
  const out: InlineRow[] = []
  for (const row of rows) {
    if (row.kind === "change") {
      out.push({ kind: "change-del", row })
      out.push({ kind: "change-ins", row })
    } else {
      out.push({ kind: row.kind, row })
    }
  }
  return out
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SigDiffEditor({ commitId, isGerente, onOpenProcedure }: Props) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<DiffMode>("split")
  const [showReject, setShowReject] = useState(false)
  const [rejectComment, setRejectComment] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: commit, isLoading } = useQuery<CommitDetail>({
    queryKey: ["sig", "commit", commitId],
    queryFn: async () => (await sigApi.get(`/api/commits/${commitId}`)).data,
  })

  const aprobar = useMutation({
    mutationFn: () => sigApi.post(`/api/commits/${commitId}/aprobar`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sig"] }); setActionError(null) },
    onError: (e: unknown) => setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al aprobar"),
  })

  const rechazar = useMutation({
    mutationFn: () => sigApi.post(`/api/commits/${commitId}/rechazar`, { comentario: rejectComment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig"] })
      setShowReject(false); setRejectComment(""); setActionError(null)
    },
    onError: (e: unknown) => setActionError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al rechazar"),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-500 animate-spin" />
          <span className="text-xs font-mono">Cargando diff...</span>
        </div>
      </div>
    )
  }
  if (!commit) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <span className="text-xs text-zinc-400 font-mono">Commit no encontrado</span>
      </div>
    )
  }

  const isPending  = commit.estado === "PENDIENTE_REVISION"
  const rows       = parseDiff(commit.patch)
  const additions  = rows.filter((r) => r.kind === "insert" || r.kind === "change").length
  const deletions  = rows.filter((r) => r.kind === "delete"  || r.kind === "change").length
  const hasDiff    = !commit.sinCambios && rows.length > 0

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Commit header */}
      <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">

            {/* Breadcrumb — procedimiento code is now a link */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: commit.procedimiento.area.color }} />
              <span className="text-[11px] text-zinc-500 font-mono">{commit.procedimiento.area.nombre}</span>
              <span className="text-[11px] text-zinc-300">/</span>
              {onOpenProcedure ? (
                <button
                  onClick={() => onOpenProcedure(commit.procedimiento.id, {
                    codigo:     commit.procedimiento.codigo,
                    titulo:     commit.procedimiento.titulo,
                    areaColor:  commit.procedimiento.area.color,
                    areaNombre: commit.procedimiento.area.nombre,
                  })}
                  className="text-[11px] text-zinc-600 font-mono font-medium hover:text-helix-accent hover:underline transition-colors"
                  title="Abrir procedimiento"
                >
                  {commit.procedimiento.codigo}
                </button>
              ) : (
                <span className="text-[11px] text-zinc-600 font-mono font-medium">
                  {commit.procedimiento.codigo}
                </span>
              )}
              <span className="text-[11px] text-zinc-300">/</span>
              <GitCommit className="h-3 w-3 text-zinc-400" />
              <span className="text-[11px] text-zinc-500 font-mono">#{String(commit.id).padStart(4, "0")}</span>
            </div>

            <p className="text-sm font-medium text-zinc-900">{commit.mensaje}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-[11px] text-zinc-500 font-mono">{commit.autorNombre}</span>
              {commit.versionDoc && (
                <span className="text-[11px] text-zinc-400 font-mono">doc v{commit.versionDoc}</span>
              )}
              <span className="text-[11px] text-zinc-400 font-mono">
                {new Date(commit.createdAt).toLocaleString("es-CO", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              {hasDiff && (
                <>
                  <span className="text-[11px] text-helix-done font-mono font-semibold">+{additions}</span>
                  <span className="text-[11px] text-helix-accent font-mono font-semibold">−{deletions}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <EstadoBadge estado={commit.estado} />
            {isGerente && isPending && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowReject(true)}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded border border-zinc-300 text-zinc-500 hover:border-helix-accent/50 hover:text-helix-accent transition-colors font-mono"
                >
                  <X className="h-3 w-3" /> Rechazar
                </button>
                <button
                  onClick={() => aprobar.mutate()}
                  disabled={aprobar.isPending}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded bg-helix-done/90 hover:bg-helix-done text-white disabled:opacity-50 transition-colors font-mono"
                >
                  <Check className="h-3 w-3" />
                  {aprobar.isPending ? "Aprobando..." : "Aprobar"}
                </button>
              </div>
            )}
            {!isPending && commit.aprobadoNombre && (
              <span className="text-[11px] text-zinc-400 font-mono">
                {commit.estado === "APROBADO" ? "✓" : "✗"} {commit.aprobadoNombre}
                {commit.aprobadoEn && " · " + new Date(commit.aprobadoEn).toLocaleDateString("es-CO")}
              </span>
            )}
          </div>
        </div>

        {commit.comentarioRevision && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-red-600 font-mono">RECHAZADO — </span>
              <span className="text-[11px] text-zinc-600">{commit.comentarioRevision}</span>
            </div>
          </div>
        )}
        {actionError && <p className="mt-2 text-[11px] text-red-500 font-mono">{actionError}</p>}
      </div>

      {/* Toolbar — Split | Inline | Documento (Split/Inline solo si hay algo que comparar) */}
      <div className="shrink-0 flex items-center justify-between px-4 h-8 border-b border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-0.5">
          {hasDiff && (
            <>
              <button
                onClick={() => setMode("split")}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded transition-colors",
                  mode === "split" ? "bg-zinc-200 text-zinc-800" : "text-zinc-400 hover:text-zinc-700",
                )}
              >
                <SplitSquareHorizontal className="h-3 w-3" /> Split
              </button>
              <button
                onClick={() => setMode("inline")}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded transition-colors",
                  mode === "inline" ? "bg-zinc-200 text-zinc-800" : "text-zinc-400 hover:text-zinc-700",
                )}
              >
                <AlignLeft className="h-3 w-3" /> Inline
              </button>
            </>
          )}
          <button
            onClick={() => setMode("documento")}
            className={cn(
              "flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded transition-colors",
              mode === "documento" || !hasDiff ? "bg-zinc-200 text-zinc-800" : "text-zinc-400 hover:text-zinc-700",
            )}
          >
            <FileText className="h-3 w-3" /> Documento
          </button>
        </div>
        <span className="text-[11px] text-zinc-500">
          {hasDiff
            ? `${rows.length} líneas · +${additions} −${deletions}`
            : commit.sinCambios ? "sin cambios" : "primera versión"
          }
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "documento"
          ? <DocumentoView content={commit.contenidoAgente || commit.contenidoOriginal} />
          : !hasDiff
          ? <NoChangesView onViewDoc={() => setMode("documento")} firstVersion={!commit.sinCambios} />
          : mode === "split"
          ? <SplitDiff rows={rows} />
          : <InlineDiff rows={flattenForInline(rows)} />
        }
      </div>

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-lg border border-zinc-200 p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-zinc-900 font-mono mb-1">
              Rechazar #{String(commitId).padStart(4, "0")}
            </h2>
            <p className="text-[11px] text-zinc-500 mb-4">
              Explica el motivo para que el equipo pueda corregir el documento.
            </p>
            <textarea
              autoFocus
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={4}
              className="w-full bg-zinc-50 border border-zinc-300 rounded px-3 py-2 text-sm text-zinc-900 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-400"
              placeholder="Motivo del rechazo..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowReject(false); setRejectComment("") }}
                className="text-[11px] px-3 py-2 text-zinc-500 hover:text-zinc-700 transition-colors font-mono"
              >
                Cancelar
              </button>
              <button
                disabled={!rejectComment.trim() || rechazar.isPending}
                onClick={() => rechazar.mutate()}
                className="text-[11px] px-4 py-2 rounded bg-helix-accent/80 hover:bg-helix-accent text-white disabled:opacity-40 transition-colors font-mono"
              >
                {rechazar.isPending ? "Rechazando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Documento view — full rendered markdown ────────────────────────────────────

function DocumentoView({ content }: { content: string }) {
  if (!content?.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-white">
        <FileText className="h-8 w-8 text-zinc-200" />
        <p className="text-sm text-zinc-400 font-mono">Sin contenido en este commit</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="max-w-3xl mx-auto px-8 py-6">
        <div className="prose prose-base max-w-none
          prose-headings:font-mono prose-headings:text-zinc-800 prose-headings:font-semibold
          prose-p:text-zinc-600 prose-p:leading-relaxed
          prose-code:text-helix-ai prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px]
          prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200
          prose-strong:text-zinc-700 prose-strong:font-semibold
          prose-li:text-zinc-600 prose-li:marker:text-zinc-400
          prose-hr:border-zinc-200
          prose-blockquote:border-l-zinc-300 prose-blockquote:text-zinc-500
          prose-table:text-xs prose-th:text-zinc-600 prose-td:text-zinc-500
          prose-a:text-helix-ai prose-a:no-underline hover:prose-a:underline"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// ── No changes ─────────────────────────────────────────────────────────────────

function NoChangesView({ onViewDoc, firstVersion }: { onViewDoc: () => void; firstVersion: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 bg-white">
      <div className="h-10 w-10 rounded-full border border-emerald-400/30 flex items-center justify-center">
        <Check className="h-5 w-5 text-emerald-500" />
      </div>
      <div className="text-center">
        <p className="text-sm text-zinc-700 font-mono font-medium">
          {firstVersion ? "Primera versión" : "Sin cambios"}
        </p>
        <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
          {firstVersion
            ? "Este es el primer documento cargado para este procedimiento. No hay versión anterior con la que comparar."
            : "El agente revisó el procedimiento y lo encontró conforme. No se realizaron modificaciones."}
        </p>
      </div>
      <button
        onClick={onViewDoc}
        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors font-mono"
      >
        <FileText className="h-3 w-3" />
        Ver documento completo
      </button>
    </div>
  )
}

// ── Split Diff — single scrolling container keeps panes aligned ───────────────

const LN = "w-10 shrink-0 text-right pr-2.5 text-[11px] select-none"

function SplitDiff({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-[1.65]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex border-b border-zinc-200">
        <div className="flex-1 flex items-center h-7 px-3 bg-zinc-50 border-r border-zinc-200">
          <span className="text-[11px] text-zinc-500 tracking-widest uppercase">Original</span>
        </div>
        <div className="flex-1 flex items-center h-7 px-3 bg-zinc-50">
          <span className="text-[11px] text-helix-ai tracking-widest uppercase">Procesado por IA</span>
        </div>
      </div>

      {rows.map((row, i) => {
        if (row.kind === "hunk") {
          return (
            <div key={i} className="flex bg-sky-50 border-y border-sky-200 h-7 items-center px-3">
              <span className="text-[11px] text-sky-500 font-mono w-full">{row.hunkHeader}</span>
            </div>
          )
        }
        if (row.kind === "context") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 flex items-baseline min-w-0 border-r border-zinc-200">
                <span className={cn(LN, "text-zinc-400")}>{row.leftNo}</span>
                <span className="flex-1 px-2 text-zinc-600 whitespace-pre-wrap break-all">{row.left || " "}</span>
              </div>
              <div className="flex-1 flex items-baseline min-w-0">
                <span className={cn(LN, "text-zinc-400")}>{row.rightNo}</span>
                <span className="flex-1 px-2 text-zinc-600 whitespace-pre-wrap break-all">{row.right || " "}</span>
              </div>
            </div>
          )
        }
        if (row.kind === "change") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 flex items-baseline min-w-0 bg-red-50 border-r border-zinc-200">
                <span className={cn(LN, "text-red-400 bg-red-100")}>{row.leftNo}</span>
                <span className="w-4 shrink-0 text-center text-red-500 font-bold">−</span>
                <span className="flex-1 px-1 text-red-700 whitespace-pre-wrap break-all">{row.left || " "}</span>
              </div>
              <div className="flex-1 flex items-baseline min-w-0 bg-green-50">
                <span className={cn(LN, "text-green-500 bg-green-100")}>{row.rightNo}</span>
                <span className="w-4 shrink-0 text-center text-green-600 font-bold">+</span>
                <span className="flex-1 px-1 text-green-700 whitespace-pre-wrap break-all">{row.right || " "}</span>
              </div>
            </div>
          )
        }
        if (row.kind === "delete") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 flex items-baseline min-w-0 bg-red-50 border-r border-zinc-200">
                <span className={cn(LN, "text-red-400 bg-red-100")}>{row.leftNo}</span>
                <span className="w-4 shrink-0 text-center text-red-500 font-bold">−</span>
                <span className="flex-1 px-1 text-red-700 whitespace-pre-wrap break-all">{row.left || " "}</span>
              </div>
              <div className="flex-1 min-w-0 bg-zinc-50 border-r border-zinc-100" />
            </div>
          )
        }
        if (row.kind === "insert") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 min-w-0 bg-zinc-50 border-r border-zinc-200" />
              <div className="flex-1 flex items-baseline min-w-0 bg-green-50">
                <span className={cn(LN, "text-green-500 bg-green-100")}>{row.rightNo}</span>
                <span className="w-4 shrink-0 text-center text-green-600 font-bold">+</span>
                <span className="flex-1 px-1 text-green-700 whitespace-pre-wrap break-all">{row.right || " "}</span>
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Inline Diff ────────────────────────────────────────────────────────────────

function InlineDiff({ rows }: { rows: InlineRow[] }) {
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-[1.65]">
      <div className="sticky top-0 z-10 flex items-center h-7 px-3 bg-zinc-50 border-b border-zinc-200">
        <span className="text-[11px] text-zinc-500 tracking-widest uppercase">Diff inline</span>
      </div>

      {rows.map((item, i) => {
        const { kind, row } = item
        if (kind === "hunk") {
          return (
            <div key={i} className="flex bg-sky-50 border-y border-sky-200 h-7 items-center px-3">
              <span className="text-[11px] text-sky-500">{row.hunkHeader}</span>
            </div>
          )
        }
        if (kind === "context") {
          return (
            <div key={i} className="flex">
              <span className={cn(LN, "text-zinc-400 w-12")}>{row.leftNo}</span>
              <span className={cn(LN, "text-zinc-400 w-12")}>{row.rightNo}</span>
              <span className="w-5 shrink-0 text-center text-zinc-200"> </span>
              <span className="flex-1 px-2 text-zinc-600 whitespace-pre-wrap break-all">{row.left || " "}</span>
            </div>
          )
        }
        if (kind === "delete") {
          return (
            <div key={i} className="flex bg-red-50">
              <span className={cn(LN, "text-red-400 bg-red-100 w-12")}>{row.leftNo}</span>
              <span className="w-12 shrink-0 bg-zinc-100/60" />
              <span className="w-5 shrink-0 text-center text-red-500 font-bold">−</span>
              <span className="flex-1 px-1 text-red-700 whitespace-pre-wrap break-all">{row.left || " "}</span>
            </div>
          )
        }
        if (kind === "insert") {
          return (
            <div key={i} className="flex bg-green-50">
              <span className="w-12 shrink-0 bg-zinc-100/60" />
              <span className={cn(LN, "text-green-500 bg-green-100 w-12")}>{row.rightNo}</span>
              <span className="w-5 shrink-0 text-center text-green-600 font-bold">+</span>
              <span className="flex-1 px-1 text-green-700 whitespace-pre-wrap break-all">{row.right || " "}</span>
            </div>
          )
        }
        if (kind === "change-del") {
          return (
            <div key={i} className="flex bg-red-50">
              <span className={cn(LN, "text-red-400 bg-red-100 w-12")}>{row.leftNo}</span>
              <span className="w-12 shrink-0 bg-zinc-100/60" />
              <span className="w-5 shrink-0 text-center text-red-500 font-bold">−</span>
              <span className="flex-1 px-1 text-red-700 whitespace-pre-wrap break-all">{row.left || " "}</span>
            </div>
          )
        }
        if (kind === "change-ins") {
          return (
            <div key={i} className="flex bg-green-50">
              <span className="w-12 shrink-0 bg-zinc-100/60" />
              <span className={cn(LN, "text-green-500 bg-green-100 w-12")}>{row.rightNo}</span>
              <span className="w-5 shrink-0 text-center text-green-600 font-bold">+</span>
              <span className="flex-1 px-1 text-green-700 whitespace-pre-wrap break-all">{row.right || " "}</span>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Estado badge ───────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    PENDIENTE_REVISION: "text-amber-600 border-amber-300 bg-amber-50",
    APROBADO:           "text-helix-done border-helix-done/40 bg-helix-done/10",
    RECHAZADO:          "text-helix-accent border-helix-accent/40 bg-helix-accent/10",
  }
  const labels: Record<string, string> = {
    PENDIENTE_REVISION: "pendiente",
    APROBADO: "aprobado",
    RECHAZADO: "rechazado",
  }
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded border font-mono tracking-wide", map[estado] ?? "")}>
      {labels[estado] ?? estado}
    </span>
  )
}
