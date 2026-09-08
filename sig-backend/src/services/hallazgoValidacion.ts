// Validación de la "regla de demostración" (rubrica_sig.md §4): todo hallazgo
// se prueba o no existe. Puro, sin I/O.
//
// Demostración completa = ubicación exacta (fragmento no vacío) + regla violada:
//   - contradiccion  -> demostracion.citasEnConflicto con 2 citas
//   - clausula       -> demostracion.detalle no vacío
//   - regla_funcion  -> demostracion.detalle no vacío (qué chequeo de §1.x falla)
// Para funcion "1.2" (palabras) la demostración es el sub-formato `palabra`
// completo (las 2 definiciones + por_que_no_encaja + por_que_si_encaja).
//
// Un hallazgo sin demostración NO se descarta silenciosamente: se degrada a
// `observacion` con nota (para no perder la señal) y se reporta en `ajustes`.

export interface HallazgoLike {
  funcion: string
  clasificacion: string
  fragmento?: string | null
  demostracion?: unknown
  palabra?: unknown
  descripcion?: string | null
  [k: string]: unknown
}

export interface AjusteDemostracion {
  funcion: string
  motivo: string
}

function tieneTexto(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

function palabraCompleta(p: unknown): boolean {
  if (!p || typeof p !== "object") return false
  const o = p as Record<string, unknown>
  return (
    tieneTexto(o.palabra) &&
    tieneTexto(o.definicion_palabra) &&
    tieneTexto(o.por_que_no_encaja) &&
    tieneTexto(o.palabra_sugerida) &&
    tieneTexto(o.definicion_sugerida) &&
    tieneTexto(o.por_que_si_encaja)
  )
}

function demostracionValida(h: HallazgoLike): boolean {
  if (h.funcion === "1.2") return palabraCompleta(h.palabra)
  if (!tieneTexto(h.fragmento)) return false
  const d = h.demostracion
  if (!d || typeof d !== "object") return false
  const o = d as Record<string, unknown>
  if (o.tipo === "contradiccion") {
    return Array.isArray(o.citasEnConflicto) && o.citasEnConflicto.filter(tieneTexto).length >= 2
  }
  if (o.tipo === "clausula" || o.tipo === "regla_funcion") {
    return tieneTexto(o.detalle)
  }
  return false
}

/**
 * Devuelve los hallazgos con la clasificación corregida (los que no prueban su
 * caso bajan a `observacion`) más la lista de ajustes hechos.
 */
export function validarDemostracion<T extends HallazgoLike>(
  hallazgos: T[],
): { hallazgos: T[]; ajustes: AjusteDemostracion[] } {
  const ajustes: AjusteDemostracion[] = []
  const out = hallazgos.map((h) => {
    if (h.clasificacion === "observacion" || demostracionValida(h)) return h
    ajustes.push({
      funcion: h.funcion,
      motivo: `Hallazgo ${h.clasificacion} sin demostración completa (§4): se degrada a observación.`,
    })
    return { ...h, clasificacion: "observacion" }
  })
  return { hallazgos: out, ajustes }
}
