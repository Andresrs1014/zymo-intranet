// Horas laborales 7am–7pm, hora Colombia (UTC-5, sin horario de verano) — misma
// ventana que ya usa el escalamiento de Tareas V2 (ESCALATION_START_HOUR/END_HOUR).
// ponytail: desfase fijo en vez de Intl/timezone real — Colombia no tiene DST,
// suficiente para este cálculo; si algún día se opera en otro país, revisar.
const TZ_OFFSET_HOURS = 5
const START_HOUR = 7
const END_HOUR = 19

function toLocalAsUtc(d: Date): Date {
  return new Date(d.getTime() - TZ_OFFSET_HOURS * 3_600_000)
}

/** Horas laborales transcurridas entre dos fechas, recortando cada día a la
 * ventana 7am-7pm (todos los días, sin excluir fines de semana). */
export function businessHoursBetween(start: Date, end: Date): number {
  if (end <= start) return 0

  let cursor = toLocalAsUtc(start)
  const endLocal = toLocalAsUtc(end)
  let hours = 0

  while (cursor < endLocal) {
    const windowStart = new Date(cursor)
    windowStart.setUTCHours(START_HOUR, 0, 0, 0)
    const windowEnd = new Date(cursor)
    windowEnd.setUTCHours(END_HOUR, 0, 0, 0)

    const segStart = cursor > windowStart ? cursor : windowStart
    const segEnd = endLocal < windowEnd ? endLocal : windowEnd
    if (segEnd > segStart) {
      hours += (segEnd.getTime() - segStart.getTime()) / 3_600_000
    }

    cursor = new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    cursor.setUTCHours(START_HOUR, 0, 0, 0)
  }

  return Math.round(hours * 100) / 100
}
