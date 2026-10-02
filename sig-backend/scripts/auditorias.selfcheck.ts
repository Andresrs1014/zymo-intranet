/**
 * Self-check de la derivación del veredicto de auditoría (rubrica_sig.md §2.2/§3).
 * Sin I/O. Corre encadenado en: npm run selfcheck
 */
import assert from "assert"
import { derivarVeredicto } from "../src/services/veredicto"
import { validarDemostracion } from "../src/services/hallazgoValidacion"

// Sin hallazgos, sin consultas => pasa.
{
  const v = derivarVeredicto([], 0)
  assert.strictEqual(v.veredicto, "pasa")
  assert.deepStrictEqual(v.veredictoPorFuncion, { "1.1": "pasa", "1.2": "pasa", "1.3": "pasa", "1.4": "pasa", "1.5": "pasa", "1.6": "pasa" })
  assert.deepStrictEqual(v.conteo, { ncMayor: 0, ncMenor: 0, observacion: 0, oportunidadMejora: 0, conformidad: 0, consulta: 0 })
}

// Solo observaciones => sigue pasando, cuenta pero no mueve el veredicto.
{
  const v = derivarVeredicto(
    [
      { funcion: "1.1", clasificacion: "observacion" },
      { funcion: "1.3", clasificacion: "observacion" },
    ],
    0,
  )
  assert.strictEqual(v.veredicto, "pasa")
  assert.strictEqual(v.veredictoPorFuncion["1.1"], "pasa")
  assert.strictEqual(v.conteo.observacion, 2)
}

// 1 NC menor => no_pasa, y solo esa función cae.
{
  const v = derivarVeredicto([{ funcion: "1.2", clasificacion: "nc_menor" }], 0)
  assert.strictEqual(v.veredicto, "no_pasa")
  assert.strictEqual(v.veredictoPorFuncion["1.2"], "no_pasa")
  assert.strictEqual(v.veredictoPorFuncion["1.1"], "pasa")
  assert.strictEqual(v.conteo.ncMenor, 1)
}

// NC mayor cuenta aparte de NC menor.
{
  const v = derivarVeredicto(
    [
      { funcion: "1.4", clasificacion: "nc_mayor" },
      { funcion: "1.4", clasificacion: "nc_menor" },
    ],
    0,
  )
  assert.strictEqual(v.veredicto, "no_pasa")
  assert.strictEqual(v.conteo.ncMayor, 1)
  assert.strictEqual(v.conteo.ncMenor, 1)
  assert.strictEqual(v.veredictoPorFuncion["1.4"], "no_pasa")
}

// Consulta abierta gana sobre todo => incompleto, aunque haya NC.
{
  const v = derivarVeredicto([{ funcion: "1.1", clasificacion: "nc_mayor" }], 2)
  assert.strictEqual(v.veredicto, "incompleto")
  assert.strictEqual(v.conteo.consulta, 2)
}

// Función desconocida en un hallazgo no revienta ni inventa clave nueva.
{
  const v = derivarVeredicto([{ funcion: "9.9", clasificacion: "nc_menor" }], 0)
  assert.strictEqual(v.veredicto, "no_pasa")
  assert.ok(!("9.9" in v.veredictoPorFuncion))
}

