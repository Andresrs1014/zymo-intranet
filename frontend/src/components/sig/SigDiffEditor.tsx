import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sigApi } from "@/lib/sigApi"
import { cn } from "@/lib/utils"
import {
  GitCommit, Check, X, AlertCircle,
  SplitSquareHorizontal, AlignLeft,
} from "lucide-react"

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

type DiffMode = "split" | "inline"

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

export function SigDiffEditor({ commitId, isGerente }: Props) {
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
    onError: (e: any) => setActionError(e?.response?.data?.error ?? "Error al aprobar"),
  })

  const rechazar = useMutation({
    mutationFn: () => sigApi.post(`/api/commits/${commitId}/rechazar`, { comentario: rejectComment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sig"] })
      setShowReject(false); setRejectComment(""); setActionError(null)
    },
    onError: (e: any) => setActionError(e?.response?.data?.error ?? "Error al rechazar"),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0b]">
        <div className="flex items-center gap-2 text-zinc-600">
          <div className="h-3 w-3 rounded-full border border-zinc-700 border-t-zinc-500 animate-spin" />
          <span className="text-xs font-mono">Cargando diff...</span>
        </div>
      </div>
    )
  }
  if (!commit) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0b]">
        <span className="text-xs text-zinc-600 font-mono">Commit no encontrado</span>
      </div>
    )
  }

  const isPending = commit.estado === "PENDIENTE_REVISION"
  const rows = parseDiff(commit.patch)
  const additions = rows.filter((r) => r.kind === "insert" || r.kind === "change").length
  const deletions = rows.filter((r) => r.kind === "delete" || r.kind === "change").length

  return (
    <div className="flex flex-col h-full bg-[#0a0a0b]">

      {/* Commit header */}
      <div className="shrink-0 border-b border-zinc-800/80 bg-[#111113] px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: commit.procedimiento.area.color }} />
              <span className="text-[11px] text-zinc-500 font-mono">{commit.procedimiento.area.nombre}</span>
              <span className="text-[11px] text-zinc-700">/</span>
              <span className="text-[11px] text-zinc-400 font-mono font-medium">{commit.procedimiento.codigo}</span>
              <span className="text-[11px] text-zinc-700">/</span>
              <GitCommit className="h-3 w-3 text-zinc-600" />
              <span className="text-[11px] text-zinc-500 font-mono">#{String(commit.id).padStart(4, "0")}</span>
            </div>
            <p className="text-sm font-medium text-zinc-100">{commit.mensaje}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-[11px] text-zinc-600 font-mono">{commit.autorNombre}</span>
              {commit.versionDoc && (
                <span className="text-[11px] text-zinc-700 font-mono">doc v{commit.versionDoc}</span>
              )}
              <span className="text-[11px] text-zinc-700 font-mono">
                {new Date(commit.createdAt).toLocaleString("es-CO", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              {!commit.sinCambios && (
                <>
                  <span className="text-[11px] text-[#1f9d6a] font-mono font-semibold">+{additions}</span>
                  <span className="text-[11px] text-[#ef3340] font-mono font-semibold">−{deletions}</span>
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
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:border-[#ef3340]/50 hover:text-[#ef3340] transition-colors font-mono"
                >
                  <X className="h-3 w-3" /> Rechazar
                </button>
                <button
                  onClick={() => aprobar.mutate()}
                  disabled={aprobar.isPending}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded bg-[#1f9d6a]/90 hover:bg-[#1f9d6a] text-white disabled:opacity-50 transition-colors font-mono"
                >
                  <Check className="h-3 w-3" />
                  {aprobar.isPending ? "Aprobando..." : "Aprobar"}
                </button>
              </div>
            )}
            {!isPending && commit.aprobadoNombre && (
              <span className="text-[10px] text-zinc-600 font-mono">
                {commit.estado === "APROBADO" ? "✓" : "✗"} {commit.aprobadoNombre}
                {commit.aprobadoEn && " · " + new Date(commit.aprobadoEn).toLocaleDateString("es-CO")}
              </span>
            )}
          </div>
        </div>

        {commit.comentarioRevision && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-500/20 bg-[#130407] px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-semibold text-red-400 font-mono">RECHAZADO — </span>
              <span className="text-[11px] text-zinc-400">{commit.comentarioRevision}</span>
            </div>
          </div>
        )}
        {actionError && <p className="mt-2 text-[11px] text-red-400 font-mono">{actionError}</p>}
      </div>

      {/* Diff toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 h-8 border-b border-zinc-800/60 bg-[#0d0d0f]">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMode("split")}
            className={cn(
              "flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded transition-colors font-mono",
              mode === "split" ? "bg-zinc-800 text-zinc-200" : "text-zinc-600 hover:text-zinc-400",
            )}
          >
            <SplitSquareHorizontal className="h-3 w-3" /> Split
          </button>
          <button
            onClick={() => setMode("inline")}
            className={cn(
              "flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded transition-colors font-mono",
              mode === "inline" ? "bg-zinc-800 text-zinc-200" : "text-zinc-600 hover:text-zinc-400",
            )}
          >
            <AlignLeft className="h-3 w-3" /> Inline
          </button>
        </div>
        <span className="text-[10px] text-zinc-700 font-mono">
          {rows.length} líneas · {additions} adiciones · {deletions} eliminaciones
        </span>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-hidden">
        {commit.sinCambios
          ? <NoChangesView />
          : mode === "split"
          ? <SplitDiff rows={rows} />
          : <InlineDiff rows={flattenForInline(rows)} />
        }
      </div>

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#111113] rounded-lg border border-zinc-800 p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-200 font-mono mb-1">
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
              className="w-full bg-[#0a0a0b] border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-zinc-600 placeholder:text-zinc-700"
              placeholder="Motivo del rechazo..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowReject(false); setRejectComment("") }}
                className="text-[11px] px-3 py-2 text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
              >
                Cancelar
              </button>
              <button
                disabled={!rejectComment.trim() || rechazar.isPending}
                onClick={() => rechazar.mutate()}
                className="text-[11px] px-4 py-2 rounded bg-[#ef3340]/80 hover:bg-[#ef3340] text-white disabled:opacity-40 transition-colors font-mono"
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

// ── No changes ─────────────────────────────────────────────────────────────────

function NoChangesView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <div className="h-10 w-10 rounded-full border border-emerald-500/30 flex items-center justify-center">
        <Check className="h-5 w-5 text-emerald-500" />
      </div>
      <div className="text-center">
        <p className="text-sm text-zinc-300 font-mono font-medium">Sin cambios</p>
        <p className="text-[11px] text-zinc-600 mt-1 max-w-xs">
          El agente revisó el procedimiento y lo encontró conforme. No se realizaron modificaciones.
        </p>
      </div>
    </div>
  )
}

// ── Split Diff — single scrolling container keeps panes aligned ───────────────

const LN = "w-10 shrink-0 text-right pr-2.5 text-[11px] select-none"

function SplitDiff({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-[1.65]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex border-b border-zinc-800/80">
        <div className="flex-1 flex items-center h-7 px-3 bg-[#0f0f11] border-r border-zinc-800/60">
          <span className="text-[10px] text-zinc-600 tracking-widest uppercase">Original</span>
        </div>
        <div className="flex-1 flex items-center h-7 px-3 bg-[#0f0f11]">
          <span className="text-[10px] text-[#00a8c8] tracking-widest uppercase">Procesado por IA</span>
        </div>
      </div>

      {rows.map((row, i) => {
        // Hunk header — spans full width
        if (row.kind === "hunk") {
          return (
            <div key={i} className="flex bg-[#001a22] border-y border-[#00a8c8]/12 h-7 items-center px-3">
              <span className="text-[10px] text-[#00a8c8]/60 font-mono col-span-2 w-full">{row.hunkHeader}</span>
            </div>
          )
        }

        // Context line
        if (row.kind === "context") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 flex items-baseline min-w-0 border-r border-zinc-800/30">
                <span className={cn(LN, "text-zinc-700")}>{row.leftNo}</span>
                <span className="flex-1 px-2 text-zinc-400 whitespace-pre-wrap break-all">{row.left || " "}</span>
              </div>
              <div className="flex-1 flex items-baseline min-w-0">
                <span className={cn(LN, "text-zinc-700")}>{row.rightNo}</span>
                <span className="flex-1 px-2 text-zinc-400 whitespace-pre-wrap break-all">{row.right || " "}</span>
              </div>
            </div>
          )
        }

        // Change line — both sides have content
        if (row.kind === "change") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 flex items-baseline min-w-0 bg-[#1a0608] border-r border-zinc-800/30">
                <span className={cn(LN, "text-[#ef3340]/50 bg-[#130407]")}>{row.leftNo}</span>
                <span className="w-4 shrink-0 text-center text-[#ef3340]/70 font-bold">−</span>
                <span className="flex-1 px-1 text-[#fca5a5] whitespace-pre-wrap break-all">{row.left || " "}</span>
              </div>
              <div className="flex-1 flex items-baseline min-w-0 bg-[#061410]">
                <span className={cn(LN, "text-[#1f9d6a]/50 bg-[#04100d]")}>{row.rightNo}</span>
                <span className="w-4 shrink-0 text-center text-[#1f9d6a]/70 font-bold">+</span>
                <span className="flex-1 px-1 text-[#86efac] whitespace-pre-wrap break-all">{row.right || " "}</span>
              </div>
            </div>
          )
        }

        // Delete line — only left has content, right is empty slot
        if (row.kind === "delete") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 flex items-baseline min-w-0 bg-[#130407] border-r border-zinc-800/30">
                <span className={cn(LN, "text-[#ef3340]/50 bg-[#1a0608]")}>{row.leftNo}</span>
                <span className="w-4 shrink-0 text-center text-[#ef3340]/70 font-bold">−</span>
                <span className="flex-1 px-1 text-[#fca5a5] whitespace-pre-wrap break-all">{row.left || " "}</span>
              </div>
              <div className="flex-1 min-w-0 bg-[#0f0f11] border-r border-zinc-800/10" />
            </div>
          )
        }

        // Insert line — left is empty slot, right has content
        if (row.kind === "insert") {
          return (
            <div key={i} className="flex">
              <div className="flex-1 min-w-0 bg-[#0f0f11] border-r border-zinc-800/30" />
              <div className="flex-1 flex items-baseline min-w-0 bg-[#04100d]">
                <span className={cn(LN, "text-[#1f9d6a]/50 bg-[#061410]")}>{row.rightNo}</span>
                <span className="w-4 shrink-0 text-center text-[#1f9d6a]/70 font-bold">+</span>
                <span className="flex-1 px-1 text-[#86efac] whitespace-pre-wrap break-all">{row.right || " "}</span>
              </div>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

// ── Inline Diff — pre-flattened rows, change = del row then ins row ────────────

function InlineDiff({ rows }: { rows: InlineRow[] }) {
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-[1.65]">
      <div className="sticky top-0 z-10 flex items-center h-7 px-3 bg-[#0f0f11] border-b border-zinc-800/80">
        <span className="text-[10px] text-zinc-600 tracking-widest uppercase">Diff inline</span>
      </div>

      {rows.map((item, i) => {
        const { kind, row } = item

        if (kind === "hunk") {
          return (
            <div key={i} className="flex bg-[#001a22] border-y border-[#00a8c8]/12 h-7 items-center px-3">
              <span className="text-[10px] text-[#00a8c8]/60">{row.hunkHeader}</span>
            </div>
          )
        }

        if (kind === "context") {
          return (
            <div key={i} className="flex">
              <span className={cn(LN, "text-zinc-700 w-12")}>{row.leftNo}</span>
              <span className={cn(LN, "text-zinc-700 w-12")}>{row.rightNo}</span>
              <span className="w-5 shrink-0 text-center text-zinc-800"> </span>
              <span className="flex-1 px-2 text-zinc-400 whitespace-pre-wrap break-all">{row.left || " "}</span>
            </div>
          )
        }

        if (kind === "delete") {
          return (
            <div key={i} className="flex bg-[#130407]">
              <span className={cn(LN, "text-[#ef3340]/50 bg-[#1a0608] w-12")}>{row.leftNo}</span>
              <span className="w-12 shrink-0 bg-[#0a0a0b]/30" />
              <span className="w-5 shrink-0 text-center text-[#ef3340]/80 font-bold">−</span>
              <span className="flex-1 px-1 text-[#fca5a5] whitespace-pre-wrap break-all">{row.left || " "}</span>
            </div>
          )
        }

        if (kind === "insert") {
          return (
            <div key={i} className="flex bg-[#04100d]">
              <span className="w-12 shrink-0 bg-[#0a0a0b]/30" />
              <span className={cn(LN, "text-[#1f9d6a]/50 bg-[#061410] w-12")}>{row.rightNo}</span>
              <span className="w-5 shrink-0 text-center text-[#1f9d6a]/80 font-bold">+</span>
              <span className="flex-1 px-1 text-[#86efac] whitespace-pre-wrap break-all">{row.right || " "}</span>
            </div>
          )
        }

        if (kind === "change-del") {
          return (
            <div key={i} className="flex bg-[#130407]">
              <span className={cn(LN, "text-[#ef3340]/50 bg-[#1a0608] w-12")}>{row.leftNo}</span>
              <span className="w-12 shrink-0 bg-[#0a0a0b]/30" />
              <span className="w-5 shrink-0 text-center text-[#ef3340]/80 font-bold">−</span>
              <span className="flex-1 px-1 text-[#fca5a5] whitespace-pre-wrap break-all">{row.left || " "}</span>
            </div>
          )
        }

        if (kind === "change-ins") {
          return (
            <div key={i} className="flex bg-[#04100d]">
              <span className="w-12 shrink-0 bg-[#0a0a0b]/30" />
              <span className={cn(LN, "text-[#1f9d6a]/50 bg-[#061410] w-12")}>{row.rightNo}</span>
              <span className="w-5 shrink-0 text-center text-[#1f9d6a]/80 font-bold">+</span>
              <span className="flex-1 px-1 text-[#86efac] whitespace-pre-wrap break-all">{row.right || " "}</span>
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
    PENDIENTE_REVISION: "text-[#FFD700] border-[#FFD700]/40 bg-[#FFD700]/8",
    APROBADO:           "text-[#1f9d6a] border-[#1f9d6a]/40 bg-[#1f9d6a]/8",
    RECHAZADO:          "text-[#ef3340] border-[#ef3340]/40 bg-[#ef3340]/8",
  }
  const labels: Record<string, string> = {
    PENDIENTE_REVISION: "pendiente",
    APROBADO: "aprobado",
    RECHAZADO: "rechazado",
  }
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded border font-mono tracking-wide", map[estado] ?? "")}>
      {labels[estado] ?? estado}
    </span>
  )
}
