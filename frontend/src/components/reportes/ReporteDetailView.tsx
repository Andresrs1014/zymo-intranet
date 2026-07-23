// Vista de lectura de un reporte — el equivalente digital de abrir un .md en
// Typora. Layout: documento principal a la izquierda + sidebar de acciones
// (barra de % avance, descargar, editar, eliminar) a la derecha.

import { motion } from "motion/react"
import { ReporteMarkdown } from "./ReporteMarkdown"
import { Calendar, User, Clock, Tag, Download, Pencil, Trash2 } from "lucide-react"
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar"
import { BlurFade } from "@/components/ui/blur-fade"
import { api } from "@/lib/api"
import {
  colorForProyecto,
  formatFechaLarga,
  formatHoras,
  type Reporte,
} from "@/lib/reportesShared"

interface Props {
  reporte: Reporte
  /** Puede editar (autor o admin/gerente con permiso). */
  canEdit: boolean
  /** Puede eliminar (mismas reglas que editar). */
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export function ReporteDetailView({
  reporte,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: Props) {
  const color = colorForProyecto(reporte.proyecto)
  const isComplete = reporte.porcentajeAvance >= 100

  // ── Descarga del archivo original (.md) ─────────────────────────────────
  // Va por `/sig-api/...` porque nginx proxy-pasa ese prefijo al sig-backend
  // (puerto 3003). El backend ya valida el JWT.
  const downloadOriginal = async () => {
    try {
      const { data } = await api.get(
        `/sig-api/api/reportes-desarrollo/${reporte.id}/archivo`,
        { responseType: "blob" },
      )
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = reporte.nombreArchivo ?? `reporte-${reporte.id}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert("No se pudo descargar el archivo original")
    }
  }

  return (
    <BlurFade duration={0.5} inView>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* ── Columna principal: documento ──────────────────────────────── */}
        <motion.article
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"
        >
          {/* Header del documento */}
          <header className="px-8 pt-8 pb-5 border-b border-zinc-100 bg-zinc-50/40">
            {/* Tag de proyecto */}
            <div className="flex items-center gap-1.5 mb-3">
              <Tag
                className="w-3.5 h-3.5"
                style={{ color }}
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span
                className="font-mono text-[10px] uppercase tracking-wider font-bold"
                style={{ color }}
              >
                {reporte.proyecto}
              </span>
            </div>

            {/* Título */}
            <h1 className="font-mono text-[22px] font-semibold text-zinc-800 leading-tight text-balance mb-3">
              {reporte.titulo}
            </h1>

            {/* Descripción */}
            {reporte.descripcion && (
              <p className="text-[13px] text-zinc-600 leading-relaxed mb-2 text-pretty">
                {reporte.descripcion}
              </p>
            )}

            {/* Metadata inline */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 font-mono mt-3 pt-3 border-t border-zinc-200/60">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                {formatFechaLarga(reporte.fechaReporte)}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                {reporte.autorNombre}
              </span>
              {reporte.tiempoEstimadoHoras != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                  Est. {formatHoras(reporte.tiempoEstimadoHoras)}
                </span>
              )}
              {reporte.tiempoRealHoras != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                  Real {formatHoras(reporte.tiempoRealHoras)}
                </span>
              )}
            </div>
          </header>

          {/* Cuerpo markdown renderizado con tipografía Typora. */}
          <div className="px-8 py-8 lg:px-12 lg:py-10">
            <div className={DETAIL_PROSE}>
              <ReporteMarkdown>{reporte.contenidoMd}</ReporteMarkdown>
            </div>
          </div>
        </motion.article>

        {/* ── Sidebar de acciones ───────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* % avance con barra circular */}
          <div
            className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col items-center text-center"
            style={{ backgroundColor: `${color}0a` }}
          >
            <AnimatedCircularProgressBar
              value={reporte.porcentajeAvance}
              gaugePrimaryColor={color}
              gaugeSecondaryColor="#e4e4e7"
              className="!size-28 !text-2xl"
            />
            <p
              className="font-mono text-[10px] uppercase tracking-wider mt-3 font-semibold"
              style={{ color }}
            >
              {isComplete ? "✓ Completado" : "En progreso"}
            </p>
          </div>

          {/* Acciones */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            {reporte.nombreArchivo && (
              <ActionButton onClick={downloadOriginal} icon={Download}>
                Descargar .md
              </ActionButton>
            )}
            {canEdit && (
              <ActionButton onClick={onEdit} icon={Pencil}>
                Editar
              </ActionButton>
            )}
            {canDelete && (
              <ActionButton
                onClick={onDelete}
                icon={Trash2}
                tone="danger"
              >
                Eliminar
              </ActionButton>
            )}
          </div>
        </aside>
      </div>
    </BlurFade>
  )
}

// ── Estilos del `prose` para el documento (más grande que el del editor) ──────

const DETAIL_PROSE = `prose prose-base max-w-none
  prose-headings:font-mono prose-headings:text-zinc-800 prose-headings:font-semibold
  prose-headings:text-balance
  prose-h1:text-[20px] prose-h1:mt-8 prose-h1:mb-4
  prose-h1:border-b prose-h1:border-zinc-200 prose-h1:pb-2
  prose-h2:text-[16px] prose-h2:mt-7 prose-h2:mb-3
  prose-h3:text-[14px] prose-h3:mt-5 prose-h3:mb-2
  prose-p:text-zinc-700 prose-p:text-[13.5px] prose-p:leading-[1.75] prose-p:my-3
  prose-strong:text-zinc-900 prose-strong:font-semibold
  prose-li:text-zinc-700 prose-li:text-[13.5px] prose-li:leading-[1.7] prose-li:my-1
  prose-ul:my-3 prose-ol:my-3
  prose-code:text-zinc-800 prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5
  prose-code:rounded prose-code:text-[12px] prose-code:font-mono
  prose-code:before:content-none prose-code:after:content-none
  prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200
  prose-pre:text-zinc-800 prose-pre:my-4
  prose-blockquote:border-l-zinc-300 prose-blockquote:text-zinc-600 prose-blockquote:not-italic
  prose-table:text-[13px]
  prose-th:text-zinc-700 prose-th:font-mono prose-th:font-semibold prose-th:text-[12px]
  prose-th:border prose-th:border-zinc-200 prose-th:px-3 prose-th:py-2 prose-th:bg-zinc-50
  prose-td:text-zinc-700 prose-td:text-[13px]
  prose-td:border prose-td:border-zinc-200 prose-td:px-3 prose-td:py-2
  prose-hr:border-zinc-200 prose-hr:my-6
  prose-a:text-zinc-800 prose-a:underline-offset-2`

// ── Subcomponentes ────────────────────────────────────────────────────────────

/** Botón de acción de la sidebar (Descargar, Editar, Eliminar). */
function ActionButton({
  onClick,
  icon: Icon,
  tone = "default",
  children,
}: {
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  tone?: "default" | "danger"
  children: React.ReactNode
}) {
  const isDanger = tone === "danger"
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isDanger
          ? "w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-red-200 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          : "w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-zinc-200 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
      }
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}
