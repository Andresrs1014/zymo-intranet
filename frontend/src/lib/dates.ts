/**
 * Utilidades de fecha/hora para Colombia (America/Bogota, UTC-5).
 *
 * El backend devuelve datetimes de SQLite sin sufijo Z ("2026-04-14T20:30:00"),
 * lo que hace que JS los interprete como hora local del servidor en vez de UTC.
 * Forzamos la interpretación como UTC agregando Z cuando falta.
 */

const TZ = "America/Bogota"

function toUTC(iso: string): Date {
  // Si ya tiene indicador de zona horaria, lo respeta; si no, asume UTC
  const hasZone = iso.endsWith("Z") || iso.includes("+") || /[-+]\d{2}:\d{2}$/.test(iso)
  return new Date(hasZone ? iso : iso + "Z")
}

/** Fecha y hora: "14 abr., 10:30 a. m." */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—"
  return toUTC(iso).toLocaleString("es-CO", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Solo fecha: "14 abr. 2026" */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—"
  return toUTC(iso).toLocaleString("es-CO", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Relativo: "hace 2 días" / "hoy" */
export function formatFechaRelativa(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = toUTC(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) return "hoy"
  if (diffDays === 1) return "ayer"
  if (diffDays < 7) return `hace ${diffDays} días`
  return date.toLocaleString("es-CO", { timeZone: TZ, day: "numeric", month: "short" })
}
