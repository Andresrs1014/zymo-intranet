import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { MermaidDiagram, svgToPngDataUrl } from "@/components/reportes/MermaidDiagram"
import {
  Download, Target, Lightbulb, GitCompare, Database, Users, CheckCircle2, AlertTriangle,
  ClipboardCheck, ChevronLeft, ChevronRight, Folder, X, Info, FileText, Loader2, Trash2, AlertOctagon,
  List, BookOpen,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnalysisTipo = "coherencia" | "mejoras" | "proc-vs-inst" | "cargos" | "completo"

export interface HistorialItem {
  id:             number
  tipo:           AnalysisTipo
  procedimientoId: number
  autorNombre:    string
  createdAt:      string
  resumen:        string
  coherente?:     boolean
  puntaje?:       number | null
  issues?:        Array<{ tipo?: string; severidad: string; descripcion: string }>
  // proposals/findings: la forma real guardada por el MCP no siempre coincide con estos
  // nombres (hay registros con hallazgo/criticidad/porque o propuesta/prioridad/detalle
  // en vez de descripcion/severidad/categoria) — se leen siempre a través de los
  // normalizadores findingTexto/findingSeveridad/proposalTexto/proposalCategoria de abajo.
  proposals?:     Array<Record<string, unknown>>
  conflictos?:    Array<{ instructivoCodigo: string; descripcion: string; severidad: string }>
  cargos?:        Array<{ cargo: string; funciones: string[] }>
  findings?:      Array<Record<string, unknown>>
  markdownNormalizado?: string | null
  flujogramaMmd?:       string | null
  procedimiento: {
    codigo: string
    titulo: string
    area:   { nombre: string; color: string }
  }
}

// ── Normalizadores de hallazgos/propuestas ──────────────────────────────────────
// Distintas corridas de análisis (vía MCP) guardaron los mismos datos con nombres
// de campo distintos (descripcion/hallazgo/titulo, severidad/criticidad,
// categoria/prioridad, propuesta/detalle...) — sin esto, el texto real queda
// invisible aunque el dato exista en la BD.

function firstText(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function findingTexto(f: Record<string, unknown>): string {
  const principal = firstText(f, ["descripcion", "hallazgo", "titulo"])
  const porque = firstText(f, ["porque", "por_que"])
  if (porque && !principal.includes(porque)) {
    return principal ? `${principal} Por qué: ${porque}` : `Por qué: ${porque}`
  }
  return principal
}
function findingSeveridad(f: Record<string, unknown>): string | undefined {
  return firstText(f, ["severidad", "criticidad"]) || undefined
}
function proposalTexto(p: Record<string, unknown>): string {
  const principal = firstText(p, ["descripcion", "propuesta", "titulo"])
  const detalle = firstText(p, ["detalle"])
  if (detalle && !principal.includes(detalle)) {
    return principal ? `${principal} ${detalle}` : detalle
  }
  return principal
}
function proposalCategoria(p: Record<string, unknown>): string | undefined {
  return firstText(p, ["categoria", "prioridad"]) || undefined
}

// ── Markdown export (se mantiene — sigue siendo útil para pegar en otro lado) ──

function buildMarkdown(item: HistorialItem): string {
  const date = new Date(item.createdAt).toLocaleString("es-CO", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const header = [
    `# Análisis ${TIPO_LABEL[item.tipo]} — ${item.procedimiento.codigo}`,
    ``,
    `**Procedimiento:** ${item.procedimiento.codigo} — ${item.procedimiento.titulo}`,
    `**Área:** ${item.procedimiento.area.nombre}`,
    `**Tipo:** ${TIPO_LABEL[item.tipo]}`,
    `**Fecha:** ${date}`,
    `**Analizado por:** ${item.autorNombre}`,
    ``, `---`, ``,
    `## Resumen`, ``,
    item.resumen ?? "_(análisis por rúbrica — ver hallazgos abajo)_",
    ``,
  ].join("\n")

  if (item.tipo === "coherencia") {
    const score  = item.puntaje != null ? Math.round(item.puntaje * 100) : "N/A"
    const issues = item.issues ?? []
    return header + [
      `## Resultado`, ``,
      `- **Puntaje de coherencia:** ${score}/100`,
      `- **Estado:** ${item.coherente ? "Coherente ✅" : "Con problemas ⚠️"}`,
      ``, `## Hallazgos (${issues.length})`, ``,
      issues.length === 0 ? "_Sin hallazgos_" : issues.map((i) => `- **[${i.severidad}]** ${i.descripcion}`).join("\n"),
    ].join("\n")
  }
  if (item.tipo === "mejoras") {
    const props = item.proposals ?? []
    return header + [
      `## Propuestas de mejora (${props.length})`, ``,
      props.length === 0 ? "_Sin propuestas_" : props.map((p, i) => {
        const cat = proposalCategoria(p)
        return `${i + 1}. ${proposalTexto(p)}${cat ? ` _(${cat})_` : ""}`
      }).join("\n"),
    ].join("\n")
  }
  if (item.tipo === "proc-vs-inst") {
    const conflicts = item.conflictos ?? []
    return header + [
      `## Resultado`, ``,
      `- **Estado:** ${item.coherente ? "Alineado ✅" : "Con conflictos ⚠️"}`,
      ``, `## Conflictos (${conflicts.length})`, ``,
      conflicts.length === 0 ? "_Sin conflictos_" : conflicts.map((c) => `- **[${c.severidad}]** \`${c.instructivoCodigo}\` — ${c.descripcion}`).join("\n"),
    ].join("\n")
  }
  if (item.tipo === "cargos") {
    const cargos = item.cargos ?? []
    return header + [
      `## Cargos y Funciones (${cargos.length})`, ``,
      cargos.length === 0 ? "_Sin cargos identificados_" : cargos.map((c) => [`### ${c.cargo}`, ``, c.funciones.map((f) => `- ${f}`).join("\n")].join("\n")).join("\n\n"),
    ].join("\n")
  }
  if (item.tipo === "completo") {
    const findings = item.findings ?? []
    return header + [
      `## Hallazgos por rúbrica (${findings.length})`, ``,
      findings.length === 0 ? "_Sin hallazgos_" : findings.map((f) => {
        const sev = findingSeveridad(f)
        const cat = firstText(f, ["categoria"]) || "general"
        return `- **[${cat}${sev ? `/${sev}` : ""}]** ${findingTexto(f)}`
      }).join("\n"),
      ``,
      item.markdownNormalizado ? `## Markdown normalizado\n\n${item.markdownNormalizado}` : "",
      item.flujogramaMmd ? `## Flujograma\n\n\`\`\`mermaid\n${item.flujogramaMmd}\n\`\`\`` : "",
    ].filter(Boolean).join("\n")
  }
  return header
}

function downloadMarkdown(item: HistorialItem) {
  const md = buildMarkdown(item)
  const filename = `${item.procedimiento.codigo}_${item.tipo}_${new Date(item.createdAt).toISOString().split("T")[0]}.md`
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadAllMarkdown(items: HistorialItem[], filename: string) {
  const combined = items.map(buildMarkdown).join("\n\n---\n\n")
  const blob = new Blob([combined], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TIPO_LABEL: Record<AnalysisTipo, string> = {
  coherencia: "Coherencia", mejoras: "Mejoras", "proc-vs-inst": "Proc/Inst", cargos: "Cargos", completo: "Completo",
}
export const TIPO_ICON: Record<AnalysisTipo, React.ReactNode> = {
  coherencia: <Target className="h-3.5 w-3.5" />,
  mejoras: <Lightbulb className="h-3.5 w-3.5" />,
  "proc-vs-inst": <GitCompare className="h-3.5 w-3.5" />,
  cargos: <Users className="h-3.5 w-3.5" />,
  completo: <ClipboardCheck className="h-3.5 w-3.5" />,
}

// Páginas del "libro" del análisis completo -- mismo orden y mismos criterios de
// qué se omite (sin flujograma/sin hallazgo de flujograma) que el PDF generado en
// el backend (template_sig_analisis.html), para que la vista en pantalla y el PDF
// descargado sean consistentes entre sí.
type BookPageKey = "portada" | "hallazgos" | "flujograma" | "hallazgosFlujograma" | "conclusiones" | "anexo"
const BOOK_PAGE_LABEL: Record<BookPageKey, string> = {
  portada: "Portada",
  hallazgos: "Análisis y hallazgos de procedimiento",
  flujograma: "Flujograma",
  hallazgosFlujograma: "Hallazgos de flujograma",
  conclusiones: "Conclusiones",
  anexo: "Anexo — Documento normalizado",
}
const TIPO_CHIP: Record<AnalysisTipo, string> = {
  coherencia: "bg-blue-50 text-blue-600 border-blue-200",
  mejoras: "bg-amber-50 text-amber-600 border-amber-200",
  "proc-vs-inst": "bg-violet-50 text-violet-600 border-violet-200",
  cargos: "bg-rose-50 text-rose-600 border-rose-200",
  completo: "bg-emerald-50 text-emerald-600 border-emerald-200",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SigAnalisisSyncView() {
  const [areaSel, setAreaSel] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<HistorialItem | null>(null)

  const { data: historial = [], isLoading } = useQuery<HistorialItem[]>({
    queryKey: ["sig", "analisis", "historial"],
    queryFn: () => sigApi.get("/api/analisis/historial", { params: { limit: 500 } }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const areas = useMemo(() => {
    const map = new Map<string, { nombre: string; color: string; items: HistorialItem[] }>()
    for (const item of historial) {
      const key = item.procedimiento.area.nombre
      if (!map.has(key)) map.set(key, { nombre: key, color: item.procedimiento.area.color, items: [] })
      map.get(key)!.items.push(item)
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length)
  }, [historial])

  const activeArea = areas.find((a) => a.nombre === areaSel) ?? null

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-11 border-b border-zinc-200 bg-white">
        {activeArea ? (
          <button
            onClick={() => setAreaSel(null)}
            className="flex items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: activeArea.color }} />
            <span className="font-semibold text-zinc-800">{activeArea.nombre}</span>
          </button>
        ) : (
          <>
            <Database className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="text-[13px] font-semibold text-zinc-800">Historial de Análisis</span>
          </>
        )}

        {activeArea && activeArea.items.length > 0 && (
          <button
            onClick={() => downloadAllMarkdown(activeArea.items, `sig_analisis_${activeArea.nombre}_${new Date().toISOString().split("T")[0]}.md`)}
            className="ml-auto flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar todo ({activeArea.items.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-2 text-zinc-400">
            <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
            <span className="text-xs">Cargando historial…</span>
          </div>
        )}

        {!isLoading && historial.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Database className="h-8 w-8 text-zinc-300" />
            <div className="text-center">
              <p className="text-sm text-zinc-500">Sin análisis guardados</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Los análisis ejecutados desde la intranet o el MCP quedan guardados aquí.
              </p>
            </div>
          </div>
        )}

        {/* Nivel 1 — grid de áreas */}
        {!isLoading && !activeArea && areas.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 py-5 grid grid-cols-2 gap-3">
            {areas.map((a) => (
              <button
                key={a.nombre}
                onClick={() => setAreaSel(a.nombre)}
                className="flex items-center gap-3 bg-white rounded-lg px-4 py-3.5 shadow-sm hover:shadow transition-shadow text-left"
              >
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${a.color}15` }}
                >
                  <Folder className="h-4 w-4" style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-zinc-800 truncate">{a.nombre}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {a.items.length} análisis · {new Set(a.items.map((i) => i.procedimientoId)).size} procedimiento(s)
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Nivel 2 — análisis del área seleccionada */}
        {!isLoading && activeArea && (
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
            {activeArea.items.map((item) => (
              <HistorialRow
                key={`${item.tipo}-${item.id}`}
                item={item}
                onOpen={() => setOpenItem(item)}
                onDownload={() => downloadMarkdown(item)}
              />
            ))}
          </div>
        )}
      </div>

      {openItem && <AnalisisDetailModal item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  )
}

// ── Eliminar análisis — mismo permiso que editar el SIG ────────────────────────

function useCanEditSig(): boolean {
  const user = useAuthStore((s) => s.user)
  return user?.role === "admin" || user?.role === "gerente" || (user?.app_permissions?.includes("mod_sig") ?? false)
}

function useDeleteAnalisis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tipo, id }: { tipo: AnalysisTipo; id: number }) => sigApi.delete(`/api/analisis/${tipo}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sig", "analisis", "historial"] }),
  })
}

// ── Historial row — clickeable, con preview al pasar el mouse ─────────────────

function HistorialRow({ item, onOpen, onDownload }: { item: HistorialItem; onOpen: () => void; onDownload: () => void }) {
  const canEditSig = useCanEditSig()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteMut = useDeleteAnalisis()
  const score = item.puntaje != null ? Math.round(item.puntaje * 100) : null
  const scoreColor = score == null ? "" : score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"
  const proposals = item.proposals ?? []
  const conflictos = item.conflictos ?? []
  const cargos = item.cargos ?? []
  const findings = item.findings ?? []

  return (
    <div className="relative group">
      <button
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-lg shadow-sm hover:shadow transition-shadow text-left"
      >
        <div className="h-9 w-0.5 rounded-full shrink-0" style={{ backgroundColor: item.procedimiento.area.color }} />

        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0", TIPO_CHIP[item.tipo])}>
          {TIPO_ICON[item.tipo]}
          <span>{TIPO_LABEL[item.tipo]}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-medium text-zinc-700">{item.procedimiento.codigo}</span>
            <span className="text-[11px] text-zinc-400 truncate">{item.procedimiento.titulo}</span>
          </div>
        </div>

        <div className="shrink-0 text-right min-w-[70px]">
          {item.tipo === "coherencia" && score != null && (
            <span className={cn("text-[13px] font-semibold tabular-nums", scoreColor)}>
              {score}<span className="text-[11px] font-normal text-zinc-400">/100</span>
            </span>
          )}
          {item.tipo === "mejoras" && (
            <span className="text-[11px] text-zinc-600"><span className="font-semibold text-zinc-800">{proposals.length}</span> prop.</span>
          )}
          {item.tipo === "proc-vs-inst" && (
            item.coherente
              ? <span className="flex items-center justify-end gap-1 text-[11px] text-emerald-600"><CheckCircle2 className="h-3 w-3" />Alineado</span>
              : <span className="flex items-center justify-end gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3 w-3" />{conflictos.length} confl.</span>
          )}
          {item.tipo === "cargos" && (
            <span className="text-[11px] text-zinc-600"><span className="font-semibold text-zinc-800">{cargos.length}</span> cargos</span>
          )}
          {item.tipo === "completo" && (
            <span className="text-[11px] text-zinc-600"><span className="font-semibold text-zinc-800">{findings.length}</span> hallazgos</span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          title="Descargar como Markdown"
          className="h-7 w-7 rounded flex items-center justify-center text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {canEditSig && (
          confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => deleteMut.mutate({ tipo: item.tipo, id: item.id })}
                disabled={deleteMut.isPending}
                className="text-[11px] px-1.5 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
              >
                {deleteMut.isPending ? "…" : "Sí, borrar"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] px-1.5 py-1 rounded text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              title="Eliminar análisis"
              className="h-7 w-7 rounded flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </button>

      {/* Preview al pasar el mouse — metadatos, no un resumen de texto */}
      <div className="absolute left-4 top-full mt-1 z-20 w-64 rounded-lg bg-zinc-900 text-white px-3 py-2.5 text-[11px] shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 text-zinc-400 mb-1.5">
          <Info className="h-3 w-3" />
          <span>Detalle del análisis</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-3"><span className="text-zinc-500">Analizado por</span><span className="text-zinc-100">{item.autorNombre}</span></div>
          <div className="flex justify-between gap-3"><span className="text-zinc-500">Fecha</span><span className="text-zinc-100">{fmtDate(item.createdAt)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-zinc-500">Motor</span><span className="text-zinc-100">{item.tipo === "completo" ? "MCP-001 (agente externo)" : "Gemini (servidor)"}</span></div>
        </div>
      </div>
    </div>
  )
}

// ── Vista de detalle — formato visual, no markdown crudo ───────────────────────

function SeverityBadge({ severidad }: { severidad: string }) {
  const s = severidad.toLowerCase()
  const cls =
    s === "alta" || s === "high" ? "bg-red-50 text-red-600 border-red-200" :
    s === "media" || s === "medium" ? "bg-amber-50 text-amber-600 border-amber-200" :
    "bg-zinc-100 text-zinc-500 border-zinc-200"
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium uppercase shrink-0", cls)}>{severidad}</span>
}

// Solo pide el PDF y devuelve el blob -- lo que se hace con él (descargarlo,
// mostrarlo en un visor embebido) queda a cargo de quien llama.
async function fetchAnalisisPdfBlob(item: HistorialItem, flujogramaPng: string | null): Promise<Blob> {
  const payload = {
    tipo: item.tipo,
    autorNombre: item.autorNombre,
    createdAt: item.createdAt,
    resumen: item.resumen ?? null,
    coherente: item.coherente ?? null,
    puntaje: item.puntaje ?? null,
    issues: item.issues ?? [],
    // Normalizados a {descripcion, categoria} — la forma cruda tiene nombres de
    // campo inconsistentes entre corridas de análisis (ver findingTexto/proposalTexto).
    proposals: (item.proposals ?? []).map((p) => ({ descripcion: proposalTexto(p), categoria: proposalCategoria(p) ?? null })),
    conflictos: item.conflictos ?? [],
    cargos: item.cargos ?? [],
    findings: (item.findings ?? []).map((f) => ({
      descripcion: findingTexto(f),
      categoria: firstText(f, ["categoria"]) || null,
      severidad: findingSeveridad(f) ?? null,
    })),
    markdownNormalizado: item.markdownNormalizado ?? null,
    flujogramaPng: flujogramaPng,
    procedimiento: item.procedimiento,
  }
  const res = await api.post("/api/sig/pdf/analisis", payload, { responseType: "blob" })
  return new Blob([res.data], { type: "application/pdf" })
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Algunos análisis guardados incrustaron el flujograma como un bloque ```mermaid
// dentro del markdown normalizado en vez de usar el campo flujogramaMmd dedicado —
// sin este override, ReactMarkdown lo muestra como código plano en vez de dibujarlo.
const MARKDOWN_MERMAID_COMPONENTS: Components = {
  code({ className, children, ...rest }) {
    if (/language-mermaid/.test(className || "")) {
      return <MermaidDiagram code={String(children).replace(/\n$/, "")} />
    }
    return <code className={className} {...rest}>{children}</code>
  },
}

// Vista a pantalla completa, tipo informe — pensada para leerse en una reunión
// de comité, no para un vistazo rápido. Tipografía de lectura real (15-16px,
// nunca la densidad compacta que usa el resto del SIG) y harto espacio.

export function AnalisisDetailModal({ item, onClose }: { item: HistorialItem; onClose: () => void }) {
  const score = item.puntaje != null ? Math.round(item.puntaje * 100) : null
  const flujogramaRef = useRef<HTMLDivElement>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const canEditSig = useCanEditSig()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteMut = useDeleteAnalisis()
  const [bookPage, setBookPage] = useState(0)
  const [viewMode, setViewMode] = useState<"paginado" | "lineal">("paginado")

  useEffect(() => setBookPage(0), [item.id])

  function handleDelete() {
    deleteMut.mutate({ tipo: item.tipo, id: item.id }, { onSuccess: onClose })
  }

  function pdfFilename() {
    return `${item.procedimiento.codigo}_analisis_${item.tipo}_${new Date(item.createdAt).toISOString().split("T")[0]}.pdf`
  }

  // El flujograma, si existe, ya está renderizado en el DOM por <MermaidDiagram> — sea
  // el del campo dedicado o uno incrustado como ```mermaid dentro del documento
  // normalizado (ver MARKDOWN_MERMAID_COMPONENTS). No hay renderer de mermaid en el
  // servidor, así que se rasteriza a PNG acá mismo (WeasyPrint no soporta el <style>
  // con clases CSS que Mermaid embebe en el SVG — el texto salía en blanco).
  async function currentFlujogramaPng() {
    const svgEl = flujogramaRef.current?.querySelector("svg")
    return svgEl ? await svgToPngDataUrl(svgEl) : null
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    setPdfError(null)
    try {
      const blob = await fetchAnalisisPdfBlob(item, await currentFlujogramaPng())
      triggerBlobDownload(blob, pdfFilename())
    } catch {
      setPdfError("No se pudo generar el PDF — revisa logs del servidor.")
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Mismo criterio que el backend (sig_pdf.py) para separar el hallazgo de coherencia
  // de flujograma del resto -- así la vista en pantalla y el PDF muestran la misma
  // paginación con el mismo contenido en cada página.
  const findingsFlujograma = (item.findings ?? []).filter(
    (f) => (firstText(f, ["categoria"]) || "").trim().toLowerCase() === "coherencia_flujograma",
  )
  const findingsProcedimiento = (item.findings ?? []).filter(
    (f) => (firstText(f, ["categoria"]) || "").trim().toLowerCase() !== "coherencia_flujograma",
  )
  const hasFlujograma = !!item.flujogramaMmd
  const hasFlujogramaFinding = findingsFlujograma.length > 0
  const hasAnexo = !!item.markdownNormalizado
  const bookPages: BookPageKey[] = [
    "portada", "hallazgos",
    ...(hasFlujograma ? (["flujograma"] as const) : []),
    ...(hasFlujogramaFinding ? (["hallazgosFlujograma"] as const) : []),
    "conclusiones",
    ...(hasAnexo ? (["anexo"] as const) : []),
  ]
  const activePage = bookPages[bookPage] ?? "portada"

  // Contenido de cada página del análisis "completo" — se define una sola vez y se
  // reutiliza tanto en modo paginado (una página visible, absolute+opacity) como en
  // modo lineal (todas apiladas en un scroll único), para no duplicar el markup.
  const portadaBody = (
    <>
      <div className="text-white/80 text-[11px] font-mono font-bold tracking-widest mb-6">
        ZYMO · SIG · {item.procedimiento.area.nombre}
      </div>
      <div className="flex items-center gap-2 text-white/90 text-[12px] mb-3">
        {TIPO_ICON[item.tipo]}
        <span className="font-medium">Análisis de {TIPO_LABEL[item.tipo]}</span>
      </div>
      <h1 className="text-white text-2xl font-semibold leading-tight">
        {item.procedimiento.codigo} — {item.procedimiento.titulo}
      </h1>
      <p className="text-white/70 text-[13px] mt-4">{fmtDateTime(item.createdAt)}</p>
    </>
  )

  const hallazgosBody = (
    <>
      <h2 className="text-[17px] font-semibold text-zinc-800 pb-2.5 mb-4 border-b-2 border-zinc-800">Análisis y hallazgos de procedimiento</h2>
      <p className="text-[13px] text-zinc-600 leading-relaxed mb-5">
        Análisis completo (rúbrica) de {item.procedimiento.codigo} — {item.procedimiento.titulo}.
        Se identificaron {findingsProcedimiento.length} hallazgo{findingsProcedimiento.length !== 1 ? "s" : ""}.
      </p>
      {findingsProcedimiento.length > 0 ? (
        <div className="space-y-3">
          {findingsProcedimiento.map((f, idx) => {
            const sev = findingSeveridad(f)
            const cat = firstText(f, ["categoria"])
            return (
              <div key={idx} className="flex items-start gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                {sev && <SeverityBadge severidad={sev} />}
                <p className="text-[13px] text-zinc-700 leading-relaxed">
                  {cat && <span className="text-zinc-400 font-medium">{cat}: </span>}
                  {findingTexto(f)}
                </p>
              </div>
            )
          })}
        </div>
      ) : <span className="text-[13px] text-zinc-400 italic">Sin hallazgos de procedimiento</span>}
    </>
  )

  const flujogramaBody = (
    <>
      <h2 className="text-[17px] font-semibold text-zinc-800 pb-2.5 mb-4 border-b-2 border-zinc-800">Flujograma</h2>
      <MermaidDiagram code={item.flujogramaMmd!} />
    </>
  )

  const hallazgosFlujogramaBody = (
    <>
      <h2 className="text-[17px] font-semibold text-zinc-800 pb-2.5 mb-4 border-b-2 border-zinc-800">Hallazgos de flujograma</h2>
      <div className="space-y-3">
        {findingsFlujograma.map((f, idx) => {
          const sev = findingSeveridad(f)
          return (
            <div key={idx} className="flex items-start gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
              {sev && <SeverityBadge severidad={sev} />}
              <p className="text-[13px] text-zinc-700 leading-relaxed">{findingTexto(f)}</p>
            </div>
          )
        })}
      </div>
    </>
  )

  const conclusionesBody = (
    <>
      <h2 className="text-[17px] font-semibold text-zinc-800 pb-2.5 mb-4 border-b-2 border-zinc-800">Conclusiones</h2>
      {(item.proposals ?? []).length > 0 ? (
        <div className="space-y-4">
          <p className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wide">Propuestas de mejora</p>
          {(item.proposals ?? []).map((p, idx) => {
            const cat = proposalCategoria(p)
            return (
              <div key={idx} className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 text-[12px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                <div>
                  <p className="text-[13px] text-zinc-700 leading-relaxed">{proposalTexto(p)}</p>
                  {cat && <p className="text-[12px] text-zinc-400 mt-1">{cat}</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : <span className="text-[13px] text-zinc-400 italic">Sin propuestas de mejora registradas</span>}
    </>
  )

  const anexoBody = (
    <>
      <h2 className="text-[17px] font-semibold text-zinc-800 pb-2.5 mb-4 border-b-2 border-zinc-800 not-prose">Anexo — Documento normalizado</h2>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_MERMAID_COMPONENTS}>
        {item.markdownNormalizado!}
      </ReactMarkdown>
    </>
  )

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-800">

      {/* Barra superior fija — una sola línea con cierre, navegación de páginas
          (solo en modo paginado) y el toggle libro/lineal. */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 h-12 bg-white border-b border-zinc-200">
        <span className="text-zinc-400 text-[12px] shrink-0">Vista de presentación</span>

        {item.tipo === "completo" && viewMode === "paginado" && (
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            <button
              onClick={() => setBookPage((p) => Math.max(0, p - 1))}
              disabled={bookPage === 0}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-zinc-600 text-[12px] truncate">
              {BOOK_PAGE_LABEL[activePage]} <span className="text-zinc-400 tabular-nums">· {bookPage + 1}/{bookPages.length}</span>
            </span>
            <button
              onClick={() => setBookPage((p) => Math.min(bookPages.length - 1, p + 1))}
              disabled={bookPage === bookPages.length - 1}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 shrink-0">
          {item.tipo === "completo" && (
            <button
              onClick={() => setViewMode((m) => (m === "paginado" ? "lineal" : "paginado"))}
              className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              {viewMode === "paginado" ? <><List className="h-3.5 w-3.5" />Ver todo</> : <><BookOpen className="h-3.5 w-3.5" />Ver paginado</>}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Cerrar
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {item.tipo === "completo" && viewMode === "paginado" ? (
        /* "Libro" — proporción A4. Todas las páginas quedan montadas en el DOM (para
           que el flujograma siempre tenga geometría real y el PDF lo pueda rasterizar
           sin importar qué página se esté viendo), solo una es visible a la vez. */
        <div className="flex-1 overflow-auto flex items-start justify-center py-8 px-4">
          <div className="relative w-full max-w-[720px] aspect-[210/297] bg-white rounded-lg shadow-2xl shrink-0 overflow-hidden">

            <div
              className={cn(
                "absolute inset-0 overflow-y-auto flex flex-col items-center justify-center px-10 text-center transition-opacity duration-200",
                activePage === "portada" ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
              style={{ backgroundColor: item.procedimiento.area.color }}
            >
              {portadaBody}
            </div>

            <div className={cn("absolute inset-0 overflow-y-auto p-10 transition-opacity duration-200", activePage === "hallazgos" ? "opacity-100" : "opacity-0 pointer-events-none")}>
              {hallazgosBody}
            </div>

            {hasFlujograma && (
              <div ref={flujogramaRef} className={cn("absolute inset-0 overflow-y-auto p-10 transition-opacity duration-200", activePage === "flujograma" ? "opacity-100" : "opacity-0 pointer-events-none")}>
                {flujogramaBody}
              </div>
            )}

            {hasFlujogramaFinding && (
              <div className={cn("absolute inset-0 overflow-y-auto p-10 transition-opacity duration-200", activePage === "hallazgosFlujograma" ? "opacity-100" : "opacity-0 pointer-events-none")}>
                {hallazgosFlujogramaBody}
              </div>
            )}

            <div className={cn("absolute inset-0 overflow-y-auto p-10 transition-opacity duration-200", activePage === "conclusiones" ? "opacity-100" : "opacity-0 pointer-events-none")}>
              {conclusionesBody}
            </div>

            {hasAnexo && (
              <div className={cn(
                "absolute inset-0 overflow-y-auto p-10 prose prose-sm max-w-none prose-headings:text-zinc-800 prose-p:text-zinc-700 prose-p:leading-relaxed transition-opacity duration-200",
                activePage === "anexo" ? "opacity-100" : "opacity-0 pointer-events-none",
              )}>
                {anexoBody}
              </div>
            )}

          </div>
        </div>
      ) : item.tipo === "completo" ? (
        /* Vista lineal — todas las páginas apiladas en un solo scroll, para saltar
           pasos rápido en vez de navegar página por página. Mismo contenido que el
           libro paginado (reutiliza los *Body de arriba), solo cambia el envoltorio. */
        <div className="flex-1 overflow-y-auto">
          <div className="w-[94%] max-w-[960px] mx-auto my-8 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-10 py-10 text-center" style={{ backgroundColor: item.procedimiento.area.color }}>
              {portadaBody}
            </div>
            <div className="px-10 py-8">
              <section className="pb-8 border-b border-zinc-100">{hallazgosBody}</section>
              {hasFlujograma && <section ref={flujogramaRef} className="py-8 border-b border-zinc-100">{flujogramaBody}</section>}
              {hasFlujogramaFinding && <section className="py-8 border-b border-zinc-100">{hallazgosFlujogramaBody}</section>}
              <section className="py-8 border-b border-zinc-100 last:border-0">{conclusionesBody}</section>
              {hasAnexo && (
                <section className="pt-8 prose prose-sm max-w-none prose-headings:text-zinc-800 prose-p:text-zinc-700 prose-p:leading-relaxed">
                  {anexoBody}
                </section>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* "Hoja" del informe, centrada, scrolleable — sin cambios para los demás tipos de análisis */
        <div className="flex-1 overflow-y-auto">
          <div className="w-[94%] max-w-[960px] mx-auto my-8 bg-white rounded-2xl shadow-2xl overflow-hidden">

            <div className="px-10 py-10" style={{ backgroundColor: item.procedimiento.area.color }}>
              <div className="flex items-center gap-2 text-white/80 text-[13px] font-medium mb-4">
                <span className="font-mono font-bold tracking-widest">ZYMO · SIG</span>
                <span>·</span>
                <span>{item.procedimiento.area.nombre}</span>
              </div>
              <div className="flex items-center gap-2 text-white/90 text-[13px] mb-2">
                {TIPO_ICON[item.tipo]}
                <span className="font-medium">Análisis de {TIPO_LABEL[item.tipo]}</span>
              </div>
              <h1 className="text-white text-3xl font-semibold leading-tight">
                {item.procedimiento.codigo} — {item.procedimiento.titulo}
              </h1>
              <p className="text-white/70 text-[14px] mt-3">{fmtDateTime(item.createdAt)}</p>
            </div>

            <div className="px-10 py-8 space-y-6">

              {item.resumen && (
                <p className="text-[16px] text-zinc-700 leading-relaxed">{item.resumen}</p>
              )}

              {item.tipo === "coherencia" && (
                <>
                  <div className="flex items-center gap-6 py-2">
                    <div className="text-center shrink-0">
                      <p className={cn("text-5xl font-bold tabular-nums", score == null ? "text-zinc-300" : score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600")}>
                        {score ?? "—"}
                      </p>
                      <p className="text-[11px] text-zinc-400 uppercase tracking-wide mt-1">de 100</p>
                    </div>
                    <div className="h-14 w-px bg-zinc-100" />
                    <div>
                      <p className="text-[16px] font-medium text-zinc-800">
                        {item.coherente ? "Coherente" : "Con problemas de coherencia"}
                      </p>
                      <p className="text-[13px] text-zinc-400 mt-0.5">{(item.issues ?? []).length} hallazgo(s) encontrados</p>
                    </div>
                  </div>
                  {(item.issues ?? []).length > 0 && (
                    <section>
                      <h2 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Hallazgos</h2>
                      <div className="space-y-3">
                        {(item.issues ?? []).map((i, idx) => (
                          <div key={idx} className="flex items-start gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                            <SeverityBadge severidad={i.severidad} />
                            <p className="text-[15px] text-zinc-700 leading-relaxed">{i.descripcion}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {item.tipo === "mejoras" && (item.proposals ?? []).length > 0 && (
                <section>
                  <h2 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Propuestas de mejora</h2>
                  <div className="space-y-4">
                    {(item.proposals ?? []).map((p, idx) => {
                      const cat = proposalCategoria(p)
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 text-[12px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                          <div>
                            <p className="text-[15px] text-zinc-700 leading-relaxed">{proposalTexto(p)}</p>
                            {cat && <p className="text-[12px] text-zinc-400 mt-1">{cat}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {item.tipo === "proc-vs-inst" && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    {item.coherente
                      ? <span className="flex items-center gap-1.5 text-[15px] text-emerald-600 font-medium"><CheckCircle2 className="h-4 w-4" />Alineado con los instructivos</span>
                      : <span className="flex items-center gap-1.5 text-[15px] text-amber-600 font-medium"><AlertTriangle className="h-4 w-4" />{(item.conflictos ?? []).length} conflicto(s) encontrados</span>
                    }
                  </div>
                  <div className="space-y-3">
                    {(item.conflictos ?? []).map((c, idx) => (
                      <div key={idx} className="flex items-start gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                        <SeverityBadge severidad={c.severidad} />
                        <p className="text-[15px] text-zinc-700 leading-relaxed">
                          <span className="font-mono text-zinc-400 text-[13px]">{c.instructivoCodigo}</span> — {c.descripcion}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {item.tipo === "cargos" && (item.cargos ?? []).map((c, idx) => (
                <section key={idx}>
                  <h2 className="text-[16px] font-semibold text-zinc-800 mb-2">{c.cargo}</h2>
                  <ul className="space-y-1.5">
                    {c.funciones.map((f, i) => (
                      <li key={i} className="text-[14px] text-zinc-600 flex items-start gap-2">
                        <span className="text-zinc-300 mt-1">·</span><span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pie fijo — visible sin importar en qué página del libro se esté */}
      <div className="shrink-0 flex items-center justify-between px-10 py-2.5 border-t border-zinc-200 bg-white">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-zinc-400">Generado por la intranet ZYMO — SIG</span>
          {pdfError && <span className="text-[11px] text-red-500">{pdfError}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canEditSig && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5 mr-1 text-[12px]">
                <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
                <span className="text-zinc-500">¿Eliminar este análisis?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleteMut.isPending}
                  className="px-2 py-1 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleteMut.isPending ? "…" : "Sí, borrar"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-400 hover:border-red-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            )
          )}
          <button
            onClick={() => downloadMarkdown(item)}
            className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Descargar .md
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {downloadingPdf ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}
