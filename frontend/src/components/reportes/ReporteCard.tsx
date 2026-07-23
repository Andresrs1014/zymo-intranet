// Card de un reporte en la lista del hub. Es clickeable y navega al detalle.
// Muestra: tag de proyecto, % de avance (barra circular), título, descripción,
// autor, fecha, tiempos estimados y nombre del archivo adjunto si lo hay.

import { useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import { Calendar, FileText, User, Clock, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar"
import { BlurFade } from "@/components/ui/blur-fade"
import { ShineBorder } from "@/components/ui/shine-border"
import {
  colorForProyecto,
  formatFechaCorta,
  formatHoras,
  type Reporte,
} from "@/lib/reportesShared"

interface Props {
  reporte: Reporte
  /** Posición en la lista — se usa como delay de la animación de entrada. */
  index?: number
}

export function ReporteCard({ reporte, index = 0 }: Props) {
  const navigate = useNavigate()
  const color = colorForProyecto(reporte.proyecto)
  const isComplete = reporte.porcentajeAvance >= 100

  // Handler único: navega al detalle. Se llama desde click y desde teclado.
  const abrir = () => navigate(`/reportes-desarrollo/${reporte.id}`)

  return (
    <BlurFade delay={0.04 * index} duration={0.5} inView>
      <motion.div
        // `whileHover` con y negativo da un efecto de "lift" sutil al pasar el mouse.
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        // role + tabIndex + onKeyDown hacen que la card sea accesible por teclado
        // (Enter y Space navegan), como si fuera un <button>.
        role="button"
        tabIndex={0}
        onClick={abrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            abrir()
          }
        }}
        aria-label={`Abrir reporte: ${reporte.titulo}`}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-xl",
          "border border-zinc-200 bg-white outline-none",
          "transition-shadow hover:shadow-lg hover:shadow-zinc-200/60",
          // Focus visible: aro discreto cuando se navega con teclado.
          "focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2",
        )}
      >
        {/* Borde animado solo cuando el reporte está al 100% — celebración sutil. */}
        {isComplete && (
          <ShineBorder
            shineColor={[color, "#ffffff", color]}
            duration={8}
            className="absolute inset-0 rounded-xl"
          />
        )}

        <div className="flex items-stretch">
          {/* ── Columna izquierda: % avance con barra circular ───────────── */}
          <div
            className="flex shrink-0 flex-col items-center justify-center gap-2 px-5 py-5 border-r border-zinc-100"
            style={{ backgroundColor: `${color}0a` }}
          >
            <AnimatedCircularProgressBar
              value={reporte.porcentajeAvance}
              gaugePrimaryColor={color}
              gaugeSecondaryColor="#e4e4e7"
              className="!size-16 !text-base"
            />
            <span
              className="font-mono text-[10px] uppercase tracking-wider tabular-nums"
              style={{ color }}
            >
              Avance
            </span>
          </div>

          {/* ── Columna derecha: contenido ───────────────────────────────── */}
          <div className="flex-1 min-w-0 px-5 py-4">
            {/* Tag de proyecto */}
            <div className="flex items-center gap-1.5 mb-2">
              <Tag className="w-3 h-3" style={{ color }} strokeWidth={2.5} aria-hidden="true" />
              <span
                className="font-mono text-[10px] uppercase tracking-wider font-semibold"
                style={{ color }}
              >
                {reporte.proyecto}
              </span>
            </div>

            {/* Título */}
            <h3 className="font-mono text-[14px] font-semibold text-zinc-800 leading-tight line-clamp-2 text-balance mb-2">
              {reporte.titulo}
            </h3>

            {/* Descripción */}
            {reporte.descripcion && (
              <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2 mb-3">
                {reporte.descripcion}
              </p>
            )}

            {/* Metadata footer */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 mt-auto pt-2 border-t border-zinc-100">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                {formatFechaCorta(reporte.fechaReporte)}
              </span>
              <span className="inline-flex items-center gap-1 min-w-0">
                <User className="w-3 h-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                <span className="truncate max-w-[140px]">{reporte.autorNombre}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="w-3 h-3" strokeWidth={2.2} aria-hidden="true" />
                {formatHoras(reporte.tiempoEstimadoHoras)}
                {reporte.tiempoRealHoras != null && (
                  <span className="text-zinc-400"> / {formatHoras(reporte.tiempoRealHoras)} real</span>
                )}
              </span>
              {reporte.nombreArchivo && (
                <span className="inline-flex items-center gap-1 text-zinc-400 ml-auto min-w-0">
                  <FileText className="w-3 h-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                  <span className="font-mono truncate max-w-[120px]">
                    {reporte.nombreArchivo}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </BlurFade>
  )
}