// ── validarDemostracion (§4) ───────────────────────────────────────────────
{
  // NC con contradicción de 2 citas -> válida, se queda como está.
  const ok = validarDemostracion([
    {
      funcion: "1.1",
      clasificacion: "nc_mayor",
      fragmento: "«el analista aprueba»",
      demostracion: { tipo: "contradiccion", citasEnConflicto: ["«A»", "«B»"] },
    },
  ])
  assert.strictEqual(ok.hallazgos[0].clasificacion, "nc_mayor")
  assert.strictEqual(ok.ajustes.length, 0)
}
{
  // NC sin demostración -> baja a observación + 1 ajuste.
  const bad = validarDemostracion([
    { funcion: "1.3", clasificacion: "nc_menor", fragmento: "«x»", demostracion: {} },
  ])
  assert.strictEqual(bad.hallazgos[0].clasificacion, "observacion")
  assert.strictEqual(bad.ajustes.length, 1)
}
{
  // contradicción con una sola cita -> insuficiente -> baja a observación.
  const bad = validarDemostracion([
    {
      funcion: "1.1",
      clasificacion: "nc_menor",
      fragmento: "«x»",
      demostracion: { tipo: "contradiccion", citasEnConflicto: ["«solo una»"] },
    },
  ])
  assert.strictEqual(bad.hallazgos[0].clasificacion, "observacion")
}
{
  // funcion 1.2: exige el sub-formato `palabra` completo.
  const incompleto = validarDemostracion([
    { funcion: "1.2", clasificacion: "nc_menor", palabra: { palabra: "gestionar" } },
  ])
  assert.strictEqual(incompleto.hallazgos[0].clasificacion, "observacion")

  const completo = validarDemostracion([
    {
      funcion: "1.2",
      clasificacion: "nc_menor",
      palabra: {
        palabra: "gestionar",
        definicion_palabra: "...",
        por_que_no_encaja: "...",
        palabra_sugerida: "registrar",
        definicion_sugerida: "...",
        por_que_si_encaja: "...",
      },
    },
  ])
  assert.strictEqual(completo.hallazgos[0].clasificacion, "nc_menor")
}
{
  // una observación nunca se toca (ya es el piso).
  const obs = validarDemostracion([{ funcion: "1.4", clasificacion: "observacion" }])
  assert.strictEqual(obs.hallazgos[0].clasificacion, "observacion")
  assert.strictEqual(obs.ajustes.length, 0)
}

{
  // Rúbrica §3.4: conformidades y OM nunca cambian el veredicto; 1.5/1.6 existen.
  const v = derivarVeredicto(
    [
      { funcion: "1.6", clasificacion: "oportunidad_mejora" },
      { funcion: "1.5", clasificacion: "observacion" },
    ],
    0,
    3,
  )
  assert.strictEqual(v.veredicto, "pasa")
  assert.strictEqual(v.conteo.oportunidadMejora, 1)
  assert.strictEqual(v.conteo.conformidad, 3)
  assert.strictEqual(v.veredictoPorFuncion["1.6"], "pasa")
  assert.strictEqual(derivarVeredicto([{ funcion: "1.6", clasificacion: "nc_menor" }], 0).veredictoPorFuncion["1.6"], "no_pasa")
}
{
  // Conformidad: solo criterio + evidencia. OM: exige criterio y condición. KPI: objeto kpi completo.
  const conf = validarDemostracion([{ funcion: "1.1", clasificacion: "conformidad", fragmento: "«x»", criterio: "C1" }])
  assert.strictEqual(conf.hallazgos[0].clasificacion, "conformidad")
  const confSinCriterio = validarDemostracion([{ funcion: "1.1", clasificacion: "conformidad", fragmento: "«x»" }])
  assert.strictEqual(confSinCriterio.hallazgos[0].clasificacion, "observacion")

  const omSinCondicion = validarDemostracion([
    { funcion: "1.6", clasificacion: "oportunidad_mejora", fragmento: "«x»", criterio: "C2", demostracion: { tipo: "regla_funcion", detalle: "1.6" } },
  ])
  assert.strictEqual(omSinCondicion.hallazgos[0].clasificacion, "observacion")

  const kpiOk = validarDemostracion([
    {
      funcion: "1.6",
      clasificacion: "nc_menor",
      fragmento: "«x»",
      criterio: "C2",
      demostracion: { tipo: "kpi", detalle: "meta 95%" },
      kpi: { nombre: "Cumplimiento", periodo: "2026-08", resultado: "80%" },
    },
  ])
  assert.strictEqual(kpiOk.hallazgos[0].clasificacion, "nc_menor")
  const kpiIncompleto = validarDemostracion([
    { funcion: "1.6", clasificacion: "nc_menor", fragmento: "«x»", demostracion: { tipo: "kpi", detalle: "meta 95%" }, kpi: { nombre: "Cumplimiento" } },
  ])
  assert.strictEqual(kpiIncompleto.hallazgos[0].clasificacion, "observacion")
}

