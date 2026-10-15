import type { ReactNode } from "react"

export interface FilaPrevia {
  key: string
  /** Etiqueta corta de color (prioridad, estado…). */
  chip?: { texto: string; clase: string }
  texto: string
  /** Dato secundario a la derecha (quién la hizo, valor…). */
  aparte?: string
  aparteTitulo?: string
}

export const CHIP_PRIORIDAD: Record<string, string> = {
  critica: "bg-red-600 text-white",
  urgente: "bg-red-600 text-white",
  alta: "bg-red-50 text-red-700",
  media: "bg-amber-50 text-amber-700",
  baja: "bg-zinc-100 text-zinc-600",
}

/** Rectángulo pequeño, solo informativo: cuántas hay y las primeras filas. */
export function CuadroVistaPrevia({
  titulo, icon, total, filas, cargando, error, vacio = "Nada pendiente.",
}: {
  titulo: string
  icon: ReactNode
  total?: number
  filas: FilaPrevia[]
  cargando?: boolean
  error?: boolean
  vacio?: string
}) {
  const visibles = filas.slice(0, 4)
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <h4 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{titulo}</h4>
        <span className="font-mono text-lg font-semibold tabular-nums text-foreground" aria-label={`${total ?? 0} en total`}>
          {total ?? "–"}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5" aria-live="polite">
        {cargando && <li className="text-xs text-muted-foreground">Cargando…</li>}
        {error && <li className="text-xs text-muted-foreground">No se pudo cargar esta lista.</li>}
        {!cargando && !error && visibles.length === 0 && <li className="text-xs text-muted-foreground">{vacio}</li>}
        {visibles.map((f) => (
          <li key={f.key} className="flex items-center gap-2 text-xs">
            {f.chip && <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${f.chip.clase}`}>{f.chip.texto}</span>}
            <span className="min-w-0 flex-1 truncate text-foreground" title={f.texto}>{f.texto}</span>
            {f.aparte && <span className="max-w-[7rem] shrink-0 truncate text-muted-foreground" title={f.aparteTitulo ?? f.aparte}>{f.aparte}</span>}
          </li>
        ))}
      </ul>
      {total != null && total > visibles.length && !cargando && (
        <p className="mt-2 text-[11px] text-muted-foreground">y {total - visibles.length} más</p>
      )}
    </div>
  )
}
