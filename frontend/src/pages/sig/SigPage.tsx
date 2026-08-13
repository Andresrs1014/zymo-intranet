import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useAuthStore } from "@/store/authStore"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { SigExplorer, type ProcedureOpenInfo, type CommitOpenInfo } from "@/components/sig/SigExplorer"
import { SigDiffEditor } from "@/components/sig/SigDiffEditor"
import { SigDiffMobileView } from "@/components/sig/SigDiffMobileView"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  FileText, GitCommit, Inbox, X,
  GitBranchPlus, GitBranch, Clock, ChevronRight, ChevronLeft, Check, Circle, Download,
  Pencil, Eye, Sparkles, Save, XCircle, Loader, AlertCircle,
  ClipboardCheck, RefreshCw, History, UploadCloud, BookOpen, Paperclip, Users, Database,
} from "lucide-react"
import { SigAiEditorPanel } from "@/components/sig/SigAiEditorPanel"
import { MermaidDiagram } from "@/components/reportes/MermaidDiagram"
import { useRunAnalysis } from "@/components/sig/SigAnalisisPanel"
import { SigRubricaPanel } from "@/components/sig/SigRubricaPanel"
import { SigRagPanel } from "@/components/sig/SigRagPanel"
import {
  SigAnalisisSyncView, AnalisisDetailModal, TIPO_ICON, TIPO_LABEL, type HistorialItem,
} from "@/components/sig/SigAnalisisSyncView"
import { SigAnalisisQueue } from "@/components/sig/SigAnalisisQueue"
import { SigAnalisisInspector } from "@/components/sig/SigAnalisisInspector"
import { SigCargarModal, type PreselectedProc } from "@/components/sig/SigCargarModal"
import { SigInstructivosPanel, type SigInstructivo, InstructivoArchivoView, PROSE as INST_PROSE } from "@/components/sig/SigInstructivosPanel"
import { SigProcedimientoCargosPanel } from "@/components/sig/SigProcedimientoCargosPanel"
import { SigAnexoPanel } from "@/components/sig/SigAnexoPanel"

// ── Types ──────────────────────────────────────────────────────────────────────

type TabIcon = "file" | "diff" | "queue" | "rubrica" | "sync" | "rag"

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
  | { kind: "rubrica" }
  | { kind: "rag" }
  | { kind: "analisis-sync" }

// ── SigPage ────────────────────────────────────────────────────────────────────

export function SigPage() {
  const isMobile = useIsMobile()
  return isMobile ? <SigMobileEntry /> : <SigDesktopView />
}

// ── Vista de escritorio — árbol + tabs + toolbar completa ──────────────────────

function SigDesktopView() {
  const user = useAuthStore((s) => s.user)
  const isGerente = user?.role === "admin" || user?.role === "gerente"
  const canEditSig = isGerente || (user?.app_permissions?.includes("mod_sig") ?? false)

  const [openTabs, setOpenTabs] = useState<TabMeta[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [views, setViews] = useState<Record<string, ActiveView>>({})

  // Carga de procedimientos / nuevas versiones desde documento
  const [cargarOpen, setCargarOpen] = useState(false)
  const [cargarProc, setCargarProc] = useState<PreselectedProc | null>(null)

  const openCargar = useCallback((proc: PreselectedProc | null) => {
    setCargarProc(proc)
    setCargarOpen(true)
  }, [])

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

  const openRubrica = useCallback(() => {
    openTab({ kind: "rubrica" }, { key: "rubrica", icon: "rubrica", title: "Análisis" })
  }, [openTab])

  const openRag = useCallback(() => {
    openTab({ kind: "rag" }, { key: "rag", icon: "rag", title: "Grafo de conocimiento" })
  }, [openTab])

  const openAnalisisSync = useCallback(() => {
    openTab({ kind: "analisis-sync" }, { key: "analisis-sync", icon: "sync", title: "Historial de análisis" })
  }, [openTab])

  // ── Derived state ─────────────────────────────────────────────────────────────

  const activeView: ActiveView = (activeKey && views[activeKey]) || { kind: "welcome" }
  const pendingCount = pendientes.length

  return (
    <div className="h-screen flex flex-col bg-zinc-50 text-zinc-900 overflow-hidden select-none relative">

      {/* Title bar */}
      <TitleBar
        isGerente={isGerente}
        canEditSig={canEditSig}
        pendingCount={pendingCount}
        onOpenQueue={openQueue}
        onOpenRubrica={openRubrica}
        onOpenRag={openRag}
        onOpenSync={openAnalisisSync}
        onCargar={() => openCargar(null)}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: explorer */}
        <SigExplorer
          activeKey={activeKey}
          isGerente={isGerente}
          canEditSig={canEditSig}
          pendingCount={pendingCount}
          onSelectProcedure={openProcedure}
          onSelectCommit={openCommit}
          onOpenQueue={openQueue}
          onCargarVersion={openCargar}
          onDeleteProcedure={(id) => closeTab(`proc-${id}`)}
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
              <ProcedureFileView id={activeView.id} canEditSig={canEditSig} onOpenCommit={openCommit} />
            )}
            {activeView.kind === "commit" && (
              <SigDiffEditor
                key={activeView.id}
                commitId={activeView.id}
                isGerente={isGerente}
                onOpenProcedure={openProcedure}
              />
            )}
            {activeView.kind === "queue" && (
              <ReviewQueueView onOpenCommit={openCommit} />
            )}
            {activeView.kind === "rubrica" && <SigRubricaPanel />}
            {activeView.kind === "rag" && <SigRagPanel />}
            {activeView.kind === "analisis-sync" && <SigAnalisisSyncView />}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar pendingCount={pendingCount} isGerente={isGerente} activeView={activeView} />

      {/* Analysis job queue — Google Drive style overlay */}
      <SigAnalisisQueue />

      {/* Floating inspector — bottom-left near sidebar */}
      <SigAnalisisInspector />

      {/* Carga de procedimiento / nueva versión desde documento */}
      {cargarOpen && (
        <SigCargarModal
          preselected={cargarProc}
          onClose={() => setCargarOpen(false)}
        />
      )}
    </div>
  )
}

// ── Title bar ──────────────────────────────────────────────────────────────────

