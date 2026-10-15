import { Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CircleCheck, Download, Trash2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ESTADO_UI, MESES, alertasDe, estadoDe, fmtMeta, fmtPct, fmtPeriodo,
  type Indicador, type Meta, type Resultado,
} from "@/lib/sigIndicadores"

const COLOR_BARRA = { cumple: "#3f8f63", cerca: "#b9801f", incumple: "#b4443c", sin_meta: "#8aa9c4" } as const

const TIPO_ACCION = {
  correctiva: { texto: "Acción correctiva", clase: "border-kpi-bad/40 bg-kpi-bad/5 text-kpi-bad" },
  mejora: { texto: "Acción de mejora", clase: "border-kpi-warn/40 bg-kpi-warn/5 text-kpi-warn" },
  no_aplica: { texto: "Sin acción", clase: "border-kpi-300/70 bg-kpi-50 text-kpi-600" },
} as const

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[13px] font-medium text-kpi-900">{children}</h3>
)

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-kpi-600">{children}</p>
)

function TooltipMes({ active, payload, meta }: { active?: boolean; payload?: { payload: Resultado }[]; meta: Meta | null }) {
  const r = active ? payload?.[0]?.payload : null
  if (!r) return null
  return (
    <div className="rounded-lg bg-kpi-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-xl">
      <p className="font-mono text-[10px] text-kpi-100">{fmtPeriodo(r.periodo)}</p>
      <p className="font-medium tabular-nums">{fmtPct(r.resultado)}</p>
      {r.numerador != null && r.denominador != null && (
        <p className="font-mono text-[10px] text-kpi-100">{r.numerador} de {r.denominador}</p>
      )}
      {meta && <p className="text-kpi-100">{ESTADO_UI[estadoDe(r.resultado, meta)].texto}</p>}
    </div>
  )
}

