/**
 * Convierte una duración en día-calendario (float, como en KPIs OC) a texto legible:
 * - menos de 1 h: minutos y segundos
 * - de 1 h a menos de 24 h: horas y minutos
 * - 24 h o más: días y horas
 */
export function formatDuracionDesdeDias(dias: number): string {
  if (!Number.isFinite(dias) || dias <= 0) {
    return "0 s"
  }

  const totalSec = Math.max(0, Math.round(dias * 86400))

  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    if (m === 0) {
      return `${s} s`
    }
    return `${m} min ${s} s`
  }

  if (totalSec < 86400) {
    const h = Math.floor(totalSec / 3600)
    const rem = totalSec % 3600
    const m = Math.floor(rem / 60)
    if (m === 0) {
      return `${h} h`
    }
    return `${h} h ${m} min`
  }

  const d = Math.floor(totalSec / 86400)
  const rem = totalSec % 86400
  const h = Math.floor(rem / 3600)
  if (h === 0) {
    return `${d} d`
  }
  return `${d} d ${h} h`
}