{
  // Contrato con el MCP: un payload completo de la rúbrica §6.2 debe pasar el esquema del router.
  const { AuditoriaSchema } = require("../src/routers/auditorias")
  const payload = {
    procedimientoId: 1,
    commitId: 5,
    resumenEjecutivo: "x",
    reporteMarkdown: "# informe",
    alcance: { tipo: "procedimiento", documentos: [{ codigo: "PRC-001" }], periodoKpi: { desde: "2026-01", hasta: "2026-06" } },
    criterios: [{ id: "C1", tipo: "norma", fuente: "ISO 9001" }],
    comprensionProceso: "…",
    supuestos: ["asumo X"],
    seguimiento: [{ hallazgoId: 3, estado: "sigue_abierto", motivo: "persiste desde v2" }],
    hallazgos: [{
      funcion: "1.6", nivel: 1, clasificacion: "oportunidad_mejora", fragmento: "«x»", descripcion: "d", dedupeKey: "k",
      criterio: "C1", condicion: "brecha", demostracion: { tipo: "kpi", detalle: "meta" },
      kpi: { nombre: "N", periodo: "2026-03", resultado: "80%" }, riesgo: { prioridad: "baja" }, causa: { tipo: "hipotesis", detalle: "?" },
    }],
    consultas: [
      { tipo: "dato_kpi", funcion: "1.6", kpi: "N", faltante: "resultado", periodo: "2026-03", pregunta: "¿Se midió?" },
      { tipo: "contexto_operativo", funcion: "1.1", fragmento: "«y»", pregunta: "¿Es claro?" },
    ],
  }
  const r = AuditoriaSchema.safeParse(payload)
  assert.ok(r.success, JSON.stringify(r.success ? "" : r.error.flatten()))
  // estado de seguimiento inválido se rechaza
  const mal = AuditoriaSchema.safeParse({ ...payload, seguimiento: [{ hallazgoId: 3, estado: "otro", motivo: "m" }] })
  assert.ok(!mal.success)
}

{
  // Una regla apagada no deja rastro: solo aparecen las funciones evaluadas (y las que tienen algo abierto).
  const evaluadas = ["1.1", "1.2", "1.3", "1.4", "1.6"]
  const sin15 = derivarVeredicto([], 0, 0, evaluadas)
  assert.deepStrictEqual(Object.keys(sin15.veredictoPorFuncion), evaluadas, "1.5 no debe aparecer si no se evaluó")
  assert.ok(!JSON.stringify(sin15).includes("1.5"), "ningún rastro de la función apagada en el resultado")
  // una consulta congela el veredicto de SU función (y solo de ella), aunque haya una NC
  const cong = derivarVeredicto([{ funcion: "1.6", clasificacion: "nc_menor" }, { funcion: "1.4", clasificacion: "nc_menor" }], [{ funcion: "1.6" }], 0, evaluadas)
  assert.strictEqual(cong.veredictoPorFuncion["1.6"], "incompleto")
  assert.strictEqual(cong.veredictoPorFuncion["1.4"], "no_pasa")
  assert.strictEqual(cong.veredicto, "incompleto")
  // un hallazgo abierto de una corrida anterior en una función hoy no evaluada SÍ se muestra (es un hecho)
  const previo = derivarVeredicto([{ funcion: "1.5", clasificacion: "nc_menor" }], 0, 0, evaluadas)
  assert.strictEqual(previo.veredictoPorFuncion["1.5"], "no_pasa")
}
{
  // `alcance.funciones` pasa por el esquema del router y valida los valores
  const { AuditoriaSchema } = require("../src/routers/auditorias")
  const base = { procedimientoId: 1, resumenEjecutivo: "x", reporteMarkdown: "y" }
  assert.ok(AuditoriaSchema.safeParse({ ...base, alcance: { tipo: "procedimiento", funciones: ["1.1", "1.6"] } }).success)
  assert.ok(!AuditoriaSchema.safeParse({ ...base, alcance: { funciones: ["9.9"] } }).success, "función inexistente")
}

console.log("auditorias.selfcheck: OK")