function Grafica({ k, meta }: { k: Indicador; meta: Meta | null }) {
  const datos = k.resultados.map((r) => ({ ...r, mes: MESES[Number(r.periodo.slice(5)) - 1] ?? r.periodo }))
  const tope = Math.max(meta?.valor ?? 0, ...k.resultados.map((r) => r.resultado), 0.01) * 1.15
  return (
    <div className="h-52" role="img" aria-label={`Resultado mensual de ${k.nombre}${meta ? `, meta ${fmtMeta(meta)}` : ""}. El detalle de cada mes está en la lista de abajo.`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 14, right: 12, bottom: 0, left: -8 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#d3e2ed" strokeDasharray="2 4" />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#3e5c76", fontFamily: "Cascadia Code Variable" }} />
          <YAxis
            domain={[0, tope]} tickLine={false} axisLine={false} width={44}
            tickFormatter={(v: number) => fmtPct(v)} tick={{ fontSize: 10, fill: "#3e5c76", fontFamily: "Cascadia Code Variable" }}
          />
          <Tooltip cursor={{ fill: "#eef4f9" }} content={<TooltipMes meta={meta} />} />
          {meta && (
            <ReferenceLine
              y={meta.valor} stroke="#1d2d44" strokeDasharray="5 4" ifOverflow="extendDomain"
              label={{ value: `meta ${fmtMeta(meta)}`, position: "insideTopRight", fontSize: 10, fill: "#1d2d44", fontFamily: "Cascadia Code Variable" }}
            />
          )}
          <Bar dataKey="resultado" radius={[5, 5, 0, 0]} minPointSize={3} isAnimationActive={!window.matchMedia("(prefers-reduced-motion: reduce)").matches} animationDuration={700}>
            {datos.map((d) => <Cell key={d.periodo} fill={COLOR_BARRA[estadoDe(d.resultado, meta)]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Ficha({ k }: { k: Indicador }) {
  const campos = [
    ["Objetivo", k.objetivo],
    ["Fórmula", k.formula],
    ["Fuente", k.fuente],
    ["Responsable", k.procesoResponsable],
    ["Plazo", k.plazo],
  ].filter((c): c is [string, string] => Boolean(c[1]))
  return (
    <dl className="grid content-start gap-3.5">
      {campos.map(([label, value]) => (
        <div key={label}>
          <dt><Etiqueta>{label}</Etiqueta></dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-kpi-900">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Lo mismo que lee el agente analista de este indicador (rúbrica §1.6): hechos de la hoja, no veredictos. */
function RevisionDelAgente({ k }: { k: Indicador }) {
  const alertas = alertasDe(k.evaluacion)
  return (
    <section aria-labelledby={`rev-${k.id}`} className="rounded-xl border border-kpi-300/70 bg-kpi-50/60 p-4">
      <h3 id={`rev-${k.id}`} className="text-[13px] font-medium text-kpi-900">Lo que revisa el agente en este indicador</h3>
      {alertas.length === 0 ? (
        <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-kpi-900">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-kpi-ok" aria-hidden />
          La hoja está completa y al día: sin periodos vencidos, sin huecos y con acción registrada donde no cumple.
        </p>
      ) : (
        <ul className="mt-2.5 grid gap-2.5">
          {alertas.map((a) => (
            <li key={a.clave} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
              <TriangleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", a.tono === "bad" ? "text-kpi-bad-ink" : "text-kpi-warn-ink")} aria-hidden />
              <p className="min-w-0 text-kpi-900"><span className="font-medium">{a.titulo}.</span> <span className="text-kpi-600">{a.detalle}</span></p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-kpi-600">
        Son datos autorreportados por el líder del proceso. El agente los usa como evidencia y decide si son hallazgos; no recalcula si la hoja no trae numerador y denominador.
      </p>
    </section>
  )
}

function MesAMes({ k, meta }: { k: Indicador; meta: Meta | null }) {
  const filas = [...k.resultados].reverse()
  return (
    <ol className="grid gap-2.5">
      {filas.map((r) => {
        const estado = estadoDe(r.resultado, meta)
        const tipo = r.tipoAccion ? TIPO_ACCION[r.tipoAccion] : null
        return (
          <li key={r.periodo} className="grid grid-cols-[4.5rem_1fr] gap-x-4 rounded-xl border border-kpi-300/70 bg-white p-3.5 sm:grid-cols-[5.5rem_1fr]">
            <div>
              <p className="font-mono text-[11px] uppercase text-kpi-600">{fmtPeriodo(r.periodo)}</p>
              <p className={`mt-0.5 font-mono text-lg font-medium tabular-nums ${ESTADO_UI[estado].texto_c}`}>{fmtPct(r.resultado)}</p>
              {r.numerador != null && r.denominador != null && (
                <p className="font-mono text-[10px] text-kpi-600">{r.numerador} / {r.denominador}</p>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              {r.lectura ? <p className="text-[13px] leading-relaxed text-kpi-900">{r.lectura}</p>
                : <p className="text-[12px] italic text-kpi-600">Sin lectura del resultado en la hoja de vida.</p>}
              {(tipo || r.accion) && (
                <div className="rounded-lg bg-kpi-50 p-3 text-[13px] leading-relaxed text-kpi-900">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {tipo && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tipo.clase}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{tipo.texto}
                      </span>
                    )}
                    {r.cierre && <span className="font-mono text-[11px] text-kpi-600">cierre · {r.cierre}</span>}
                    {r.lider && <span className="font-mono text-[11px] text-kpi-600">{r.lider}</span>}
                  </div>
                  {r.accion && <p className="mt-1.5">{r.accion}</p>}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function SigIndicadorDetalle({ k, meta, canEdit, onBorrar, onDescargar }: {
  k: Indicador
  meta: Meta | null
  canEdit: boolean
  onBorrar: () => void
  onDescargar: () => void
}) {
  const hayResultados = k.resultados.length > 0
  return (
    <div className="grid gap-6 px-4 pb-5 pt-1 sm:px-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Titulo>Resultado por mes{meta ? ` · meta ${fmtMeta(meta)}` : ""}</Titulo>
          {hayResultados ? <div className="mt-2"><Grafica k={k} meta={meta} /></div>
            : <p className="mt-3 text-[13px] text-kpi-600">Todavía no hay resultados medidos en la hoja de vida.</p>}
        </div>
        <Ficha k={k} />
      </div>

      <RevisionDelAgente k={k} />

      {hayResultados && (
        <div>
          <Titulo>Mes a mes: lectura y acciones</Titulo>
          <div className="mt-2"><MesAMes k={k} meta={meta} /></div>
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-kpi-300/70 pt-3">
        <button type="button" onClick={onDescargar} className="inline-flex min-h-9 items-center gap-1.5 rounded px-1 font-mono text-[11px] text-kpi-600 outline-none transition-colors hover:text-kpi-900 focus-visible:ring-2 focus-visible:ring-kpi-600">
          <Download className="h-3 w-3" aria-hidden /> Descargar Excel
        </button>
        {canEdit && (
          <button type="button" onClick={onBorrar} className="inline-flex min-h-9 items-center gap-1.5 rounded px-1 font-mono text-[11px] text-kpi-bad-ink outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-kpi-bad">
            <Trash2 className="h-3 w-3" aria-hidden /> Quitar indicador
          </button>
        )}
      </div>
    </div>
  )
}
