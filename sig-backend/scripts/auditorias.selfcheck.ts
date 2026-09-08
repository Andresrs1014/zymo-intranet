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
  assert.deepStrictEqual(v.veredictoPorFuncion, { "1.1": "pasa", "1.2": "pasa", "1.3": "pasa", "1.4": "pasa" })
  assert.deepStrictEqual(v.conteo, { ncMayor: 0, ncMenor: 0, observacion: 0, consulta: 0 })
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

console.log("auditorias.selfcheck: OK")
