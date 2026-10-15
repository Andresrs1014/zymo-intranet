import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ESTADO_UI, MESES, alertasDe, estadoDe, fmtMeta, fmtPct, fmtPeriodo, parseMeta, variacion,
  type Indicador, type Meta, type Resultado,
} from "@/lib/sigIndicadores"
import { SigIndicadorDetalle } from "./SigIndicadorDetalle"

/** La «huella» del indicador: una celda por mes del año; su altura es el valor y su color, el estado frente a la meta. */
function Huella({ k, meta }: { k: Indicador; meta: Meta | null }) {
  const anio = k.resultados[k.resultados.length - 1]?.periodo.slice(0, 4)
  const porMes = new Map<number, Resultado>(k.resultados.map((r) => [Number(r.periodo.slice(5)), r]))
  const techo = Math.max((meta?.valor ?? 0) * 1.25, ...k.resultados.map((r) => r.resultado), 0.01)
  return (
    <ul className="flex h-10 items-end gap-[3px]" aria-hidden title={`Resultado de cada mes de ${anio ?? "el año"}`}>
      {MESES.map((mes, i) => {
        const r = porMes.get(i + 1)
        const estado = r ? estadoDe(r.resultado, meta) : null
        const alto = r ? Math.max(10, Math.min(100, (r.resultado / techo) * 100)) : 100
        return (
          <li key={mes} className="group/c relative flex h-full w-[11px] items-end">
            <span
              role="img"
              aria-label={r ? `${mes}: ${fmtPct(r.resultado)}, ${ESTADO_UI[estado!].texto}` : `${mes}: sin medición`}
              style={{ height: `${alto}%`, animationDelay: `${i * 35}ms` }}
              className={cn(
                "block w-full origin-bottom rounded-[3px] [animation:kpi-celda_.45s_cubic-bezier(.2,.8,.2,1)_both]",
                r ? ESTADO_UI[estado!].celda : "border border-dashed border-kpi-300/70 bg-transparent",
              )}
            />
            {r && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg bg-kpi-900 px-2.5 py-1.5 text-xs leading-snug text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/c:opacity-100"
              >
                <span className="block font-mono text-[10px] text-kpi-100">{fmtPeriodo(r.periodo)}</span>
                <span className="block font-medium tabular-nums">{fmtPct(r.resultado)}</span>
                <span className="block text-kpi-100">{ESTADO_UI[estado!].texto}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Variacion({ k, meta }: { k: Indicador; meta: Meta | null }) {
  const v = variacion(k.resultados, meta)
  if (!v) return null
  const Icono = v.diff === 0 ? Minus : v.diff > 0 ? ArrowUpRight : ArrowDownRight
  const color = v.mejora === null ? "text-kpi-600" : v.mejora ? "text-kpi-ok-ink" : "text-kpi-bad-ink"
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums", color)} title="Frente al periodo anterior">
      <Icono className="h-3 w-3" aria-hidden />
      {v.diff === 0 ? "igual" : `${Math.abs(v.diff).toFixed(1).replace(".", ",")} pp`}
      {v.mejora !== null && v.diff !== 0 && <span className="sr-only">{v.mejora ? ", mejora" : ", empeora"}</span>}
    </span>
  )
}

const ESTADO_CORTO = { cumple: "Cumple", cerca: "Cerca", incumple: "No cumple", sin_meta: "Sin meta" } as const

export function SigIndicadorFila({ k, abierta, ambiguo, canEdit, onToggle, onBorrar, onDescargar }: {
  k: Indicador
  /** Hay otro indicador con el mismo nombre en esta lista (p. ej. otra empresa): se muestra el archivo para distinguirlos. */
  ambiguo: boolean
  abierta: boolean
  canEdit: boolean
  onToggle: () => void
  onBorrar: () => void
  onDescargar: () => void
}) {
  const meta = parseMeta(k.meta, k.tendencia)
  const ultimo = k.resultados[k.resultados.length - 1]
  const estado = ultimo ? estadoDe(ultimo.resultado, meta) : null
  const sub = [k.codigo, k.frecuencia, k.procesoResponsable].filter(Boolean).join(" · ")
  const alertas = alertasDe(k.evaluacion)
  const graves = alertas.filter((a) => a.tono === "bad").length
  return (
    <article className={cn(
      "overflow-hidden rounded-2xl border bg-white transition-shadow",
      abierta ? "border-kpi-300 shadow-[0_10px_30px_-12px_rgba(29,45,68,.22)]" : "border-kpi-300/70 hover:border-kpi-300",
    )}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kpi-600 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_9.5rem_1.25rem]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("mt-1 h-9 w-1 shrink-0 rounded-full", estado ? ESTADO_UI[estado].celda : "bg-kpi-100")} aria-hidden />
          <div className="min-w-0">
            <span className="block text-[14px] font-medium leading-snug text-kpi-900">{k.nombre}</span>
            <p className="mt-0.5 break-words font-mono text-[11px] text-kpi-600 sm:truncate" title={k.nombreArchivo}>{[sub, ambiguo ? k.nombreArchivo : ""].filter(Boolean).join(" · ") || k.nombreArchivo}</p>
            {alertas.length > 0 && (
              <p className={cn("mt-1.5 inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium", graves ? "text-kpi-bad-ink" : "text-kpi-warn-ink")}>
                <TriangleAlert className="h-3 w-3" aria-hidden />
                {alertas.length === 1 ? "1 punto por revisar" : `${alertas.length} puntos por revisar`}
              </p>
            )}
          </div>
        </div>

        <div className="hidden lg:block"><Huella k={k} meta={meta} /></div>

        <div className="text-right">
          {ultimo ? (
            <>
              <p className={cn("font-mono text-xl font-medium leading-none tabular-nums", ESTADO_UI[estado!].texto_c)}>{fmtPct(ultimo.resultado)}</p>
              <p className={cn("mt-1 text-[11px] font-medium", ESTADO_UI[estado!].texto_c)}>{ESTADO_CORTO[estado!]}</p>
              <p className="mt-0.5 flex items-center justify-end gap-2 font-mono text-[10px] text-kpi-600">
                <span>{fmtPeriodo(ultimo.periodo)}</span>
                {meta && <span>meta {fmtMeta(meta)}</span>}
              </p>
              <div className="mt-0.5 flex justify-end"><Variacion k={k} meta={meta} /></div>
            </>
          ) : (
            <>
              <p className="font-mono text-sm text-kpi-600">Sin medir</p>
              {meta && <p className="mt-1 font-mono text-[10px] text-kpi-600">meta {fmtMeta(meta)}</p>}
            </>
          )}
        </div>

        <ChevronDown className={cn("hidden h-4 w-4 text-kpi-600 transition-transform duration-300 lg:block", abierta && "rotate-180 text-kpi-600")} aria-hidden />
        <div className="col-span-2 lg:hidden"><Huella k={k} meta={meta} /></div>
      </button>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", abierta ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          {abierta && <SigIndicadorDetalle k={k} meta={meta} canEdit={canEdit} onBorrar={onBorrar} onDescargar={onDescargar} />}
        </div>
      </div>
    </article>
  )
}
