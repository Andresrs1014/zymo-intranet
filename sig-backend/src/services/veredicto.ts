// Derivación del veredicto de auditoría del SIG (rubrica_sig.md §2.2 / §3).
// Puro, sin I/O. El veredicto NUNCA lo manda el cliente: se deriva acá a partir
// de la clasificación de los hallazgos ABIERTO + las consultas ABIERTA.

export const FUNCIONES = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] as const
export const CLASIFICACIONES = [
  "conformidad",
  "observacion",
  "oportunidad_mejora",
  "nc_menor",
  "nc_mayor",
] as const

export type VeredictoFuncion = "pasa" | "no_pasa" | "incompleto"

export interface VeredictoDerivado {
  veredicto: "pasa" | "no_pasa" | "incompleto"
  veredictoPorFuncion: Record<string, VeredictoFuncion>
  conteo: {
    ncMayor: number
    ncMenor: number
    observacion: number
    oportunidadMejora: number
    conformidad: number
    consulta: number
  }
}

/**
 * @param consultas  consultas ABIERTA: su número, o la lista (con `funcion`) para que cada una congele
 *                   el veredicto de SU función (rúbrica §3.3).
 * @param evaluadas  funciones que la corrida evaluó (`alcance.funciones`). Solo esas aparecen en
 *                   `veredictoPorFuncion`: una función que no se evaluó NO deja ningún rastro (ni "pasa"
 *                   ni "no evaluada"), para que apagar una regla no contamine el resultado. Aparece,
 *                   eso sí, una función con algo abierto (un hecho de una corrida anterior). Sin
 *                   `evaluadas`, se muestran las seis (compatibilidad).
 */
export function derivarVeredicto(
  hallazgos: Array<{ funcion: string; clasificacion: string }>,
  consultas: number | Array<{ funcion: string }>,
  conformidades = 0,
  evaluadas?: readonly string[],
): VeredictoDerivado {
  const consultasLista = typeof consultas === "number" ? [] : consultas
  const consultasAbiertas = typeof consultas === "number" ? consultas : consultas.length
  const conteo = {
    ncMayor: 0,
    ncMenor: 0,
    observacion: 0,
    oportunidadMejora: 0,
    conformidad: conformidades,
    consulta: consultasAbiertas,
  }

  const esFuncion = (f: string): boolean => (FUNCIONES as readonly string[]).includes(f)
  const mostrar = new Set<string>(evaluadas ?? FUNCIONES)
  for (const h of hallazgos) if (h.clasificacion !== "conformidad" && esFuncion(h.funcion)) mostrar.add(h.funcion)
  for (const c of consultasLista) if (esFuncion(c.funcion)) mostrar.add(c.funcion)

  const veredictoPorFuncion: Record<string, VeredictoFuncion> = {}
  for (const f of FUNCIONES) if (mostrar.has(f)) veredictoPorFuncion[f] = "pasa"

  for (const h of hallazgos) {
    if (h.clasificacion === "nc_mayor") {
      conteo.ncMayor++
      if (h.funcion in veredictoPorFuncion) veredictoPorFuncion[h.funcion] = "no_pasa"
    } else if (h.clasificacion === "nc_menor") {
      conteo.ncMenor++
      if (h.funcion in veredictoPorFuncion) veredictoPorFuncion[h.funcion] = "no_pasa"
    } else if (h.clasificacion === "observacion") {
      conteo.observacion++
    } else if (h.clasificacion === "oportunidad_mejora") {
      conteo.oportunidadMejora++
    }
  }
  // Una consulta abierta congela el veredicto de su función (aunque ya haya una NC): §3.4.
  for (const c of consultasLista) if (c.funcion in veredictoPorFuncion) veredictoPorFuncion[c.funcion] = "incompleto"

  const hayNC = conteo.ncMayor > 0 || conteo.ncMenor > 0
  const veredicto = consultasAbiertas > 0 ? "incompleto" : hayNC ? "no_pasa" : "pasa"
  return { veredicto, veredictoPorFuncion, conteo }
}
