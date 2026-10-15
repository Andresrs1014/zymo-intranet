// Lectura mecánica de una hoja de vida de indicador (FR-010): la meta como número, el estado de cada
// resultado frente a la meta y los hechos que la rúbrica §1.6 manda revisar (periodos que faltan, acciones,
// racha, recálculo). Son HECHOS: quien decide si hay hallazgo es el analista (el agente), nunca este código.
// `frontend/src/lib/sigIndicadores.ts` espeja parseMeta/estadoDe para pintar; si cambian, cambian en los dos.

import type { ResultadoIndicador } from "./indicadorHoja"

export type EstadoIndicador = "cumple" | "cerca" | "incumple" | "sin_meta"
export interface Meta { op: ">=" | "<="; valor: number } // valor en razón: 0.95 = 95 %

/** "≥ 85 %", "≤ 2,5%", "0.95", "100% de las contrataciones…" → meta comparable con el resultado (razón 0-1). */
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

export function estadoDe(valor: number, meta: Meta | null): EstadoIndicador {
  if (!meta) return "sin_meta"
  const ok = meta.op === ">=" ? valor >= meta.valor - 1e-9 : valor <= meta.valor + 1e-9
  if (ok) return "cumple"
  const cerca = meta.op === ">=" ? valor >= meta.valor * 0.9 : meta.valor > 0 && valor <= meta.valor * 1.25
  return cerca ? "cerca" : "incumple"
}

const PASO_MESES: [RegExp, number][] = [[/^mens/i, 1], [/^bimes/i, 2], [/^trimes/i, 3], [/^cuatrimes/i, 4], [/^semes/i, 6], [/^anual/i, 12]]
const mesesDe = (p: string) => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1
const periodoDe = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`

export interface LecturaIndicador {
  meta: { op: string; valor: number } | null
  ultimo: { periodo: string; resultado: number; estado: EstadoIndicador } | null
  variacionPp: number | null
  periodosMedidos: number
  /** La hoja no trae ningún resultado: no se puede decir qué periodos faltan sin saber desde cuándo se mide. */
  sinNingunResultado: boolean
  /** Periodos sin resultado entre el primero y el último medido, según la frecuencia declarada. */
  periodosSinResultado: string[]
  /** Periodos que ya pasaron desde el último medido hasta el mes anterior a `hoy` (solo si hay frecuencia). */
  periodosPendientesHastaHoy: string[]
  /** Cuántos de los últimos resultados seguidos NO cumplen la meta. */
  rachaSinCumplir: number
  /** Periodos que no cumplen y no traen acción ni cierre en la matriz de la hoja (marcar «no aplica» no cuenta como acción). */
  incumplimientosSinAccion: string[]
  /** Resultados que no coinciden con numerador/denominador: confirmar contra la fórmula, puede ser un indicador inverso. */
  noCoincideConNumeradorDenominador: { periodo: string; resultado: number; recalculado: number }[]
  /** Valores imposibles para una razón (negativos o mayores a 100 %). */
  valoresFueraDeRango: { periodo: string; resultado: number }[]
  /** Campos de la ficha que la rúbrica pide y la hoja trae vacíos. */
  definicionIncompleta: string[]
}

interface Ficha {
  objetivo: string | null; formula: string | null; meta: string | null; frecuencia: string | null
  fuente: string | null; tendencia: string | null; procesoResponsable: string | null
  resultados: ResultadoIndicador[]
}

export function evaluarIndicador(k: Ficha, hoy: Date = new Date()): LecturaIndicador {
  const meta = parseMeta(k.meta, k.tendencia)
  const res = [...k.resultados].sort((a, b) => a.periodo.localeCompare(b.periodo))
  const ultimo = res[res.length - 1]
  const prev = res[res.length - 2]
  const paso = PASO_MESES.find(([re]) => re.test(k.frecuencia ?? ""))?.[1] ?? null

  const medidos = new Set(res.map((r) => r.periodo))
  const sinResultado: string[] = []
  const pendientes: string[] = []
  if (paso && ultimo) {
    for (let m = mesesDe(res[0].periodo); m <= mesesDe(ultimo.periodo); m += paso) {
      if (!medidos.has(periodoDe(m))) sinResultado.push(periodoDe(m))
    }
    const mesActual = hoy.getFullYear() * 12 + hoy.getMonth()
    for (let m = mesesDe(ultimo.periodo) + paso; m < mesActual; m += paso) pendientes.push(periodoDe(m))
  }

  let racha = 0
  for (let i = res.length - 1; i >= 0 && estadoDe(res[i].resultado, meta) !== "cumple" && meta; i--) racha++

  return {
    meta,
    ultimo: ultimo ? { periodo: ultimo.periodo, resultado: ultimo.resultado, estado: estadoDe(ultimo.resultado, meta) } : null,
    variacionPp: ultimo && prev ? Math.round((ultimo.resultado - prev.resultado) * 1000) / 10 : null,
    periodosMedidos: res.length,
    sinNingunResultado: res.length === 0,
    periodosSinResultado: sinResultado,
    periodosPendientesHastaHoy: pendientes,
    rachaSinCumplir: racha,
    incumplimientosSinAccion: meta
      ? res.filter((r) => estadoDe(r.resultado, meta) !== "cumple" && !r.accion && !r.cierre).map((r) => r.periodo)
      : [],
    noCoincideConNumeradorDenominador: res.flatMap((r) => {
      if (r.numerador == null || !r.denominador) return []
      const recalculado = r.numerador / r.denominador
      return Math.abs(recalculado - r.resultado) > 0.0005
        ? [{ periodo: r.periodo, resultado: r.resultado, recalculado: Math.round(recalculado * 10000) / 10000 }]
        : []
    }),
    valoresFueraDeRango: res.filter((r) => r.resultado < 0 || r.resultado > 1.0001).map((r) => ({ periodo: r.periodo, resultado: r.resultado })),
    definicionIncompleta: (["objetivo", "formula", "meta", "frecuencia", "fuente", "procesoResponsable"] as const).filter((c) => !k[c]),
  }
}
