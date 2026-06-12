import { useState, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { SigExplorer, type ProcedureOpenInfo, type CommitOpenInfo } from "@/components/sig/SigExplorer"
import { SigDiffEditor } from "@/components/sig/SigDiffEditor"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  FileText, GitCommit, Inbox, X,
  GitBranchPlus, Clock, ChevronRight, Check, Circle, Download,
  Pencil, Eye, Sparkles, Save, XCircle, Loader,
} from "lucide-react"
import { SigAiEditorPanel } from "@/components/sig/SigAiEditorPanel"

// ── Types ──────────────────────────────────────────────────────────────────────

type TabIcon = "file" | "diff" | "queue"

interface TabMeta {
  key: string
  icon: TabIcon
  title: string
  subtitle?: string
}

type ActiveView =
  | { kind: "welcome" }
  | { kind: "procedure"; id: number }
  | { kind: "commit"; id: number }
  | { kind: "queue" }

// ── SigPage ────────────────────────────────────────────────────────────────────

export function SigPage() {
  const user = useAuthStore((s) => s.user)
  const isGerente = user?.role === "admin" || user?.role === "gerente"

  const [openTabs, setOpenTabs] = useState<TabMeta[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [views, setViews] = useState<Record<string, ActiveView>>({})

  const { data: pendientes = [] } = useQuery<unknown[]>({
    queryKey: ["sig", "commits", "pendientes"],
    queryFn: async () => (await sigApi.get("/api/commits/pendientes")).data,
    enabled: isGerente,
    refetchInterval: 30_000,
  })

  // ── Tab management ───────────────────────────────────────────────────────────

  const openTab = useCallback((view: ActiveView, meta: TabMeta) => {
    setViews((v) => ({ ...v, [meta.key]: view }))
    setOpenTabs((tabs) => {
      if (tabs.find((t) => t.key === meta.key)) return tabs
      return [...tabs, meta]
    })
    setActiveKey(meta.key)
  }, [])

  const closeTab = useCallback((key: string) => {
    setOpenTabs((tabs) => {
      const idx = tabs.findIndex((t) => t.key === key)
      const next = tabs.filter((t) => t.key !== key)
      if (activeKey === key) {
        const nextActive = next[idx] ?? next[idx - 1] ?? null
        setActiveKey(nextActive?.key ?? null)
      }
      return next
    })
    setViews((v) => { const n = { ...v }; delete n[key]; return n })
  }, [activeKey])

  // ── Open handlers (passed to Explorer) ───────────────────────────────────────

  const openProcedure = useCallback((id: number, info: ProcedureOpenInfo) => {
    const key = `proc-${id}`
    openTab(
      { kind: "procedure", id },
      { key, icon: "file", title: info.codigo, subtitle: info.titulo },
    )
  }, [openTab])

  const openCommit = useCallback((id: number, info: CommitOpenInfo) => {
    const key = `commit-${id}`
    openTab(
      { kind: "commit", id },
      { key, icon: "diff", title: `#${String(id).padStart(4, "0")}`, subtitle: info.mensaje },
    )
  }, [openTab])

  const openQueue = useCallback(() => {
    openTab({ kind: "queue" }, { key: "queue", icon: "queue", title: "Cola de revisión" })
  }, [openTab])

  // ── Derived state ─────────────────────────────────────────────────────────────

  const activeView: ActiveView = (activeKey && views[activeKey]) || { kind: "welcome" }
  const pendingCount = pendientes.length

  return (
    <div className="h-screen flex flex-col bg-white text-zinc-900 overflow-hidden select-none">

      {/* Title bar */}
      <TitleBar
        isGerente={isGerente}
        pendingCount={pendingCount}
        onOpenQueue={openQueue}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: explorer */}
        <SigExplorer
          activeKey={activeKey}
          isGerente={isGerente}
          pendingCount={pendingCount}
          onSelectProcedure={openProcedure}
          onSelectCommit={openCommit}
          onOpenQueue={openQueue}
        />

        {/* Right: editor area */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Tab bar */}
          {openTabs.length > 0 && (
            <TabBar
              tabs={openTabs}
              activeKey={activeKey}
              onActivate={setActiveKey}
              onClose={closeTab}
            />
          )}

          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            {activeView.kind === "welcome" && <WelcomeView />}
            {activeView.kind === "procedure" && (
              <ProcedureFileView id={activeView.id} onOpenCommit={openCommit} />
            )}
            {activeView.kind === "commit" && (
              <SigDiffEditor commitId={activeView.id} isGerente={isGerente} />
            )}
            {activeView.kind === "queue" && (
              <ReviewQueueView onOpenCommit={openCommit} />
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar pendingCount={pendingCount} isGerente={isGerente} activeView={activeView} />
    </div>
  )
}

// ── Title bar ──────────────────────────────────────────────────────────────────

function TitleBar({
  isGerente, pendingCount, onOpenQueue,
}: { isGerente: boolean; pendingCount: number; onOpenQueue: () => void }) {
  return (
    <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-zinc-200 bg-white">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold tracking-[0.18em] text-helix-accent font-mono uppercase">SIG</span>
        <div className="h-3 w-px bg-helix-accent/20" />
        <span className="text-[11px] text-zinc-500">Sistema Integrado de Gestión</span>
      </div>
      {isGerente && pendingCount > 0 && (
        <button
          onClick={onOpenQueue}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors font-mono"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

const TAB_ICON: Record<TabIcon, React.ReactNode> = {
  file:  <FileText className="h-3.5 w-3.5 text-zinc-400" />,
  diff:  <GitCommit className="h-3.5 w-3.5 text-helix-ai/80" />,
  queue: <Inbox className="h-3.5 w-3.5 text-amber-500/70" />,
}

function TabBar({
  tabs, activeKey, onActivate, onClose,
}: {
  tabs: TabMeta[]
  activeKey: string | null
  onActivate: (key: string) => void
  onClose: (key: string) => void
}) {
  return (
    <div className="flex items-end shrink-0 bg-zinc-50 border-b border-zinc-200 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey
        return (
          <div
            key={tab.key}
            className={cn(
              "flex items-center gap-1.5 px-3 h-9 shrink-0 border-r border-zinc-200 cursor-pointer group transition-colors relative",
              isActive
                ? "bg-white text-zinc-900"
                : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
            )}
            onClick={() => onActivate(tab.key)}
          >
            {/* Active indicator */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-px bg-helix-accent" />
            )}

            {TAB_ICON[tab.icon]}
            <span className="text-[12px] font-mono whitespace-nowrap max-w-[140px] truncate">
              {tab.title}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.key) }}
              className={cn(
                "h-4 w-4 rounded flex items-center justify-center transition-colors ml-0.5",
                isActive
                  ? "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200"
                  : "text-transparent group-hover:text-zinc-400 hover:!text-zinc-600 hover:bg-zinc-200",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Welcome view ───────────────────────────────────────────────────────────────

function WelcomeView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-12 w-12 rounded-lg border border-helix-accent/20 flex items-center justify-center bg-zinc-50">
          <GitBranchPlus className="h-6 w-6 text-helix-accent/40" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-700 font-mono">Sistema Integrado de Gestión</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Selecciona un procedimiento o commit en el explorador
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <ChevronRight className="h-3 w-3" />
          <span>Clic en un área para expandir</span>
        </div>
        <div className="flex items-center gap-2">
          <ChevronRight className="h-3 w-3" />
          <span>Clic en un procedimiento para ver el documento</span>
        </div>
        <div className="flex items-center gap-2">
          <ChevronRight className="h-3 w-3" />
          <span>Clic en un commit para ver el diff</span>
        </div>
      </div>
    </div>
  )
}

// ── Procedure file view ────────────────────────────────────────────────────────

interface ProcDetail {
  id: number
  codigo: string
  titulo: string
  descripcion: string | null
  estado: "BORRADOR" | "VIGENTE" | "OBSOLETO"
  area: { nombre: string; color: string }
  commits: Array<{
    id: number
    mensaje: string
    autorNombre: string
    estado: "PENDIENTE_REVISION" | "APROBADO" | "RECHAZADO"
    sinCambios: boolean
    versionDoc: string | null
    createdAt: string
  }>
}

interface CommitFull {
  id: number
  contenidoAgente: string
}

type EditorMode = "view" | "edit" | "ai"

const ESTADO_PROC_BADGE: Record<string, string> = {
  BORRADOR: "text-zinc-500 border-zinc-300 bg-zinc-100",
  VIGENTE:  "text-helix-done border-helix-done/40 bg-helix-done/10",
  OBSOLETO: "text-zinc-400 border-zinc-200 bg-zinc-50",
}

const COMMIT_STATE_DOT: Record<string, string> = {
  PENDIENTE_REVISION: "fill-amber-400 text-amber-400",
  APROBADO:           "fill-helix-done text-helix-done",
  RECHAZADO:          "fill-helix-accent text-helix-accent",
}

function ProcedureFileView({
  id, onOpenCommit,
}: { id: number; onOpenCommit: (id: number, info: CommitOpenInfo) => void }) {
  const [editorMode, setEditorMode] = useState<EditorMode>("view")
  const [editContent, setEditContent] = useState("")
  const [commitMsg, setCommitMsg] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const qc = useQueryClient()

  const { data: proc, isLoading: procLoading } = useQuery<ProcDetail>({
    queryKey: ["sig", "procedimiento", id],
    queryFn: async () => (await sigApi.get(`/api/procedimientos/${id}`)).data,
  })

  const latestApproved = proc?.commits.find((c) => c.estado === "APROBADO")

  const { data: content } = useQuery<CommitFull>({
    queryKey: ["sig", "commit", latestApproved?.id],
    queryFn: async () => (await sigApi.get(`/api/commits/${latestApproved!.id}`)).data,
    enabled: !!latestApproved,
  })

  // Cuando entra al modo edición, prefill con el contenido actual
  function enterEdit() {
    setEditContent(content?.contenidoAgente ?? "")
    setCommitMsg("")
    setSaveError("")
    setEditorMode("edit")
  }

  async function handleSaveEdit() {
    if (!proc || !commitMsg.trim() || saving) return
    setSaving(true)
    setSaveError("")
    try {
      await sigApi.post("/api/commits", {
        procedimientoId: id,
        contenidoOriginal: content?.contenidoAgente ?? "",
        contenidoAgente: editContent,
        mensaje: commitMsg,
      })
      qc.invalidateQueries({ queryKey: ["sig", "procedimiento", id] })
      setEditorMode("view")
    } catch (e: any) {
      setSaveError(e?.response?.data?.error ?? "Error al guardar la versión.")
    } finally {
      setSaving(false)
    }
  }

  if (procLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-500 animate-spin" />
          <span className="text-xs font-mono">Cargando...</span>
        </div>
      </div>
    )
  }
  if (!proc) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <span className="text-xs text-zinc-400 font-mono">Procedimiento no encontrado</span>
      </div>
    )
  }

  const currentContent = content?.contenidoAgente ?? ""
  const procArea = proc.area

  return (
    <div className="flex h-full bg-white overflow-hidden">

      {/* Document area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Breadcrumb bar */}
        <div className="shrink-0 flex items-center gap-1.5 px-4 h-8 border-b border-zinc-200 bg-zinc-50">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: procArea.color }} />
          <span className="text-[11px] text-zinc-500 font-mono">{procArea.nombre}</span>
          <ChevronRight className="h-3 w-3 text-helix-accent/30" />
          <FileText className="h-3 w-3 text-zinc-400" />
          <span className="text-[11px] text-zinc-700 font-mono font-medium">{proc.codigo}</span>
          <div className="ml-1">
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-mono", ESTADO_PROC_BADGE[proc.estado])}>
              {proc.estado.toLowerCase()}
            </span>
          </div>

          {/* Editor mode controls */}
          <div className="ml-auto flex items-center gap-1">
            {editorMode === "view" && currentContent && (
              <>
                <button
                  onClick={enterEdit}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors font-mono"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  onClick={() => setEditorMode("ai")}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors font-mono"
                >
                  <Sparkles className="h-3 w-3" />
                  Editar con IA
                </button>
              </>
            )}
            {(editorMode === "edit" || editorMode === "ai") && (
              <button
                onClick={() => setEditorMode("view")}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors font-mono"
              >
                <Eye className="h-3 w-3" />
                Vista
              </button>
            )}
          </div>
        </div>

        {/* AI Editor mode */}
        {editorMode === "ai" && (
          <div className="flex-1 overflow-hidden">
            <SigAiEditorPanel
              procedimientoId={id}
              procedureCode={proc.codigo}
              area={procArea.nombre}
              contenidoActual={currentContent}
              onCommitCreated={() => setEditorMode("view")}
            />
          </div>
        )}

        {/* Manual edit mode */}
        {editorMode === "edit" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-zinc-200 bg-amber-50">
              <Pencil className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] text-amber-600 font-mono">Modo edición — los cambios crearán una nueva versión para revisión</span>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 font-mono text-[12px] text-zinc-700 p-6 resize-none focus:outline-none bg-white"
              spellCheck={false}
            />
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-zinc-200 bg-zinc-50">
              <input
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Mensaje descriptivo de los cambios…"
                className="flex-1 text-[12px] font-mono px-3 py-1.5 border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-helix-accent text-zinc-700 bg-white"
              />
              {saveError && <span className="text-[10px] text-red-500 font-mono">{saveError}</span>}
              <button
                onClick={handleSaveEdit}
                disabled={!commitMsg.trim() || saving}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-medium transition-all",
                  commitMsg.trim() && !saving
                    ? "bg-helix-accent text-white hover:opacity-90"
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                )}
              >
                {saving ? <><Loader className="h-3 w-3 animate-spin" /> Guardando…</> : <><Save className="h-3 w-3" /> Guardar versión</>}
              </button>
              <button onClick={() => setEditorMode("view")} className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* View mode */}
        {editorMode === "view" && (
          <div className="flex-1 overflow-auto px-8 py-6">
            <div className="max-w-3xl mx-auto">

              {/* Header */}
              <div className="mb-8">
                <h1 className="text-xl font-bold text-zinc-900 font-mono mb-1">{proc.codigo}</h1>
                <p className="text-sm text-zinc-600">{proc.titulo}</p>
                {proc.descripcion && (
                  <p className="text-xs text-zinc-400 mt-2">{proc.descripcion}</p>
                )}
              </div>

              {/* Document content */}
              {currentContent ? (
                <div className="prose prose-sm max-w-none
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
                    {currentContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-8 w-8 rounded border border-zinc-200 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-zinc-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-zinc-500 font-mono">Sin contenido publicado</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {proc.commits.length === 0
                        ? "Aún no hay commits. Usa NetVault para enviar el primer análisis."
                        : "Hay commits en revisión. Aprueba uno para publicar el contenido."
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: commit history */}
      <div className="w-64 shrink-0 border-l border-zinc-200 flex flex-col bg-zinc-50">
        <div className="flex items-center gap-2 px-3 h-7 border-b border-zinc-200 shrink-0">
          <Clock className="h-3 w-3 text-helix-ai/50" />
          <span className="text-[10px] text-helix-ai/60 font-mono uppercase tracking-widest">
            Historial
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {proc.commits.length === 0 && (
            <div className="px-4 py-6 text-[11px] text-zinc-400 italic text-center">
              Sin commits aún
            </div>
          )}
          {proc.commits.map((commit) => (
            <CommitHistoryRow
              key={commit.id}
              commit={commit}
              procCodigo={proc.codigo}
              onOpen={() => onOpenCommit(commit.id, { mensaje: commit.mensaje, codigo: proc.codigo })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Commit history row (con botón PDF para aprobados) ─────────────────────────

function CommitHistoryRow({
  commit, procCodigo, onOpen,
}: {
  commit: ProcDetail["commits"][0]
  procCodigo: string
  onOpen: () => void
}) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf(e: React.MouseEvent) {
    e.stopPropagation()
    setDownloading(true)
    try {
      const res = await api.get(`/api/sig/pdf/commit/${commit.id}`, { responseType: "blob" })
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${procCodigo}_v${commit.versionDoc || "1"}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silencioso — el usuario puede reintentar
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="border-b border-zinc-200/60 group">
      <button
        onClick={onOpen}
        className="w-full text-left px-3 py-2 hover:bg-zinc-100 transition-colors"
      >
        <div className="flex items-start gap-2">
          <Circle
            className={cn("h-2 w-2 mt-0.5 shrink-0 fill-current", COMMIT_STATE_DOT[commit.estado])}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-zinc-600 group-hover:text-zinc-900 transition-colors truncate leading-tight">
              {commit.mensaje}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-zinc-400 font-mono">#{String(commit.id).padStart(4, "0")}</span>
              <span className="text-[9px] text-zinc-400">·</span>
              <span className="text-[9px] text-zinc-400 font-mono">
                {new Date(commit.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
              </span>
            </div>
          </div>
          {commit.estado === "APROBADO" && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              title="Descargar PDF"
              className="h-5 w-5 rounded flex items-center justify-center text-zinc-400 hover:text-helix-accent hover:bg-helix-accent/10 transition-colors disabled:opacity-40 shrink-0"
            >
              {downloading
                ? <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-500 animate-spin" />
                : <Download className="h-3 w-3" />
              }
            </button>
          )}
        </div>
      </button>
    </div>
  )
}

// ── Review queue view ──────────────────────────────────────────────────────────

interface PendingCommit {
  id: number
  mensaje: string
  autorNombre: string
  createdAt: string
  procedimiento: {
    codigo: string
    titulo: string
    area: { nombre: string; color: string }
  }
}

function ReviewQueueView({
  onOpenCommit,
}: { onOpenCommit: (id: number, info: CommitOpenInfo) => void }) {
  const { data: commits = [], isLoading } = useQuery<PendingCommit[]>({
    queryKey: ["sig", "commits", "pendientes-detail"],
    queryFn: async () => (await sigApi.get("/api/commits?estado=PENDIENTE_REVISION")).data,
    refetchInterval: 30_000,
  })

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-7 border-b border-zinc-200 bg-zinc-50">
        <Inbox className="h-3 w-3 text-amber-500/70" />
        <span className="text-[11px] text-zinc-600 font-mono">Cola de revisión</span>
        {commits.length > 0 && (
          <>
            <div className="mx-1 h-3 w-px bg-zinc-200" />
            <span className="text-[11px] text-amber-500 font-mono font-semibold">{commits.length} pendiente{commits.length !== 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-zinc-400 py-4">
            <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-500 animate-spin" />
            <span className="text-xs font-mono">Cargando...</span>
          </div>
        )}

        {!isLoading && commits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-10 w-10 rounded-full border border-emerald-400/30 flex items-center justify-center">
              <Check className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-700 font-mono">Sin pendientes</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Todos los commits han sido revisados
              </p>
            </div>
          </div>
        )}

        {commits.length > 0 && (
          <div className="max-w-2xl">
            <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest mb-3">
              Pendientes de revisión
            </p>
            <div className="space-y-1">
              {commits.map((commit) => (
                <button
                  key={commit.id}
                  onClick={() => onOpenCommit(commit.id, {
                    mensaje: commit.mensaje,
                    codigo: commit.procedimiento.codigo,
                  })}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 rounded border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 transition-all group"
                >
                  {/* Area color */}
                  <span
                    className="h-8 w-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: commit.procedimiento.area.color }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] text-zinc-500 font-mono">{commit.procedimiento.codigo}</span>
                      <span className="text-[10px] text-zinc-300">·</span>
                      <span className="text-[11px] text-zinc-400">{commit.procedimiento.area.nombre}</span>
                    </div>
                    <p className="text-[12px] text-zinc-600 group-hover:text-zinc-900 transition-colors truncate font-mono">
                      {commit.mensaje}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-400">por {commit.autorNombre}</span>
                      <span className="text-[10px] text-zinc-300">·</span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(commit.createdAt).toLocaleString("es-CO", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-amber-500/70 font-mono">
                      #{String(commit.id).padStart(4, "0")}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status bar ─────────────────────────────────────────────────────────────────

function StatusBar({
  pendingCount, isGerente, activeView,
}: { pendingCount: number; isGerente: boolean; activeView: ActiveView }) {
  const viewLabel =
    activeView.kind === "procedure" ? "procedure"
    : activeView.kind === "commit" ? "diff"
    : activeView.kind === "queue" ? "queue"
    : ""

  return (
    <div className="h-5 shrink-0 flex items-center gap-4 px-4 border-t border-zinc-200 bg-zinc-50">
      <span className="text-[10px] text-helix-accent/60 font-mono font-bold">SIG</span>
      {viewLabel && (
        <>
          <div className="h-3 w-px bg-zinc-200" />
          <span className="text-[10px] text-zinc-400 font-mono">{viewLabel}</span>
        </>
      )}
      {isGerente && pendingCount > 0 && (
        <>
          <div className="h-3 w-px bg-zinc-200" />
          <span className="text-[10px] text-amber-500 font-mono">
            ● {pendingCount} commit{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""}
          </span>
        </>
      )}
    </div>
  )
}