function TitleBar({
  isGerente, canEditSig, pendingCount, onOpenQueue, onOpenRubrica, onOpenRag, onOpenSync, onCargar,
}: {
  isGerente:            boolean
  canEditSig:           boolean
  pendingCount:         number
  onOpenQueue:          () => void
  onOpenRubrica:        () => void
  onOpenRag:            () => void
  onOpenSync:           () => void
  onCargar:             () => void
}) {
  return (
    <div className="h-10 shrink-0 flex items-center justify-between px-4 border-b border-zinc-200 bg-white">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold tracking-[0.18em] text-helix-accent font-mono uppercase">SIG</span>
        <div className="h-3.5 w-px bg-helix-accent/30" />
        <span className="text-xs text-zinc-500">Sistema Integrado de Gestión</span>
      </div>

      <div className="flex items-center gap-2">
        {canEditSig && (
          <button
            onClick={onCargar}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-helix-accent/30 text-helix-accent hover:bg-helix-accent/5 transition-colors font-mono"
          >
            <UploadCloud className="h-3 w-3" />
            Cargar procedimiento
          </button>
        )}
        <button
          onClick={onOpenRubrica}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors"
        >
          <ClipboardCheck className="h-3 w-3" />
          Análisis
        </button>
        <button
          onClick={onOpenRag}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          <Database className="h-3 w-3" />
          Grafo de conocimiento
        </button>
        <button
          onClick={onOpenSync}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors font-mono"
        >
          <History className="h-3 w-3" />
          Historial de análisis
        </button>
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
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

const TAB_ICON: Record<TabIcon, React.ReactNode> = {
  file:    <FileText       className="h-3.5 w-3.5 text-zinc-400" />,
  diff:    <GitCommit      className="h-3.5 w-3.5 text-helix-ai/80" />,
  queue:   <Inbox          className="h-3.5 w-3.5 text-amber-500/70" />,
  rubrica: <ClipboardCheck className="h-3.5 w-3.5 text-violet-500/80" />,
  rag:     <Database        className="h-3.5 w-3.5 text-emerald-500/80" />,
  sync:    <History        className="h-3.5 w-3.5 text-zinc-400" />,
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
    <div className="flex items-end shrink-0 bg-zinc-50 border-b border-zinc-200 overflow-x-auto scrollbar-none relative">
      {/* Fade gradient en el borde derecho para indicar scroll */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-zinc-50 to-transparent pointer-events-none z-10" />
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
    <div className="flex flex-col items-center justify-center h-full gap-8 bg-zinc-50 relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, #374151 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="h-14 w-14 rounded-xl border border-helix-accent/25 flex items-center justify-center bg-white shadow-sm">
          <GitBranchPlus className="h-7 w-7 text-helix-accent/60" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-700 font-mono">Sistema Integrado de Gestión</p>
          <p className="text-xs text-zinc-500 mt-1">
            Selecciona un procedimiento o commit en el explorador
          </p>
        </div>
      </div>

      <div className="relative flex flex-col gap-2 text-xs text-zinc-400 font-mono">
        {[
          "Clic en un área para expandir",
          "Clic en un procedimiento para ver el documento",
          "Clic en un commit para ver el diff",
        ].map((hint, i) => (
          <div key={i} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3 text-helix-accent/40" />
            <span>{hint}</span>
          </div>
        ))}
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
  archivoOriginal: string | null
  nombreArchivo:   string | null
  tipoMime:        string | null
  flujogramaImagenUrl: string | null
  flujogramaMmd:       string | null
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

// Strips YAML frontmatter and Word-converter warnings before display
function cleanProcContent(raw: string): string {
  let s = raw.replace(/^---[\s\S]*?---\s*\n?/, "").trimStart()
  s = s.replace(/^>.*unrecogni[sz]ed[^\n]*\n?/gim, "")
  s = s.replace(/\n{3,}/g, "\n\n")
  return s.trim()
}

function ProcedureFileView({
  id, canEditSig, onOpenCommit,
}: { id: number; canEditSig: boolean; onOpenCommit: (id: number, info: CommitOpenInfo) => void }) {
  const [editorMode, setEditorMode] = useState<EditorMode>("view")
  const [editContent, setEditContent] = useState("")
  const [commitMsg, setCommitMsg] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  // ponytail: pestaña "Documento" oculta a pedido del usuario (2026-08-05) — subir a true para restaurarla
  const SHOW_DOC_TAB = false
  const [contentTab, setContentTab] = useState<"doc" | "archivo" | "soporte" | "formatos" | "docanexos" | "cargos" | "flujograma">(SHOW_DOC_TAB ? "doc" : "archivo")
  const [selectedInst, setSelectedInst] = useState<SigInstructivo | null>(null)
  const [indexingRag, setIndexingRag] = useState(false)
  const runAnalysis = useRunAnalysis()
  function switchTab(tab: "doc" | "archivo" | "soporte" | "formatos" | "docanexos" | "cargos" | "flujograma") {
    setContentTab(tab)
    if (tab !== "soporte") setSelectedInst(null)
  }

  const { data: procCargosCount = 0 } = useQuery<number>({
    queryKey: ["sig", "proc-cargos-count", id],
    queryFn: async () => {
      const res = await sigApi.get(`/api/procedimientos/${id}/cargos`)
      return Array.isArray(res.data) ? res.data.length : 0
    },
  })

  const { data: analisisHistorial = [] } = useQuery<HistorialItem[]>({
    queryKey: ["sig", "analisis", "historial", "proc", id],
    queryFn: () => sigApi.get("/api/analisis/historial", { params: { procedimientoId: id, limit: 50 } }).then((r) => r.data),
  })
  const [openAnalisisItem, setOpenAnalisisItem] = useState<HistorialItem | null>(null)

  const qc = useQueryClient()
  const [reextractErr, setReextractErr] = useState<string | null>(null)
  const [reextractWarnings, setReextractWarnings] = useState<string[]>([])

  const reextractCommitMut = useMutation({
    mutationFn: (commitId: number) => sigApi.post(`/api/commits/${commitId}/reextract`),
    onSuccess: (res) => {
      setReextractErr(null)
      setReextractWarnings(res.data.warnings ?? [])
      qc.invalidateQueries({ queryKey: ["sig", "commit", res.data.updated.id] })
      qc.invalidateQueries({ queryKey: ["sig", "procedimiento", id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? "No se pudo re-extraer el texto."
      setReextractErr(msg)
    },
  })

  const { data: instructivosSnap = [] } = useQuery<{ id: number; codigo: string; titulo: string }[]>({
    queryKey: ["sig", "instructivos", id],
    queryFn: () => sigApi.get(`/api/instructivos?procedimientoId=${id}&activo=true`).then((r) => r.data),
  })

  const { data: proc, isLoading: procLoading } = useQuery<ProcDetail>({
    queryKey: ["sig", "procedimiento", id],
    queryFn: async () => (await sigApi.get(`/api/procedimientos/${id}`)).data,
  })

  // Mostrar el último aprobado; si no hay ninguno, usar el pending más reciente como preview.
  // El backend devuelve commits en orden descendente (más nuevo primero), pero lo forzamos
  // con un sort explícito para no depender del contrato silencioso del backend.
  const sortedCommits  = [...(proc?.commits ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const latestApproved = sortedCommits.find((c) => c.estado === "APROBADO")
  const latestPending  = sortedCommits.find((c) => c.estado === "PENDIENTE_REVISION")
  const contentCommit  = latestApproved ?? latestPending
  const isPreview      = !latestApproved && !!latestPending

  const { data: content } = useQuery<CommitFull>({
    queryKey: ["sig", "commit", contentCommit?.id],
    queryFn: async () => (await sigApi.get(`/api/commits/${contentCommit!.id}`)).data,
    enabled: !!contentCommit,
  })

  const hasFile = !!(content?.archivoOriginal)
  const isMdTxt = content?.tipoMime?.startsWith("text/") ?? false
  const showArchivoTab = hasFile && !isMdTxt
  // ponytail: si el default "archivo" no aplica (sin archivo original / es texto plano), cae a Soporte
  const effectiveTab = contentTab === "archivo" && !showArchivoTab ? "soporte" : contentTab

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
    } catch (e: unknown) {
      setSaveError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error al guardar la versión.")
    } finally {
      setSaving(false)
    }
  }

  async function handleIndexRag() {
    if (!content?.contenidoAgente || !proc || indexingRag) return
    setIndexingRag(true)
    try {
      const inst = instructivosSnap.length > 0
        ? (await sigApi.get(`/api/instructivos?procedimientoId=${id}&activo=true`)).data as Array<{ id: number; codigo: string; titulo: string; contenido: string }>
        : []
      void runAnalysis(
        { id: proc.id, codigo: proc.codigo, titulo: proc.titulo, areaNombre: proc.area.nombre },
        "lightrag",
        content.contenidoAgente,
        inst,
      )
    } finally {
      setIndexingRag(false)
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
            <span className={cn("text-[11px] px-1.5 py-0.5 rounded border font-mono", ESTADO_PROC_BADGE[proc.estado])}>
              {proc.estado.toLowerCase()}
            </span>
          </div>

          {/* Editor mode controls */}
          <div className="ml-auto flex items-center gap-1">
            {editorMode === "view" && currentContent && (
              <>
                <button
                  onClick={handleIndexRag}
                  disabled={indexingRag}
                  title="Indexar este procedimiento en el grafo de conocimiento LightRAG"
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors font-mono disabled:opacity-40"
                >
                  {indexingRag ? <Loader className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                  RAG
                </button>
                <button
                  onClick={enterEdit}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors font-mono"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  onClick={() => setEditorMode("ai")}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors font-mono"
                >
                  <Sparkles className="h-3 w-3" />
                  Editar con IA
                </button>
              </>
            )}
            {(editorMode === "edit" || editorMode === "ai") && (
              <button
                onClick={() => setEditorMode("view")}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors font-mono"
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
              {saveError && <span className="text-[11px] text-red-500 font-mono">{saveError}</span>}
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
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Banner: preview de versión pendiente */}
            {isPreview && !!currentContent && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b border-amber-200 bg-amber-50">
                <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-[11px] text-amber-700 font-mono">
                  Vista previa — versión pendiente de aprobación
                </span>
                {latestPending && (
                  <button
                    onClick={() => onOpenCommit(latestPending.id, { mensaje: latestPending.mensaje, codigo: proc.codigo })}
                    className="ml-auto text-[11px] text-amber-600 hover:text-amber-800 underline font-mono transition-colors"
                  >
                    Ver diff #{String(latestPending.id).padStart(4, "0")}
                  </button>
                )}
              </div>
            )}

            {/* Content tabs */}
            {(
                <div className="shrink-0 flex items-center border-b border-zinc-200 bg-zinc-50">
                  {SHOW_DOC_TAB && (
                    <button
                      onClick={() => switchTab("doc")}
                      className={cn(
                        "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                        contentTab === "doc"
                          ? "border-helix-accent text-zinc-800 bg-white"
                          : "border-transparent text-zinc-400 hover:text-zinc-600",
                      )}
                    >
                      <FileText className="h-3 w-3" />
                      Documento
                    </button>
                  )}
                  {showArchivoTab && (
                    <button
                      onClick={() => switchTab("archivo")}
                      className={cn(
                        "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                        effectiveTab === "archivo"
                          ? "border-helix-accent text-zinc-800 bg-white"
                          : "border-transparent text-zinc-400 hover:text-zinc-600",
                      )}
                    >
                      <Paperclip className="h-3 w-3" />
                      Procedimiento
                    </button>
                  )}
                  <button
                    onClick={() => switchTab("soporte")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                      effectiveTab === "soporte"
                        ? "border-helix-accent text-zinc-800 bg-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-600",
                    )}
                  >
                    <BookOpen className="h-3 w-3" />
                    Instructivos
                    {instructivosSnap.length > 0 && (
                      <span className="ml-0.5 text-[11px] px-1.5 py-px rounded-full bg-helix-accent/10 text-helix-accent font-semibold tabular-nums">
                        {instructivosSnap.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => switchTab("formatos")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                      contentTab === "formatos"
                        ? "border-helix-accent text-zinc-800 bg-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-600",
                    )}
                  >
                    <FileText className="h-3 w-3" />
                    Formatos
                  </button>
                  <button
                    onClick={() => switchTab("docanexos")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                      contentTab === "docanexos"
                        ? "border-helix-accent text-zinc-800 bg-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-600",
                    )}
                  >
                    <Paperclip className="h-3 w-3" />
                    Doc Anexos
                  </button>
                  <button
                    onClick={() => switchTab("cargos")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                      contentTab === "cargos"
                        ? "border-rose-500 text-zinc-800 bg-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-600",
                    )}
                  >
                    <Users className="h-3 w-3" />
                    Cargos
                    <span className={cn(
                      "ml-0.5 text-[11px] px-1.5 py-px rounded-full font-semibold tabular-nums",
                      procCargosCount > 0
                        ? "bg-rose-100 text-rose-600"
                        : "bg-amber-100 text-amber-700",
                    )}>
                      {procCargosCount}
                    </span>
                  </button>
                  <button
                    onClick={() => switchTab("flujograma")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
                      contentTab === "flujograma"
                        ? "border-helix-accent text-zinc-800 bg-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-600",
                    )}
                  >
                    <GitBranch className="h-3 w-3" />
                    Flujograma
                  </button>
                </div>
            )}

            {/* Doc tab */}
            {SHOW_DOC_TAB && contentTab === "doc" && (
              <div className="flex-1 overflow-auto bg-white">
                <div className="max-w-3xl mx-auto px-8 py-8">

                  {/* Document header */}
                  <div className="mb-8 pb-6 border-b border-zinc-100">
                    <div className="h-0.5 w-10 rounded-full mb-5" style={{ backgroundColor: procArea.color }} />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h1 className="text-lg font-bold text-zinc-900 font-mono tracking-tight">{proc.codigo}</h1>
                        <p className="text-[14px] text-zinc-600 mt-1.5 leading-snug">{proc.titulo}</p>
                      </div>
                      <span className={cn("shrink-0 text-[11px] px-2 py-1 rounded border font-mono mt-0.5", ESTADO_PROC_BADGE[proc.estado])}>
                        {proc.estado.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: procArea.color }} />
                        <span className="text-[11px] text-zinc-400 font-mono">{procArea.nombre}</span>
                      </div>
                      {contentCommit?.versionDoc && (
                        <>
                          <div className="h-3 w-px bg-zinc-200" />
                          <span className="text-[11px] text-zinc-400 font-mono">v{contentCommit.versionDoc}</span>
                        </>
                      )}
                      {contentCommit?.createdAt && (
                        <>
                          <div className="h-3 w-px bg-zinc-200" />
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {new Date(contentCommit.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </>
                      )}
                    </div>
                    {proc.descripcion && (
                      <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed border-l-2 border-zinc-200 pl-3 italic">
                        {proc.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Document content */}
                  {currentContent ? (
                    <div className="prose max-w-none
                        prose-headings:font-mono prose-headings:text-zinc-800 prose-headings:font-bold prose-headings:tracking-tight
                        prose-h1:text-base prose-h1:border-b prose-h1:border-zinc-200 prose-h1:pb-2 prose-h1:mb-4
                        prose-h2:text-[14px] prose-h2:text-zinc-700 prose-h2:mt-8 prose-h2:mb-3
                        prose-h3:text-[13px] prose-h3:text-zinc-600 prose-h3:mt-5
                        prose-p:text-zinc-600 prose-p:leading-relaxed prose-p:text-[13px]
                        prose-strong:text-zinc-800 prose-strong:font-semibold
                        prose-li:text-zinc-600 prose-li:text-[13px] prose-li:leading-relaxed
                        prose-ul:space-y-1.5 prose-ol:space-y-1.5
                        prose-ul:my-3 prose-ol:my-3
                        prose-code:text-helix-ai prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:font-mono
                        prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200 prose-pre:rounded-lg prose-pre:text-[11px]
                        prose-blockquote:border-l-2 prose-blockquote:border-amber-300 prose-blockquote:bg-amber-50/60 prose-blockquote:rounded-r prose-blockquote:text-amber-700 prose-blockquote:text-[11px] prose-blockquote:py-2 prose-blockquote:not-italic
                        prose-table:text-[12px] prose-table:w-full prose-table:border-collapse
                        prose-th:bg-zinc-50 prose-th:text-zinc-700 prose-th:font-mono prose-th:font-semibold prose-th:text-[11px] prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-zinc-200 prose-th:text-left
                        prose-td:text-zinc-600 prose-td:text-[12px] prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-zinc-100
                        prose-tr:even:bg-zinc-50/50
                        prose-hr:border-zinc-200 prose-hr:my-6
                        prose-a:text-helix-ai prose-a:no-underline hover:prose-a:underline"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {cleanProcContent(currentContent)}
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
                            ? "Usa «Cargar procedimiento» para subir el primer documento."
                            : "Hay commits en revisión. Aprueba uno para publicar el contenido."
                          }
                        </p>
                      </div>
                      {content?.archivoOriginal && (
                        <>
                          {reextractErr && (
                            <p className="text-[11px] text-red-500 font-mono text-center max-w-sm">{reextractErr}</p>
                          )}
                          {reextractWarnings.map((w, i) => (
                            <p key={i} className="text-[11px] text-amber-600 font-mono text-center max-w-sm">{w}</p>
                          ))}
                          <button
                            onClick={() => reextractCommitMut.mutate(content.id)}
                            disabled={reextractCommitMut.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={cn("h-3 w-3", reextractCommitMut.isPending && "animate-spin")} />
                            {reextractCommitMut.isPending ? "Re-extrayendo…" : "Reextraer texto"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Archivo original tab */}
            {effectiveTab === "archivo" && content?.archivoOriginal && (
              <ArchivoOriginalView commitId={content.id} tipoMime={content.tipoMime} nombreArchivo={content.nombreArchivo} />
            )}

            {/* Formatos tab — cuelgan de un instructivo, agregados a nivel de procedimiento */}
            {effectiveTab === "formatos" && (
              <SigAnexoPanel
                title="Formatos"
                emptyText="Plantillas o formularios de este procedimiento. Opcionalmente puedes asociarlos a un instructivo puntual."
                listUrl={`/api/formatos?procedimientoId=${id}`}
                uploadUrl="/api/formatos/upload"
                deleteUrlBase="/api/formatos"
                archivoUrlBase="/sig-api/api/formatos"
                queryKey={["sig", "formatos", id]}
                canEdit={canEditSig}
                instructivoOptions={instructivosSnap}
                extraField={{ name: "procedimientoId", value: String(id) }}
              />
            )}

            {/* Doc Anexos tab — documentos adicionales libres a nivel de procedimiento */}
            {effectiveTab === "docanexos" && (
              <SigAnexoPanel
                title="Documentos anexados/adicionales"
                emptyText="Documentos anexados/adicionales que no encajan como instructivo ni formato."
                listUrl={`/api/doc-anexos?procedimientoId=${id}`}
                uploadUrl="/api/doc-anexos/upload"
                deleteUrlBase="/api/doc-anexos"
                archivoUrlBase="/sig-api/api/doc-anexos"
                queryKey={["sig", "doc-anexos", id]}
                canEdit={canEditSig}
                extraField={{ name: "procedimientoId", value: String(id) }}
              />
            )}

            {/* Cargos tab */}
            {effectiveTab === "cargos" && (
              <div className="flex-1 overflow-auto bg-white">
                <div className="max-w-3xl mx-auto px-8 py-8">
                  <SigProcedimientoCargosPanel procedimientoId={id} canEdit={canEditSig} />
                </div>
              </div>
            )}

            {/* Flujograma tab — imagen original extraída del docx + mermaid transcrito (MCP) */}
            {contentTab === "flujograma" && (
              <div className="flex-1 overflow-auto bg-white">
                <div className="max-w-3xl mx-auto px-8 py-8">
                  <FlujogramaView
                    commitId={content?.id}
                    tieneImagen={!!content?.flujogramaImagenUrl}
                    flujogramaMmd={content?.flujogramaMmd ?? null}
                    tieneArchivoOriginal={!!content?.archivoOriginal}
                    onReextraer={() => content && reextractCommitMut.mutate(content.id)}
                    reextrayendo={reextractCommitMut.isPending}
                    reextractErr={reextractErr}
                  />
                </div>
              </div>
            )}

            {/* Soporte tab — list */}
            {effectiveTab === "soporte" && !selectedInst && (
              <div className="flex-1 overflow-auto bg-white">
                <div className="max-w-3xl mx-auto px-8 py-8">
                  <SigInstructivosPanel
                    procedimientoId={id}
                    procCodigo={proc.codigo}
                    canEdit={canEditSig}
                    onSelectInst={(inst) => setSelectedInst(inst)}
                  />
                </div>
              </div>
            )}

            {/* Soporte tab — detail */}
            {effectiveTab === "soporte" && selectedInst && (
              <InstructivoDetailView
                inst={selectedInst}
                onBack={() => setSelectedInst(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* Right panel: commit history */}
      <div className="w-64 shrink-0 border-l border-zinc-200 flex flex-col bg-zinc-50">
        <div className="flex items-center gap-2 px-3 h-7 border-b border-zinc-200 shrink-0">
          <Clock className="h-3 w-3 text-helix-ai/50" />
          <span className="text-[11px] text-helix-ai/60 font-mono uppercase tracking-widest">
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

        {/* Historial de análisis del procedimiento */}
        <div className="flex items-center gap-2 px-3 h-7 border-b border-t border-zinc-200 shrink-0">
          <ClipboardCheck className="h-3 w-3 text-helix-ai/50" />
          <span className="text-[11px] text-helix-ai/60 font-mono uppercase tracking-widest">
            Análisis
          </span>
        </div>
        <div className="shrink-0 max-h-64 overflow-y-auto py-1">
          {analisisHistorial.length === 0 && (
            <div className="px-4 py-6 text-[11px] text-zinc-400 italic text-center">
              Sin análisis aún
            </div>
          )}
          {analisisHistorial.map((item) => (
            <button
              key={`${item.tipo}-${item.id}`}
              onClick={() => setOpenAnalisisItem(item)}
              className="w-full flex items-center gap-2 px-3 py-2 border-b border-zinc-200/60 hover:bg-zinc-100 transition-colors text-left"
            >
              <span className="text-zinc-400 shrink-0">{TIPO_ICON[item.tipo]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-600 truncate leading-tight">{TIPO_LABEL[item.tipo]}</p>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {new Date(item.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {openAnalisisItem && (
        <AnalisisDetailModal item={openAnalisisItem} onClose={() => setOpenAnalisisItem(null)} />
      )}
    </div>
  )
}

// ── Instructivo detail view ───────────────────────────────────────────────────

function InstructivoDetailView({ inst, onBack }: { inst: SigInstructivo; onBack: () => void }) {
  const hasFile = !!inst.archivoOriginal && !inst.tipoMime?.startsWith("text/")
  const [tab, setTab] = useState<"doc" | "archivo">("doc")
  const [contenidoLocal, setContenidoLocal] = useState(inst.contenido)
  const [reextractErr, setReextractErr] = useState<string | null>(null)
  const [reextractWarnings, setReextractWarnings] = useState<string[]>([])

  const reextractMut = useMutation({
    mutationFn: () => sigApi.post(`/api/instructivos/${inst.id}/reextract`),
    onSuccess: (res) => {
      setContenidoLocal(res.data.updated.contenido ?? "")
      setReextractWarnings(res.data.warnings ?? [])
      setReextractErr(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? "No se pudo re-extraer el texto."
      setReextractErr(msg)
    },
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back + breadcrumb bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 h-8 border-b border-zinc-200 bg-zinc-50">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          Instructivos
        </button>
        <ChevronRight className="h-3 w-3 text-zinc-300" />
        <Paperclip className="h-3 w-3 text-zinc-400" />
        <span className="text-[11px] font-mono text-zinc-700">{inst.codigo}</span>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex items-center border-b border-zinc-200 bg-zinc-50">
        <button
          onClick={() => setTab("doc")}
          className={cn(
            "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
            tab === "doc" ? "border-helix-accent text-zinc-800 bg-white" : "border-transparent text-zinc-400 hover:text-zinc-600",
          )}
        >
          <FileText className="h-3 w-3" />
          Documento
        </button>
        {hasFile && (
          <button
            onClick={() => setTab("archivo")}
            className={cn(
              "flex items-center gap-1.5 px-4 h-8 text-[11px] font-mono border-b-2 transition-colors",
              tab === "archivo" ? "border-helix-accent text-zinc-800 bg-white" : "border-transparent text-zinc-400 hover:text-zinc-600",
            )}
          >
            <Paperclip className="h-3 w-3" />
            Archivo original
          </button>
        )}
      </div>

      {/* Doc tab */}
      {tab === "doc" && (
        <div className="flex-1 overflow-auto bg-white">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="mb-8 pb-6 border-b border-zinc-100">
              <h1 className="text-lg font-bold text-zinc-900 font-mono tracking-tight">{inst.codigo}</h1>
              <p className="text-[14px] text-zinc-600 mt-1.5 leading-snug">{inst.titulo}</p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[11px] text-zinc-400 font-mono">v{inst.versionDoc}</span>
                <div className="h-3 w-px bg-zinc-200" />
                <span className="text-[11px] text-zinc-400 font-mono">{inst.autorNombre}</span>
                <div className="h-3 w-px bg-zinc-200" />
                <span className="text-[11px] text-zinc-400 font-mono">
                  {new Date(inst.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              {inst.descripcion && (
                <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed border-l-2 border-zinc-200 pl-3 italic">{inst.descripcion}</p>
              )}
            </div>
            {/* Content */}
            {contenidoLocal.trim() ? (
              <div className={INST_PROSE}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{contenidoLocal}</ReactMarkdown>
                {reextractWarnings.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                    {reextractWarnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-amber-700 font-mono">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-16">
                <Paperclip className="h-8 w-8 text-zinc-200" />
                <p className="text-[13px] text-zinc-400 font-mono text-center">
                  No se pudo extraer texto de este archivo.
                </p>
                {reextractErr && (
                  <p className="text-[11px] text-red-500 font-mono text-center max-w-sm">{reextractErr}</p>
                )}
                {reextractWarnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600 font-mono text-center max-w-sm">{w}</p>
                ))}
                {hasFile && (
                  <button
                    onClick={() => reextractMut.mutate()}
                    disabled={reextractMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3 w-3", reextractMut.isPending && "animate-spin")} />
                    {reextractMut.isPending ? "Re-extrayendo…" : "Reextraer texto"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archivo tab */}
      {tab === "archivo" && hasFile && (
        <InstructivoArchivoView inst={inst} />
      )}
    </div>
  )
}

// ── Archivo original view ─────────────────────────────────────────────────────

function ArchivoOriginalView({
  commitId, tipoMime, nombreArchivo,
}: { commitId: number; tipoMime: string | null; nombreArchivo: string | null }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const docxRef = useRef<HTMLDivElement>(null)

  const isPdf  = tipoMime === "application/pdf"
  const isDocx = tipoMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

  useEffect(() => {
    let blobUrl: string | null = null
    setLoading(true)
    setError(null)
    setObjectUrl(null)
    setArrayBuffer(null)

    sigApi.get(`/api/commits/${commitId}/archivo`, { responseType: "blob" })
      .then(async (res) => {
        const blob: Blob = res.data
        blobUrl = URL.createObjectURL(blob)
        setObjectUrl(blobUrl)
        if (isDocx) {
          const ab = await blob.arrayBuffer()
          setArrayBuffer(ab)
        }
      })
      .catch(() => setError("No se pudo cargar el archivo."))
      .finally(() => setLoading(false))

    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [commitId, isDocx])

  useEffect(() => {
    if (!isDocx || !arrayBuffer || !docxRef.current) return
    import("docx-preview").then(({ renderAsync }) => {
      renderAsync(arrayBuffer, docxRef.current!, undefined, {
        className: "docx-render",
        inWrapper: false,
      }).catch(() => setError("No se pudo renderizar el documento Word."))
    })
  }, [arrayBuffer, isDocx])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-zinc-400">
        <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
        <span className="text-xs font-mono">Cargando archivo…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <AlertCircle className="h-6 w-6 text-zinc-300" />
        <p className="text-sm text-zinc-400 font-mono">{error}</p>
      </div>
    )
  }

  if (isPdf && objectUrl) {
    return (
      <div className="flex-1 overflow-hidden bg-zinc-100">
        <iframe
          src={objectUrl}
          className="w-full h-full border-0"
          title={nombreArchivo ?? "Archivo PDF"}
        />
      </div>
    )
  }

  if (isDocx) {
    return (
      <div className="flex-1 overflow-auto bg-white p-6">
        {/* Sin max-w — docx-preview dibuja el ancho real de tabla del .docx original;
            forzarlo a un contenedor angosto (pensado para prosa) corta las tablas anchas
            del encabezado institucional. El overflow-auto del padre ya resuelve el scroll
            cuando la tabla es mas ancha que el panel. */}
        <div ref={docxRef} />
      </div>
    )
  }

  // .doc u otro — descarga
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <Paperclip className="h-8 w-8 text-zinc-300" />
      <div className="text-center">
        <p className="text-sm font-mono text-zinc-600">{nombreArchivo ?? "Archivo"}</p>
        <p className="text-[11px] text-zinc-400 mt-1">
          Este formato no puede mostrarse en el navegador.
        </p>
      </div>
      {objectUrl && (
        <a
          href={objectUrl}
          download={nombreArchivo ?? "archivo"}
          className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors font-mono"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar {nombreArchivo}
        </a>
      )}
    </div>
  )
}

// ── Flujograma tab — imagen original extraída del docx + mermaid transcrito por IA ──

function FlujogramaView({
  commitId, tieneImagen, flujogramaMmd, tieneArchivoOriginal, onReextraer, reextrayendo, reextractErr,
}: {
  commitId: number | undefined
  tieneImagen: boolean
  flujogramaMmd: string | null
  tieneArchivoOriginal: boolean
  onReextraer: () => void
  reextrayendo: boolean
  reextractErr: string | null
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!commitId || !tieneImagen) return
    let blobUrl: string | null = null
    setError(null)
    setObjectUrl(null)

    sigApi.get(`/api/commits/${commitId}/flujograma-imagen`, { responseType: "blob" })
      .then((res) => {
        blobUrl = URL.createObjectURL(res.data as Blob)
        setObjectUrl(blobUrl)
      })
      .catch(() => setError("No se pudo cargar la imagen del flujograma."))

    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [commitId, tieneImagen])

  // Re-extraer solo tiene sentido si hay un archivo original guardado del cual
  // volver a sacar la imagen -- procedimientos cargados antes del fix de
  // textExtraction.ts (que antes embebía la imagen como base64 en vez de
  // guardarla aparte) son justo el caso que este botón resuelve.
  const reextraerBtn = tieneArchivoOriginal && (
    <button
      onClick={onReextraer}
      disabled={reextrayendo}
      className="flex items-center gap-1.5 rounded border border-zinc-200 px-3 py-1.5 text-[11px] font-mono text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3 w-3", reextrayendo && "animate-spin")} />
      {reextrayendo ? "Re-extrayendo…" : "Re-extraer imagen del documento original"}
    </button>
  )

  if (!tieneImagen && !flujogramaMmd) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <GitBranch className="h-8 w-8 text-zinc-300" />
        <div>
          <p className="text-sm text-zinc-500 font-mono">Sin flujograma</p>
          <p className="text-[11px] text-zinc-400 mt-1 max-w-sm">
            Este documento no tenía una imagen de flujograma detectable, o el
            texto no incluía una sección "Flujograma".
          </p>
        </div>
        {reextractErr && <p className="text-[11px] text-red-500 font-mono max-w-sm">{reextractErr}</p>}
        {reextraerBtn}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {tieneImagen && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wide">
              Imagen original (extraída del documento)
            </h3>
            {reextraerBtn}
          </div>
          {reextractErr && <p className="text-[11px] text-red-500 font-mono mb-2">{reextractErr}</p>}
          {error && <p className="text-[11px] text-red-500 font-mono">{error}</p>}
          {!error && !objectUrl && (
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
              <span className="text-xs font-mono">Cargando imagen…</span>
            </div>
          )}
          {objectUrl && (
            <img src={objectUrl} alt="Flujograma original" className="max-w-full rounded-lg border border-zinc-200" />
          )}
        </div>
      )}
      {!tieneImagen && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wide">
              Imagen original
            </h3>
            {reextraerBtn}
          </div>
          {reextractErr && <p className="text-[11px] text-red-500 font-mono mb-2">{reextractErr}</p>}
          <p className="text-[11px] text-zinc-400 font-mono">
            Este documento no tiene imagen de flujograma guardada todavía.
            {tieneArchivoOriginal ? " Si el documento original sí trae una, usa \"Re-extraer\"." : ""}
          </p>
        </div>
      )}
      {flujogramaMmd ? (
        <div>
          <h3 className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Transcrito por IA (usado para verificar coherencia contra el texto)
          </h3>
          <MermaidDiagram code={flujogramaMmd} />
        </div>
      ) : (
        <p className="text-[11px] text-zinc-400 font-mono">
          Todavía no hay una versión mermaid transcrita — se genera al correr un "Análisis completo" vía MCP.
        </p>
      )}
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
  const [pdfError, setPdfError] = useState<string | null>(null)

  async function handleDownloadPdf(e: React.MouseEvent) {
    e.stopPropagation()
    setDownloading(true)
    setPdfError(null)
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
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg =
        status === 404 ? "Commit no encontrado" :
        status === 409 ? "Solo se puede generar PDF de commits aprobados" :
        status === 502 ? "Error de comunicación interna — revisa logs del servidor" :
        status === 503 ? "sig-backend no disponible" :
        "Error al generar PDF — revisa logs del servidor"
      setPdfError(msg)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="border-b border-zinc-200/60 group">
      {pdfError && (
        <div className="px-3 pt-1.5 pb-0.5 text-[11px] text-red-500 font-mono flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {pdfError}
        </div>
      )}
      {/* Clickable row — `relative` here so PDF button is positioned within the row only */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
        className="relative px-3 py-2 hover:bg-zinc-100 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-2">
          <Circle
            className={cn("h-2 w-2 mt-0.5 shrink-0 fill-current", COMMIT_STATE_DOT[commit.estado])}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-600 group-hover:text-zinc-900 transition-colors truncate leading-tight">
              {commit.mensaje}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-zinc-400 font-mono">#{String(commit.id).padStart(4, "0")}</span>
              <span className="text-[11px] text-zinc-400">·</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {new Date(commit.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
              </span>
            </div>
          </div>
          {/* Spacer so text doesn't overlap PDF button */}
          {commit.estado === "APROBADO" && <div className="w-6 shrink-0" />}
        </div>

        {/* PDF button — inside the row div so top-1/2 is relative to row height only */}
        {commit.estado === "APROBADO" && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDownloadPdf(e) }}
            disabled={downloading}
            title="Descargar PDF"
            aria-label="Descargar PDF"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center
                       text-zinc-400 hover:text-helix-accent hover:bg-helix-accent/10
                       transition-colors disabled:opacity-40"
          >
            {downloading
              ? <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-500 animate-spin" />
              : <Download className="h-3 w-3" />
            }
          </button>
        )}
      </div>
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
            <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest mb-3">
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
                      <span className="text-[11px] text-zinc-300">·</span>
                      <span className="text-[11px] text-zinc-400">{commit.procedimiento.area.nombre}</span>
                    </div>
                    <p className="text-[12px] text-zinc-600 group-hover:text-zinc-900 transition-colors truncate font-mono">
                      {commit.mensaje}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-400">por {commit.autorNombre}</span>
                      <span className="text-[11px] text-zinc-300">·</span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {new Date(commit.createdAt).toLocaleString("es-CO", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-amber-500/70 font-mono">
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

// ── Entrada mobile — automática cuando el viewport es angosto (ver useIsMobile
// en SigPage arriba), no un botón manual. Pantalla completa real, sin marco de
// celular decorativo — eso era solo para probar el diseño desde escritorio.
// Shell con 4 pestañas inferiores: reutiliza los mismos paneles del escritorio
// (ya son de una sola columna / max-w-3xl centrado) en vez de duplicar UI.

type MobileTab = "cola" | "procedimientos" | "analisis" | "grafo"

function SigMobileEntry() {
  const user = useAuthStore((s) => s.user)
  const isGerente = user?.role === "admin" || user?.role === "gerente"
  const canEditSig = isGerente || (user?.app_permissions?.includes("mod_sig") ?? false)

  const [tab, setTab] = useState<MobileTab>("cola")
  const [colaSelectedId, setColaSelectedId] = useState<number | null>(null)
  const [openProcId, setOpenProcId] = useState<number | null>(null)
  const [openCommitId, setOpenCommitId] = useState<number | null>(null)
  const [analisisSub, setAnalisisSub] = useState<"historial" | "catalogo">("historial")

  const { data: commits = [], isLoading } = useQuery<PendingCommit[]>({
    queryKey: ["sig", "commits", "pendientes-detail"],
    queryFn: async () => (await sigApi.get("/api/commits?estado=PENDIENTE_REVISION")).data,
    refetchInterval: 30_000,
  })

  const drilled =
    (tab === "cola" && colaSelectedId != null) ||
    (tab === "procedimientos" && (openProcId != null || openCommitId != null))

  return (
    <div className="h-dvh flex flex-col bg-white">
      <div className="flex-1 overflow-hidden flex flex-col">

        {tab === "cola" && (
          colaSelectedId != null ? (
            <div className="h-full flex flex-col">
              <div className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-zinc-200">
                <button
                  onClick={() => setColaSelectedId(null)}
                  className="flex items-center gap-1 text-[13px] text-zinc-500 active:text-zinc-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Cola de revisión
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <SigDiffMobileView
                  key={colaSelectedId}
                  commitId={colaSelectedId}
                  isGerente={isGerente}
                  onActioned={() => setColaSelectedId(null)}
                />
              </div>
            </div>
          ) : (
            <MobileColaList commits={commits} isLoading={isLoading} onSelect={setColaSelectedId} />
          )
        )}

        {tab === "procedimientos" && (
          openCommitId != null ? (
            <div className="h-full flex flex-col">
              <div className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-zinc-200">
                <button
                  onClick={() => setOpenCommitId(null)}
                  className="flex items-center gap-1 text-[13px] text-zinc-500 active:text-zinc-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Volver
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <SigDiffMobileView
                  key={openCommitId}
                  commitId={openCommitId}
                  isGerente={isGerente}
                  onActioned={() => setOpenCommitId(null)}
                />
              </div>
            </div>
          ) : openProcId != null ? (
            <SigProcedureMobileView
              id={openProcId}
              canEditSig={canEditSig}
              onBack={() => setOpenProcId(null)}
              onOpenCommit={setOpenCommitId}
            />
          ) : (
            <div className="h-full flex flex-col bg-white">
              <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-zinc-200">
                <span className="text-xs font-bold tracking-[0.18em] text-helix-accent font-mono uppercase">SIG</span>
                <span className="text-[13px] font-semibold text-zinc-800 ml-1">Procedimientos</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SigExplorer
                  activeKey={null}
                  isGerente={isGerente}
                  canEditSig={canEditSig}
                  pendingCount={commits.length}
                  onSelectProcedure={(id) => setOpenProcId(id)}
                  onSelectCommit={(id) => setOpenCommitId(id)}
                  onOpenQueue={() => setTab("cola")}
                />
              </div>
            </div>
          )
        )}

        {tab === "analisis" && (
          <div className="h-full flex flex-col bg-white">
            <div className="shrink-0 flex items-center gap-1.5 px-4 h-11 border-b border-zinc-200">
              <button
                onClick={() => setAnalisisSub("historial")}
                className={cn(
                  "text-[12px] px-2.5 py-1 rounded-full transition-colors",
                  analisisSub === "historial" ? "bg-zinc-800 text-white" : "text-zinc-500",
                )}
              >
                Historial
              </button>
              <button
                onClick={() => setAnalisisSub("catalogo")}
                className={cn(
                  "text-[12px] px-2.5 py-1 rounded-full transition-colors",
                  analisisSub === "catalogo" ? "bg-zinc-800 text-white" : "text-zinc-500",
                )}
              >
                Catálogo
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {analisisSub === "historial" ? <SigAnalisisSyncView /> : <SigRubricaPanel />}
            </div>
          </div>
        )}

        {tab === "grafo" && <SigRagPanel />}
      </div>

      {!drilled && <MobileTabBar tab={tab} onChange={setTab} pendingCount={commits.length} />}
    </div>
  )
}

// ── Cola de revisión — lista (mobile) ───────────────────────────────────────────

function MobileColaList({
  commits, isLoading, onSelect,
}: { commits: PendingCommit[]; isLoading: boolean; onSelect: (id: number) => void }) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="shrink-0 flex items-center gap-2 px-4 h-11 border-b border-zinc-200">
        <span className="text-xs font-bold tracking-[0.18em] text-helix-accent font-mono uppercase">SIG</span>
        <span className="text-[13px] font-semibold text-zinc-800 ml-1">Cola de revisión</span>
        {commits.length > 0 && (
          <span className="ml-auto text-[11px] font-mono text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            {commits.length}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-4 py-6 text-[13px] text-zinc-400 text-center">Cargando…</p>
        )}
        {!isLoading && commits.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
            <Check className="h-6 w-6 text-emerald-400" />
            <p className="text-[13px] text-zinc-500">Sin pendientes</p>
          </div>
        )}
        {commits.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-100 text-left active:bg-zinc-50 transition-colors"
          >
            <span className="h-8 w-0.5 rounded-full shrink-0" style={{ backgroundColor: c.procedimiento.area.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[11px] font-mono text-zinc-500">{c.procedimiento.codigo}</span>
                <span className="text-[11px] text-zinc-300">·</span>
                <span className="text-[11px] text-zinc-400 truncate">{c.procedimiento.area.nombre}</span>
              </div>
              <p className="text-[13px] text-zinc-800 truncate">{c.mensaje}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{c.autorNombre}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Barra de pestañas inferior ──────────────────────────────────────────────────

function MobileTabBar({
  tab, onChange, pendingCount,
}: { tab: MobileTab; onChange: (t: MobileTab) => void; pendingCount: number }) {
  const items: { key: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "cola", label: "Cola", icon: <Inbox className="h-4 w-4" />, badge: pendingCount },
    { key: "procedimientos", label: "Procedimientos", icon: <FileText className="h-4 w-4" /> },
    { key: "analisis", label: "Análisis", icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: "grafo", label: "Grafo", icon: <Database className="h-4 w-4" /> },
  ]
  return (
    <div
      className="shrink-0 flex items-stretch border-t border-zinc-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
            tab === it.key ? "text-helix-accent" : "text-zinc-400",
          )}
        >
          <div className="relative">
            {it.icon}
            {!!it.badge && (
              <span className="absolute -top-1.5 -right-2 h-3.5 min-w-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {it.badge}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Procedimiento — visor mobile de solo lectura (contenido/instructivos/cargos/
// flujograma/formatos/doc anexos/historial), con pestañas horizontales scrolleables.
// No incluye edición manual ni "Editar con IA" — un textarea no es cómodo en celular
// y la edición real de contenido se sigue haciendo desde escritorio.

type ProcMobileTab = "contenido" | "archivo" | "instructivos" | "cargos" | "flujograma" | "formatos" | "docanexos" | "historial"

function SigProcedureMobileView({
  id, canEditSig, onBack, onOpenCommit,
}: { id: number; canEditSig: boolean; onBack: () => void; onOpenCommit: (id: number) => void }) {
  const [tab, setTab] = useState<ProcMobileTab>("contenido")
  const [selectedInst, setSelectedInst] = useState<SigInstructivo | null>(null)
  const [openAnalisisItem, setOpenAnalisisItem] = useState<HistorialItem | null>(null)
  const qc = useQueryClient()
  const [reextractErr, setReextractErr] = useState<string | null>(null)

  const reextractCommitMut = useMutation({
    mutationFn: (commitId: number) => sigApi.post(`/api/commits/${commitId}/reextract`),
    onSuccess: (res) => {
      setReextractErr(null)
      qc.invalidateQueries({ queryKey: ["sig", "commit", res.data.updated.id] })
      qc.invalidateQueries({ queryKey: ["sig", "procedimiento", id] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? "No se pudo re-extraer el texto."
      setReextractErr(msg)
    },
  })

  const { data: proc, isLoading: procLoading } = useQuery<ProcDetail>({
    queryKey: ["sig", "procedimiento", id],
    queryFn: async () => (await sigApi.get(`/api/procedimientos/${id}`)).data,
  })

  const { data: instructivosSnap = [] } = useQuery<{ id: number; codigo: string; titulo: string }[]>({
    queryKey: ["sig", "instructivos", id],
    queryFn: () => sigApi.get(`/api/instructivos?procedimientoId=${id}&activo=true`).then((r) => r.data),
  })

  const { data: analisisHistorial = [] } = useQuery<HistorialItem[]>({
    queryKey: ["sig", "analisis", "historial", "proc", id],
    queryFn: () => sigApi.get("/api/analisis/historial", { params: { procedimientoId: id, limit: 50 } }).then((r) => r.data),
  })

  const sortedCommits  = [...(proc?.commits ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const latestApproved = sortedCommits.find((c) => c.estado === "APROBADO")
  const latestPending  = sortedCommits.find((c) => c.estado === "PENDIENTE_REVISION")
  const contentCommit  = latestApproved ?? latestPending
  const isPreview      = !latestApproved && !!latestPending

  const { data: content } = useQuery<CommitFull>({
    queryKey: ["sig", "commit", contentCommit?.id],
    queryFn: async () => (await sigApi.get(`/api/commits/${contentCommit!.id}`)).data,
    enabled: !!contentCommit,
  })

  const hasFile = !!(content?.archivoOriginal)
  const isMdTxt = content?.tipoMime?.startsWith("text/") ?? false
  const showArchivoTab = hasFile && !isMdTxt
  const currentContent = content?.contenidoAgente ?? ""

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

  if (selectedInst) {
    return <InstructivoDetailView inst={selectedInst} onBack={() => setSelectedInst(null)} />
  }

  const procArea = proc.area
  const effectiveTab = tab === "archivo" && !showArchivoTab ? "contenido" : tab

  const TABS: { key: ProcMobileTab; label: string; show: boolean }[] = [
    { key: "contenido", label: "Contenido", show: true },
    { key: "archivo", label: "Procedimiento", show: showArchivoTab },
    { key: "instructivos", label: `Instructivos${instructivosSnap.length > 0 ? ` (${instructivosSnap.length})` : ""}`, show: true },
    { key: "cargos", label: "Cargos", show: true },
    { key: "flujograma", label: "Flujograma", show: true },
    { key: "formatos", label: "Formatos", show: true },
    { key: "docanexos", label: "Doc Anexos", show: true },
    { key: "historial", label: "Historial", show: true },
  ]

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-zinc-200 bg-zinc-50">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-zinc-500 active:text-zinc-800 transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: procArea.color }} />
        <span className="text-[12px] font-mono font-semibold text-zinc-800 truncate">{proc.codigo}</span>
        <span className={cn("shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-mono ml-auto", ESTADO_PROC_BADGE[proc.estado])}>
          {proc.estado.toLowerCase()}
        </span>
      </div>
      <div className="shrink-0 px-3 py-2 border-b border-zinc-100">
        <p className="text-[13px] text-zinc-700 leading-snug">{proc.titulo}</p>
      </div>

      {/* Tabs — scroll horizontal */}
      <div className="shrink-0 flex items-center border-b border-zinc-200 bg-zinc-50 overflow-x-auto">
        {TABS.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 px-3.5 h-9 text-[12px] font-mono border-b-2 whitespace-nowrap transition-colors",
              effectiveTab === t.key
                ? "border-helix-accent text-zinc-800 bg-white"
                : "border-transparent text-zinc-400",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {effectiveTab === "contenido" && (
          <div className="px-5 py-6">
            {isPreview && !!currentContent && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50">
                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] text-amber-700">Vista previa — versión pendiente de aprobación</span>
              </div>
            )}
            {proc.descripcion && (
              <p className="text-[12px] text-zinc-400 mb-4 leading-relaxed border-l-2 border-zinc-200 pl-3 italic">{proc.descripcion}</p>
            )}
            {currentContent ? (
              <div className="prose prose-base max-w-none
                  prose-headings:font-mono prose-headings:text-zinc-800 prose-headings:font-bold
                  prose-p:text-zinc-700 prose-p:leading-relaxed prose-p:text-[15px]
                  prose-li:text-zinc-700 prose-li:text-[15px] prose-li:leading-relaxed
                  prose-strong:text-zinc-800
                  prose-code:text-helix-ai prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px]
                  prose-table:text-[13px] prose-a:text-helix-ai"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanProcContent(currentContent)}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <FileText className="h-6 w-6 text-zinc-300" />
                <p className="text-[13px] text-zinc-500">Sin contenido publicado</p>
              </div>
            )}
          </div>
        )}

        {effectiveTab === "archivo" && content?.archivoOriginal && (
          <ArchivoOriginalView commitId={content.id} tipoMime={content.tipoMime} nombreArchivo={content.nombreArchivo} />
        )}

        {effectiveTab === "instructivos" && (
          <div className="px-5 py-6">
            <SigInstructivosPanel
              procedimientoId={id}
              procCodigo={proc.codigo}
              canEdit={canEditSig}
              onSelectInst={(inst) => setSelectedInst(inst)}
            />
          </div>
        )}

        {effectiveTab === "cargos" && (
          <div className="px-5 py-6">
            <SigProcedimientoCargosPanel procedimientoId={id} canEdit={canEditSig} />
          </div>
        )}

        {effectiveTab === "flujograma" && (
          <div className="px-5 py-6">
            <FlujogramaView
              commitId={content?.id}
              tieneImagen={!!content?.flujogramaImagenUrl}
              flujogramaMmd={content?.flujogramaMmd ?? null}
              tieneArchivoOriginal={!!content?.archivoOriginal}
              onReextraer={() => content && reextractCommitMut.mutate(content.id)}
              reextrayendo={reextractCommitMut.isPending}
              reextractErr={reextractErr}
            />
          </div>
        )}

        {effectiveTab === "formatos" && (
          <SigAnexoPanel
            title="Formatos"
            emptyText="Plantillas o formularios de este procedimiento. Opcionalmente puedes asociarlos a un instructivo puntual."
            listUrl={`/api/formatos?procedimientoId=${id}`}
            uploadUrl="/api/formatos/upload"
            deleteUrlBase="/api/formatos"
            archivoUrlBase="/sig-api/api/formatos"
            queryKey={["sig", "formatos", id]}
            canEdit={canEditSig}
            instructivoOptions={instructivosSnap}
            extraField={{ name: "procedimientoId", value: String(id) }}
          />
        )}

        {effectiveTab === "docanexos" && (
          <SigAnexoPanel
            title="Documentos anexados/adicionales"
            emptyText="Documentos anexados/adicionales que no encajan como instructivo ni formato."
            listUrl={`/api/doc-anexos?procedimientoId=${id}`}
            uploadUrl="/api/doc-anexos/upload"
            deleteUrlBase="/api/doc-anexos"
            archivoUrlBase="/sig-api/api/doc-anexos"
            queryKey={["sig", "doc-anexos", id]}
            canEdit={canEditSig}
            extraField={{ name: "procedimientoId", value: String(id) }}
          />
        )}

        {effectiveTab === "historial" && (
          <div className="px-3 py-4 space-y-5">
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-2 mb-2">Versiones</h3>
              {proc.commits.length === 0 && (
                <p className="text-[12px] text-zinc-400 italic px-2">Sin commits aún</p>
              )}
              <div className="space-y-1">
                {sortedCommits.map((commit) => (
                  <button
                    key={commit.id}
                    onClick={() => onOpenCommit(commit.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-100 active:bg-zinc-50 transition-colors text-left"
                  >
                    <Circle className={cn("h-2.5 w-2.5 shrink-0", COMMIT_STATE_DOT[commit.estado])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-zinc-700 truncate">{commit.mensaje}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {commit.autorNombre} · {new Date(commit.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-2 mb-2">Análisis</h3>
              {analisisHistorial.length === 0 && (
                <p className="text-[12px] text-zinc-400 italic px-2">Sin análisis aún</p>
              )}
              <div className="space-y-1">
                {analisisHistorial.map((item) => (
                  <button
                    key={`${item.tipo}-${item.id}`}
                    onClick={() => setOpenAnalisisItem(item)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-100 active:bg-zinc-50 transition-colors text-left"
                  >
                    <span className="text-zinc-400 shrink-0">{TIPO_ICON[item.tipo]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-zinc-700 truncate">{TIPO_LABEL[item.tipo]}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {openAnalisisItem && <AnalisisDetailModal item={openAnalisisItem} onClose={() => setOpenAnalisisItem(null)} />}
    </div>
  )
}

// ── Status bar ─────────────────────────────────────────────────────────────────

function StatusBar({
  pendingCount, isGerente, activeView,
}: { pendingCount: number; isGerente: boolean; activeView: ActiveView }) {
  const viewLabel =
    activeView.kind === "procedure"    ? "procedure"
    : activeView.kind === "commit"     ? "diff"
    : activeView.kind === "queue"      ? "queue"
    : activeView.kind === "rubrica"    ? "análisis"
    : activeView.kind === "rag"        ? "grafo de conocimiento"
    : activeView.kind === "analisis-sync" ? "historial de análisis"
    : ""

  return (
    <div className="h-5 shrink-0 flex items-center gap-4 px-4 border-t border-zinc-200 bg-zinc-50">
      <span className="text-[11px] text-helix-accent/60 font-mono font-bold">SIG</span>
      {viewLabel && (
        <>
          <div className="h-3 w-px bg-zinc-200" />
          <span className="text-[11px] text-zinc-500 font-mono">{viewLabel}</span>
        </>
      )}
      {isGerente && pendingCount > 0 && (
        <>
          <div className="h-3 w-px bg-zinc-200" />
          <span className="text-[11px] text-amber-500 font-mono">
            ● {pendingCount} commit{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""}
          </span>
        </>
      )}
    </div>
  )
}
