import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { sigApi } from "@/lib/sigApi"
import { Download, Filter, Target, Lightbulb, GitCompare, Database, CheckCircle2, AlertTriangle } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

type AnalysisTipo = "coherencia" | "mejoras" | "proc-vs-inst"

interface HistorialItem {
  id:             number
  tipo:           AnalysisTipo
  procedimientoId: number
  autorNombre:    string
  createdAt:      string
  resumen:        string
  // coherencia
  coherente?:     boolean
  puntaje?:       number | null
  issues?:        unknown[]
  // mejoras
  proposals?:     unknown[]
  // proc-vs-inst
  conflictos?:    unknown[]
  procedimiento: {
    codigo: string
    titulo: string
    area:   { nombre: string; color: string }
  }
}

// ── Markdown export ───────────────────────────────────────────────────────────

function buildMarkdown(item: HistorialItem): string {
  const date   = new Date(item.createdAt).toLocaleString("es-CO", {
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
    ``,
    `---`,
    ``,
    `## Resumen`,
    ``,
    item.resumen,
    ``,
  ].join("\n")

  if (item.tipo === "coherencia") {
    const score  = item.puntaje != null ? Math.round(item.puntaje * 100) : "N/A"
    const issues = (item.issues as Array<{ tipo: string; descripcion: string; severidad: string }> | undefined) ?? []
    return header + [
      `## Resultado`,
      ``,
      `- **Puntaje de coherencia:** ${score}/100`,
      `- **Estado:** ${item.coherente ? "Coherente ✅" : "Con problemas ⚠️"}`,
      ``,
      `## Hallazgos (${issues.length})`,
      ``,
      issues.length === 0
        ? "_Sin hallazgos_"
        : issues.map((i) => `- **[${i.severidad}]** ${i.descripcion}`).join("\n"),
    ].join("\n")
  }

  if (item.tipo === "mejoras") {
    const props = (item.proposals as Array<{ descripcion: string; categoria?: string }> | undefined) ?? []
    return header + [
      `## Propuestas de mejora (${props.length})`,
      ``,
      props.length === 0
        ? "_Sin propuestas_"
        : props.map((p, i) => `${i + 1}. ${p.descripcion}${p.categoria ? ` _(${p.categoria})_` : ""}`).join("\n"),
    ].join("\n")
  }

  if (item.tipo === "proc-vs-inst") {
    const conflicts = (item.conflictos as Array<{ instructivoCodigo: string; descripcion: string; severidad: string }> | undefined) ?? []
    return header + [
      `## Resultado`,
      ``,
      `- **Estado:** ${item.coherente ? "Alineado ✅" : "Con conflictos ⚠️"}`,
      ``,
      `## Conflictos (${conflicts.length})`,
      ``,
      conflicts.length === 0
        ? "_Sin conflictos_"
        : conflicts.map((c) => `- **[${c.severidad}]** \`${c.instructivoCodigo}\` — ${c.descripcion}`).join("\n"),
    ].join("\n")
  }

  return header
}

function downloadMarkdown(item: HistorialItem) {
  const md       = buildMarkdown(item)
  const filename = `${item.procedimiento.codigo}_${item.tipo}_${new Date(item.createdAt).toISOString().split("T")[0]}.md`
  const blob     = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement("a")
  a.href         = url
  a.download     = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadAllMarkdown(items: HistorialItem[]) {
  const combined = items.map(buildMarkdown).join("\n\n---\n\n")
  const blob     = new Blob([combined], { type: "text/markdown;charset=utf-8" })
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement("a")
  a.href         = url
  a.download     = `sig_analisis_historial_${new Date().toISOString().split("T")[0]}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<AnalysisTipo, string> = {
  coherencia:    "Coherencia",
  mejoras:       "Mejoras",
  "proc-vs-inst":"Proc/Inst",
}

const TIPO_ICON: Record<AnalysisTipo, React.ReactNode> = {
  coherencia:    <Target className="h-3.5 w-3.5" />,
  mejoras:       <Lightbulb className="h-3.5 w-3.5" />,
  "proc-vs-inst":<GitCompare className="h-3.5 w-3.5" />,
}

const TIPO_CHIP: Record<AnalysisTipo, string> = {
  coherencia:    "bg-blue-50 text-blue-600 border-blue-200",
  mejoras:       "bg-amber-50 text-amber-600 border-amber-200",
  "proc-vs-inst":"bg-violet-50 text-violet-600 border-violet-200",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SigAnalisisSyncView() {
  const [tipoFilter, setTipoFilter] = useState<AnalysisTipo | null>(null)

  const { data: historial = [], isLoading } = useQuery<HistorialItem[]>({
    queryKey: ["sig", "analisis", "historial", tipoFilter],
    queryFn:  () =>
      sigApi.get("/api/analisis/historial", {
        params: { limit: 200, ...(tipoFilter ? { tipo: tipoFilter } : {}) },
      }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const tipoOpts: Array<{ value: AnalysisTipo | null; label: string; icon?: React.ReactNode }> = [
    { value: null,           label: "Todos" },
    { value: "coherencia",   label: "Coherencia",  icon: <Target className="h-3 w-3" /> },
    { value: "mejoras",      label: "Mejoras",     icon: <Lightbulb className="h-3 w-3" /> },
    { value: "proc-vs-inst", label: "Proc/Inst",   icon: <GitCompare className="h-3 w-3" /> },
  ]

  return (
    <div className="flex flex-col h-full bg-zinc-50 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-11 border-b border-zinc-200 bg-white">
        <Database className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="text-[12px] font-mono font-semibold text-zinc-700">Historial de Análisis</span>

        {/* Tipo filters */}
        <div className="flex items-center gap-1 ml-2">
          <Filter className="h-3 w-3 text-zinc-400 shrink-0" />
          {tipoOpts.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setTipoFilter(opt.value)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono border transition-all",
                tipoFilter === opt.value
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700",
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {historial.length > 0 && (
          <button
            onClick={() => downloadAllMarkdown(historial)}
            className="ml-auto flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 font-mono transition-all"
          >
            <Download className="h-3 w-3" />
            Descargar todo ({historial.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-2 text-zinc-400">
            <div className="h-3 w-3 rounded-full border border-zinc-300 border-t-zinc-600 animate-spin" />
            <span className="text-xs font-mono">Cargando historial…</span>
          </div>
        )}

        {!isLoading && historial.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Database className="h-8 w-8 text-zinc-300" />
            <div className="text-center">
              <p className="text-sm font-mono text-zinc-500">Sin análisis guardados</p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Los análisis ejecutados desde la intranet quedan guardados aquí.
              </p>
            </div>
          </div>
        )}

        {!isLoading && historial.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
            {/* Group by procedure */}
            {historial.map((item) => (
              <HistorialRow
                key={`${item.tipo}-${item.id}`}
                item={item}
                onDownload={() => downloadMarkdown(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Historial row ─────────────────────────────────────────────────────────────

function HistorialRow({ item, onDownload }: { item: HistorialItem; onDownload: () => void }) {
  const score = item.puntaje != null ? Math.round(item.puntaje * 100) : null
  const scoreColor =
    score == null  ? "" :
    score >= 80    ? "text-emerald-600" :
    score >= 60    ? "text-amber-600" : "text-red-600"

  const proposals  = (item.proposals  as unknown[] | undefined) ?? []
  const conflictos = (item.conflictos as unknown[] | undefined) ?? []
  const issues     = (item.issues     as unknown[] | undefined) ?? []

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-all group">

      {/* Area bar */}
      <div
        className="h-9 w-0.5 rounded-full shrink-0"
        style={{ backgroundColor: item.procedimiento.area.color }}
      />

      {/* Tipo chip */}
      <div className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono shrink-0",
        TIPO_CHIP[item.tipo],
      )}>
        {TIPO_ICON[item.tipo]}
        <span>{TIPO_LABEL[item.tipo]}</span>
      </div>

      {/* Proc info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono font-medium text-zinc-700">{item.procedimiento.codigo}</span>
          <span className="text-[10px] text-zinc-400 truncate">{item.procedimiento.titulo}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-zinc-400 font-mono">
            {new Date(item.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span className="text-[10px] text-zinc-300">·</span>
          <span className="text-[10px] text-zinc-400">{item.autorNombre}</span>
        </div>
      </div>

      {/* Metric */}
      <div className="shrink-0 text-right min-w-[70px]">
        {item.tipo === "coherencia" && score != null && (
          <span className={cn("text-[13px] font-mono font-bold", scoreColor)}>
            {score}<span className="text-[10px] font-normal text-zinc-400">/100</span>
          </span>
        )}
        {item.tipo === "coherencia" && score == null && (
          <span className="text-[10px] font-mono text-zinc-400">sin puntaje</span>
        )}
        {item.tipo === "mejoras" && (
          <span className="text-[11px] font-mono text-zinc-600">
            <span className="font-bold text-zinc-800">{proposals.length}</span>
            <span className="text-zinc-400"> prop.</span>
          </span>
        )}
        {item.tipo === "proc-vs-inst" && (
          item.coherente ? (
            <span className="flex items-center justify-end gap-1 text-[10px] font-mono text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              Alineado
            </span>
          ) : (
            <span className="flex items-center justify-end gap-1 text-[10px] font-mono text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {conflictos.length} conflict.
            </span>
          )
        )}
        {item.tipo === "coherencia" && (
          <div className="text-[9px] font-mono text-zinc-400 mt-0.5">{issues.length} hallazgos</div>
        )}
      </div>

      {/* Download */}
      <button
        onClick={onDownload}
        className="h-7 w-7 rounded border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:border-zinc-400 transition-all opacity-0 group-hover:opacity-100 shrink-0"
        title="Descargar como Markdown"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
