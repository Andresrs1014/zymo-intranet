// Indicadores del SIG: tipos (espejo de sig-backend/src/routers/indicadores.ts) + lectura de metas y estados.

export interface Resultado {
  periodo: string
  numerador: number | null
  denominador: number | null
  resultado: number
  lectura?: string
  tipoAccion?: "correctiva" | "mejora" | "no_aplica"
  accion?: string
  cierre?: string
  lider?: string
}

export interface Indicador {
  id: number
  nombre: string
  codigo: string | null
  objetivo: string | null
  formula: string | null
  meta: string | null
  frecuencia: string | null
  fuente: string | null
  tipo: string | null
  tendencia: string | null
  plazo: string | null
  procesoResponsable: string | null
  resultados: Resultado[]
  /** Lectura mecánica del backend: lo mismo que lee el agente por el MCP (sig_list_indicators). */
  evaluacion?: Evaluacion
  nombreArchivo: string
  area: { id: number; nombre: string; color: string }
}

export interface Evaluacion {
  periodosMedidos: number
  sinNingunResultado: boolean
  periodosSinResultado: string[]
  periodosPendientesHastaHoy: string[]
  rachaSinCumplir: number
  incumplimientosSinAccion: string[]
  noCoincideConNumeradorDenominador: { periodo: string; resultado: number; recalculado: number }[]
  valoresFueraDeRango: { periodo: string; resultado: number }[]
  definicionIncompleta: string[]
}

export interface Area {
  id: number
  nombre: string
  color: string
}

export type Estado = "cumple" | "cerca" | "incumple" | "sin_meta"

export interface Meta {
  op: ">=" | "<="
  valor: number // razón: 0.95 = 95 %
}

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 })
export const fmtPct = (n: number) => pct.format(n)

