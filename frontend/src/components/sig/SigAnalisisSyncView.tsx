import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { MermaidDiagram } from "@/components/reportes/MermaidDiagram"
import {
  Download, Target, Lightbulb, GitCompare, Database, Users, CheckCircle2, AlertTriangle,
  ClipboardCheck, ChevronLeft, ChevronRight, Folder, X, Info,
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
  proposals?:     Array<{ descripcion: string; categoria?: string }>
  conflictos?:    Array<{ instructivoCodigo: string; descripcion: string; severidad: string }>
  cargos?:        Array<{ cargo: string; funciones: string[] }>
  findings?:            Array<{ categoria?: string; severidad?: string; descripcion: string }>
  markdownNormalizado?: string | null
  flujogramaMmd?:       string | null
  procedimiento: {
    codigo: string
    titulo: string
    area:   { nombre: string; color: string }
  }
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
      props.length === 0 ? "_Sin propuestas_" : props.map((p, i) => `${i + 1}. ${p.descripcion}${p.categoria ? ` _(${p.categoria})_` : ""}`).join("\n"),
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
      findings.length === 0 ? "_Sin hallazgos_" : findings.map((f) => `- **[${f.categoria ?? "general"}${f.severidad ? `/${f.severidad}` : ""}]** ${f.descripcion}`).join("\n"),
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

// ── Historial row — clickeable, con preview al pasar el mouse ─────────────────

function HistorialRow({ item, onOpen, onDownload }: { item: HistorialItem; onOpen: () => void; onDownload: () => void }) {
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

// Vista a pantalla completa, tipo informe — pensada para leerse en una reunión
// de comité, no para un vistazo rápido. Tipografía de lectura real (15-16px,
// nunca la densidad compacta que usa el resto del SIG) y harto espacio.

export function AnalisisDetailModal({ item, onClose }: { item: HistorialItem; onClose: () => void }) {
  const score = item.puntaje != null ? Math.round(item.puntaje * 100) : null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-800">

      {/* Barra superior fija — mínima, para no competir con el informe */}
      <div className="shrink-0 flex items-center justify-between px-6 h-12 bg-zinc-900">
        <span className="text-white/50 text-[12px]">Vista de presentación — historial de análisis</span>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[12px] text-white/70 hover:text-white transition-colors"
        >
          Cerrar
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* "Hoja" del informe, centrada, scrolleable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto my-8 bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Portada / banda superior */}
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
            <p className="text-white/70 text-[14px] mt-3">
              {fmtDateTime(item.createdAt)} · Analizado por {item.autorNombre}
            </p>
          </div>

          {/* Cuerpo del informe */}
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
                  {(item.proposals ?? []).map((p, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 text-[12px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                      <div>
                        <p className="text-[15px] text-zinc-700 leading-relaxed">{p.descripcion}</p>
                        {p.categoria && <p className="text-[12px] text-zinc-400 mt-1">{p.categoria}</p>}
                      </div>
                    </div>
                  ))}
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

            {item.tipo === "completo" && (
              <>
                {(item.findings ?? []).length > 0 && (
                  <section>
                    <h2 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Hallazgos por rúbrica</h2>
                    <div className="space-y-3">
                      {(item.findings ?? []).map((f, idx) => (
                        <div key={idx} className="flex items-start gap-3 pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                          {f.severidad && <SeverityBadge severidad={f.severidad} />}
                          <p className="text-[15px] text-zinc-700 leading-relaxed">
                            {f.categoria && <span className="text-zinc-400 font-medium">{f.categoria}: </span>}
                            {f.descripcion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {item.flujogramaMmd && (
                  <section>
                    <h2 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Flujograma</h2>
                    <MermaidDiagram code={item.flujogramaMmd} />
                  </section>
                )}
                {item.markdownNormalizado && (
                  <section className="prose prose-base max-w-none prose-headings:text-zinc-800 prose-p:text-zinc-700 prose-p:leading-relaxed">
                    <h2 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide not-prose mb-3">Documento normalizado</h2>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.markdownNormalizado}</ReactMarkdown>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Pie del informe */}
          <div className="flex items-center justify-between px-10 py-5 border-t border-zinc-100 bg-zinc-50">
            <span className="text-[11px] text-zinc-400">Generado por la intranet ZYMO — SIG</span>
            <button
              onClick={() => downloadMarkdown(item)}
              className="flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-white transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar .md
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
