// Self-check de la lectura de indicadores: meta, estado, periodos que faltan, racha, recálculo y acciones.
import assert from "node:assert/strict"
import { estadoDe, evaluarIndicador, parseMeta } from "../src/services/indicadorLectura"

assert.deepEqual(parseMeta("≥ 95%", "Ascendente"), { op: ">=", valor: 0.95 })
assert.deepEqual(parseMeta("≤ 2,5%", "Descendente"), { op: "<=", valor: 0.025 })
assert.deepEqual(parseMeta("0", "Descendente"), { op: "<=", valor: 0 })
assert.deepEqual(parseMeta("100% de las contrataciones realizadas…", "Ascendente"), { op: ">=", valor: 1 })
assert.deepEqual(parseMeta("Lograr un 90% de efectividad", "Ascendente"), { op: ">=", valor: 0.9 })
assert.equal(parseMeta("sin dato", null), null)
assert.equal(parseMeta("3 reportes", null), null) // sin % y mayor que 1: no se inventa la unidad
assert.equal(estadoDe(0.96, { op: ">=", valor: 0.95 }), "cumple")
assert.equal(estadoDe(0.9, { op: ">=", valor: 0.95 }), "cerca")
assert.equal(estadoDe(0.5, { op: ">=", valor: 0.95 }), "incumple")
assert.equal(estadoDe(0.5, null), "sin_meta")

const base = { objetivo: "o", formula: "f", meta: "≥ 95%", frecuencia: "Mensual", fuente: "s", tendencia: "Ascendente", procesoResponsable: "p" }
const r = (periodo: string, resultado: number, extra = {}) => ({ periodo, numerador: null, denominador: null, resultado, ...extra })
const ev = evaluarIndicador(
  { ...base, resultados: [r("2026-01", 1), r("2026-02", 0.5), r("2026-04", 0.6, { numerador: 3, denominador: 10, tipoAccion: "no_aplica" }), r("2026-05", 0.7, { accion: "plan" })] },
  new Date(2026, 7, 15), // agosto de 2026
)
assert.deepEqual(ev.periodosSinResultado, ["2026-03"])
assert.deepEqual(ev.periodosPendientesHastaHoy, ["2026-06", "2026-07"])
assert.equal(ev.rachaSinCumplir, 3)
assert.deepEqual(ev.incumplimientosSinAccion, ["2026-02", "2026-04"])
assert.deepEqual(ev.noCoincideConNumeradorDenominador, [{ periodo: "2026-04", resultado: 0.6, recalculado: 0.3 }])
assert.equal(ev.variacionPp, 10)

const vacio = evaluarIndicador({ ...base, frecuencia: "Semestral", formula: null, resultados: [] })
assert.equal(vacio.ultimo, null)
assert.equal(vacio.sinNingunResultado, true)
assert.deepEqual(vacio.periodosPendientesHastaHoy, [])
assert.deepEqual(vacio.definicionIncompleta, ["formula"])
assert.deepEqual(evaluarIndicador({ ...base, resultados: [r("2026-01", 1.4)] }).valoresFueraDeRango, [{ periodo: "2026-01", resultado: 1.4 }])
console.log("indicadorLectura.selfcheck OK")
