import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"

export interface FilaPrevia {
  key: string
  /** Etiqueta corta de color (prioridad, estado…). */
  chip?: { texto: string; clase: string }
  texto: string
  /** Datos con etiqueta (solo en modo amplio): Solicitante, Área, Unidades, Hace… */
  datos?: Array<[etiqueta: string, valor: string | null | undefined]>
  /** Dato secundario a la derecha (quién la hizo, valor…). */
  aparte?: string
  aparteTitulo?: string
  /** Si viene, la fila abre ese elemento. */
  to?: string
}

export const CHIP_PRIORIDAD: Record<string, string> = {
  critica: "bg-red-600 text-white",
  urgente: "bg-red-600 text-white",
  alta: "bg-red-50 text-red-700",
  media: "bg-amber-50 text-amber-700",
  baja: "bg-zinc-100 text-zinc-600",
}

/** "hoy", "hace 3 d", "hace 2 sem": para ver de un vistazo qué lleva esperando más. */
export function hace(iso?: string | null): string | undefined {
  if (!iso) return undefined
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (Number.isNaN(d)) return undefined
  if (d <= 0) return "hoy"
  if (d < 14) return `hace ${d} d`
  return `hace ${Math.floor(d / 7)} sem`
}

/**
 * Cuadro informativo. Normal: cuántas hay y 4 filas. Amplio (quien tiene pocos módulos): 8 filas de dos líneas
 * con quién la pidió y hace cuánto, y cada fila abre el elemento.
 */
export function CuadroVistaPrevia({
  titulo, icon, total, filas, cargando, error, vacio = "Nada pendiente.", amplio = false, verTodo,
}: {
  titulo: string
  icon: ReactNode
  total?: number
  filas: FilaPrevia[]
  cargando?: boolean
  error?: boolean
  vacio?: string
  amplio?: boolean
  verTodo?: string
}) {
  const visibles = filas.slice(0, amplio ? 8 : 4)
  const restan = total != null ? total - visibles.length : 0
  return (
    <div className={`rounded-xl border border-border bg-white shadow-sm ${amplio ? "p-5" : "p-4"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ${amplio ? "size-10" : "size-8"}`}>{icon}</span>
        <h4 className={`min-w-0 flex-1 font-semibold text-foreground ${amplio ? "text-base" : "text-sm"}`}>{titulo}</h4>
        <span className={`font-mono font-semibold tabular-nums text-foreground ${amplio ? "text-2xl" : "text-lg"}`} aria-label={`${total ?? 0} en total`}>
          {total ?? "–"}
        </span>
      </div>
      <ul className={amplio ? "mt-4 divide-y divide-border" : "mt-3 space-y-1.5"} aria-live="polite">
        {cargando && <li className="text-xs text-muted-foreground">Cargando…</li>}
        {error && <li className="text-xs text-muted-foreground">No se pudo cargar esta lista.</li>}
        {!cargando && !error && visibles.length === 0 && <li className="text-xs text-muted-foreground">{vacio}</li>}
        {visibles.map((f) => {
          const cuerpo = (
            <>
              {f.chip && <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${f.chip.clase}`}>{f.chip.texto}</span>}
              <span className="min-w-0 flex-1">
                <span className={`block text-foreground ${amplio ? "line-clamp-2 text-sm font-semibold" : "truncate text-xs"}`} title={f.texto}>{f.texto}</span>
                {amplio && f.datos && (
                  <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
                    {f.datos.filter(([, v]) => v).map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="min-w-0">
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
                        <dd className="max-w-[14rem] truncate text-xs font-semibold text-foreground" title={valor ?? undefined}>{valor}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </span>
              {f.aparte && <span className={`shrink-0 truncate text-muted-foreground ${amplio ? "max-w-[9rem] font-mono text-xs text-foreground" : "max-w-[7rem] text-xs"}`} title={f.aparteTitulo ?? f.aparte}>{f.aparte}</span>}
            </>
          )
          const clase = `flex items-center gap-2 ${amplio ? "py-3" : ""}`
          return (
            <li key={f.key}>
              {f.to ? (
                <Link to={f.to} className={`${clase} -mx-2 rounded-md px-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40`}>{cuerpo}</Link>
              ) : (
                <div className={clase}>{cuerpo}</div>
              )}
            </li>
          )
        })}
      </ul>
      {!cargando && !error && (restan > 0 || (amplio && verTodo)) && (
        <p className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{restan > 0 ? `y ${restan} más` : ""}</span>
          {amplio && verTodo && (
            <Link to={verTodo} className="inline-flex items-center gap-1 font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
              Ver todo <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