export function fmtPeriodo(periodo: string): string {
  const m = periodo.match(/^(\d{4})-(\d{2})$/)
  return m ? `${MESES[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : periodo
}

/** "≥ 85 %", "≤ 2,5%", "0.95", "100% de las contrataciones…" → meta numérica comparable con el resultado (razón 0-1). */
export function parseMeta(meta: string | null, tendencia: string | null): Meta | null {
  if (!meta) return null
  const t = meta.trim()
  const conPct = t.match(/(\d+(?:[.,]\d+)?)\s*%/)
  const raw = conPct?.[1] ?? t.match(/\d+(?:[.,]\d+)?/)?.[0]
  if (!raw) return null
  let valor = Number(raw.replace(",", "."))
  if (!Number.isFinite(valor)) return null
  if (conPct) valor /= 100
  else if (valor > 1) return null // «2 días», «3 reportes»: sin % no se sabe la unidad, no se inventa una meta
  const desc = /^desc/i.test(tendencia ?? "")
  const op = t.includes("≤") ? "<=" : t.includes("≥") ? ">=" : desc ? "<=" : ">="
  return { op, valor }
}

export const fmtMeta = (m: Meta) => `${m.op === ">=" ? "≥" : "≤"} ${fmtPct(m.valor)}`

export function estadoDe(valor: number, meta: Meta | null): Estado {
  if (!meta) return "sin_meta"
  const ok = meta.op === ">=" ? valor >= meta.valor - 1e-9 : valor <= meta.valor + 1e-9
  if (ok) return "cumple"
  const cerca = meta.op === ">=" ? valor >= meta.valor * 0.9 : meta.valor > 0 && valor <= meta.valor * 1.25
  return cerca ? "cerca" : "incumple"
}

export const ESTADO_UI: Record<Estado, { texto: string; celda: string; texto_c: string }> = {
  cumple: { texto: "Cumple la meta", celda: "bg-kpi-ok", texto_c: "text-kpi-ok-ink" },
  cerca: { texto: "Cerca de la meta", celda: "bg-kpi-warn", texto_c: "text-kpi-warn-ink" },
  incumple: { texto: "No cumple la meta", celda: "bg-kpi-bad", texto_c: "text-kpi-bad-ink" },
  sin_meta: { texto: "Sin meta numérica", celda: "bg-kpi-300", texto_c: "text-kpi-600" },
}

/** Cambio frente al periodo anterior en puntos porcentuales, y si eso es mejorar según la tendencia de la meta. */
export function variacion(resultados: Resultado[], meta: Meta | null) {
  if (resultados.length < 2) return null
  const diff = (resultados[resultados.length - 1].resultado - resultados[resultados.length - 2].resultado) * 100
  if (Math.abs(diff) < 0.05) return { diff: 0, mejora: null as boolean | null }
  const sube = diff > 0
  return { diff, mejora: meta ? (meta.op === ">=" ? sube : !sube) : null }
}

export interface Alerta {
  clave: string
  titulo: string
  detalle: string
  /** «bad» = lo que la rúbrica trata como evidencia de problema sostenido; «warn» = dato por completar o confirmar. */
  tono: "bad" | "warn"
}

const CAMPO_FICHA: Record<string, string> = {
  objetivo: "objetivo", formula: "fórmula", meta: "meta", frecuencia: "frecuencia", fuente: "fuente de datos", procesoResponsable: "responsable",
}
const lista = (ps: string[]) => ps.map(fmtPeriodo).join(", ")

/** Lo que el agente revisa de cada indicador (rúbrica §1.6), en palabras para quien mira la pantalla. Son hechos de la hoja, no hallazgos. */
export function alertasDe(ev: Evaluacion | undefined): Alerta[] {
  if (!ev) return []
  const a: Alerta[] = []
  if (ev.sinNingunResultado) a.push({ clave: "sin_resultados", tono: "warn", titulo: "Todavía no tiene resultados medidos", detalle: "La hoja de vida no trae ningún resultado, así que no se puede saber si está al día." })
  if (ev.rachaSinCumplir >= 2) a.push({ clave: "racha", tono: "bad", titulo: `${ev.rachaSinCumplir} periodos seguidos sin cumplir la meta`, detalle: "Un incumplimiento sostenido indica un problema de fondo, no un tropiezo." })
  if (ev.incumplimientosSinAccion.length) a.push({ clave: "sin_accion", tono: "bad", titulo: "No cumple y no hay acción registrada", detalle: lista(ev.incumplimientosSinAccion) })
  if (ev.periodosSinResultado.length) a.push({ clave: "huecos", tono: "warn", titulo: "Faltan resultados entre periodos medidos", detalle: lista(ev.periodosSinResultado) })
  if (ev.periodosPendientesHastaHoy.length) a.push({ clave: "pendientes", tono: "warn", titulo: "Periodos vencidos sin medir", detalle: lista(ev.periodosPendientesHastaHoy) })
  if (ev.noCoincideConNumeradorDenominador.length) a.push({
    clave: "recalculo", tono: "warn", titulo: "El resultado no sale de numerador ÷ denominador",
    detalle: ev.noCoincideConNumeradorDenominador.map((r) => `${fmtPeriodo(r.periodo)}: reporta ${fmtPct(r.resultado)}, da ${fmtPct(r.recalculado)}`).join(" · ") + ". Confirma la fórmula y las columnas de la hoja.",
  })
  if (ev.valoresFueraDeRango.length) a.push({ clave: "rango", tono: "warn", titulo: "Resultado fuera de 0 a 100 %: confirma la unidad", detalle: ev.valoresFueraDeRango.map((r) => `${fmtPeriodo(r.periodo)}: ${fmtPct(r.resultado)}`).join(" · ") })
  if (ev.definicionIncompleta.length) a.push({ clave: "ficha", tono: "warn", titulo: "Faltan datos en la hoja de vida", detalle: ev.definicionIncompleta.map((c) => CAMPO_FICHA[c] ?? c).join(", ") })
  return a
}
