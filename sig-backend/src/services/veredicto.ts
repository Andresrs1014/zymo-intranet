// Derivación del veredicto de auditoría del SIG (rubrica_sig.md §2.2 / §3).
// Puro, sin I/O. El veredicto NUNCA lo manda el cliente: se deriva acá a partir
// de la clasificación de los hallazgos ABIERTO + el nº de consultas ABIERTA.

export const FUNCIONES = ["1.1", "1.2", "1.3", "1.4"] as const
export const CLASIFICACIONES = ["observacion", "nc_menor", "nc_mayor"] as const

export interface VeredictoDerivado {
  veredicto: "pasa" | "no_pasa" | "incompleto"
  veredictoPorFuncion: Record<string, "pasa" | "no_pasa">
  conteo: { ncMayor: number; ncMenor: number; observacion: number; consulta: number }
}

export function derivarVeredicto(
  hallazgos: Array<{ funcion: string; clasificacion: string }>,
  consultasAbiertas: number,
): VeredictoDerivado {
  const conteo = { ncMayor: 0, ncMenor: 0, observacion: 0, consulta: consultasAbiertas }
  const veredictoPorFuncion: Record<string, "pasa" | "no_pasa"> = {}
  for (const f of FUNCIONES) veredictoPorFuncion[f] = "pasa"

  for (const h of hallazgos) {
    if (h.clasificacion === "nc_mayor") {
      conteo.ncMayor++
      if (h.funcion in veredictoPorFuncion) veredictoPorFuncion[h.funcion] = "no_pasa"
    } else if (h.clasificacion === "nc_menor") {
      conteo.ncMenor++
      if (h.funcion in veredictoPorFuncion) veredictoPorFuncion[h.funcion] = "no_pasa"
    } else if (h.clasificacion === "observacion") {
      conteo.observacion++
    }
  }

  const hayNC = conteo.ncMayor > 0 || conteo.ncMenor > 0
  const veredicto = consultasAbiertas > 0 ? "incompleto" : hayNC ? "no_pasa" : "pasa"
  return { veredicto, veredictoPorFuncion, conteo }
}
