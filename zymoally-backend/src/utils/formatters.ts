// Ported from ZymoAlly app.js (líneas 168-231)

export function currentDateValue(): string {
  return new Date().toISOString().slice(0, 10)
}

export function pqrMonthKey(dateValue?: string): string {
  return String(dateValue || currentDateValue()).slice(0, 7).replace("-", "")
}

export function pqrShortDateKey(dateValue?: string): string {
  const [year = "", month = "", day = ""] = String(dateValue || currentDateValue()).slice(0, 10).split("-")
  return `${year.slice(-2)}${month}${day}`
}

export function normalizePrefix(value?: string): string {
  return String(value || "PQR").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PQR"
}

export function areaPrefixLabel(item: { area: string; prefix: string }): string {
  return `${item.area} | ${normalizePrefix(item.prefix)}`
}

export function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

export function daysOpen(ticket: { date: string; createdAt?: Date | string; status: string; closedDate?: string | null }): number {
  const baseDate = ticket.date || String(ticket.createdAt ?? "").slice(0, 10) || currentDateValue()
  const start = new Date(`${baseDate}T12:00:00`)
  const endDate = /cerrado/i.test(ticket.status || "") && ticket.closedDate ? ticket.closedDate : currentDateValue()
  const end = new Date(`${endDate}T12:00:00`)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
}

export function impactLimit(impact?: string | null): number {
  if (/critico/i.test(impact || "")) return 1
  if (/alto/i.test(impact || "")) return 2
  if (/medio/i.test(impact || "")) return 5
  return 8
}

export function impactAgeStatus(ticket: { date: string; createdAt?: Date | string; status: string; closedDate?: string | null; impact?: string | null }): "cerrado" | "vencido" | "en-tiempo" {
  if (/cerrado/i.test(ticket.status || "")) return "cerrado"
  return daysOpen(ticket) > impactLimit(ticket.impact) ? "vencido" : "en-tiempo"
}

export function average(items: Record<string, unknown>[], field: string): number {
  if (!items.length) return 0
  return Math.round((items.reduce((sum, item) => sum + Number(item[field] || 0), 0) / items.length) * 10) / 10
}
