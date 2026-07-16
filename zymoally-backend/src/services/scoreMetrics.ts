import type { ZymoPqrAction, ZymoPqrEvidence, ZymoPqrTicket } from "@prisma/client"
import { prisma } from "../config/prisma"
import { businessHoursBetween } from "../utils/businessHours"

type TicketWithDetail = ZymoPqrTicket & { actions?: ZymoPqrAction[]; evidence?: ZymoPqrEvidence[] }

function isResuelto(t: Pick<ZymoPqrTicket, "status">): boolean {
  return /cerrado/i.test(t.status || "")
}

// Reconstruye la secuencia de cambios de estado a partir del texto autogenerado
// por PATCH /:id/estado ("Estado actualizado a X") y detecta si el ticket llegó
// a "cerrado" y luego se movió a un estado distinto (reapertura).
function hadReopen(actions: ZymoPqrAction[]): boolean {
  const changes = actions
    .map((a) => {
      const m = a.texto.match(/Estado actualizado a (.+)$/)
      return m ? { ts: new Date(a.createdAt).getTime(), status: m[1] } : null
    })
    .filter((x): x is { ts: number; status: string } => x !== null)
    .sort((a, b) => a.ts - b.ts)

  let wasClosed = false
  for (const c of changes) {
    const closed = /cerrado/i.test(c.status)
    if (wasClosed && !closed) return true
    wasClosed = closed
  }
  return false
}

/**
 * Score de calidad de gestión por ticket (0-100) — mide CÓMO se gestionó, no
 * velocidad ni volumen puro. 4 señales con pesos iguales, PROVISIONALES —
 * ver docs/superpowers/specs/2026-07-17-zymoally-score-gestion-design.md
 * punto 7, pendiente de ajustar con retroalimentación de los líderes de área.
 */
export function ticketQualityScore(ticket: TicketWithDetail, slaLimitHours: number | null): number {
  const actions = ticket.actions ?? []
  const evidence = ticket.evidence ?? []
  const resuelto = isResuelto(ticket)

  const signals: { weight: number; value: number }[] = []

  // 1. Respuesta — ¿hubo al menos una acción real, o silencio total?
  signals.push({ weight: 1, value: actions.length > 0 ? 1 : 0 })

  // 2. Tiempo — dentro del SLA de su prioridad (solo si esa prioridad tiene límite configurado)
  if (slaLimitHours != null && slaLimitHours > 0) {
    const elapsedEnd = ticket.closedAt ?? new Date()
    const elapsed = businessHoursBetween(ticket.createdAt, elapsedEnd)
    const overBy = Math.max(0, elapsed - slaLimitHours)
    signals.push({ weight: 1, value: Math.max(0, 1 - overBy / slaLimitHours) })
  }

  // 3. Documentación — evidencia real > solo bitácora > nada
  const docValue = evidence.length > 0 ? 1 : actions.length > 0 ? 0.5 : 0
  signals.push({ weight: 1, value: docValue })

  // 4. Estabilidad — solo aplica a tickets ya resueltos (no se puede reabrir lo que sigue abierto)
  if (resuelto) {
    signals.push({ weight: 1, value: hadReopen(actions) ? 0 : 1 })
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
  const weightedSum = signals.reduce((sum, s) => sum + s.weight * s.value, 0)
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0
}

export interface LeaderboardEntry {
  label: string
  avgScore: number
  count: number
  resolved: number
}

function buildLeaderboard(entries: { label: string; score: number; resuelto: boolean }[]): LeaderboardEntry[] {
  const map = new Map<string, { total: number; count: number; resolved: number }>()
  for (const e of entries) {
    const bucket = map.get(e.label) ?? { total: 0, count: 0, resolved: 0 }
    bucket.total += e.score
    bucket.count += 1
    if (e.resuelto) bucket.resolved += 1
    map.set(e.label, bucket)
  }
  return Array.from(map.entries())
    .map(([label, b]) => ({ label, avgScore: Math.round(b.total / b.count), count: b.count, resolved: b.resolved }))
    .sort((a, b) => b.avgScore - a.avgScore)
}

export interface ScoreLeaderboards {
  byPlatform: LeaderboardEntry[]
  byPerson: LeaderboardEntry[]
}

/** Rankings agregados para el Dashboard — por plataforma y por supervisor/coordinador. */
export async function scoreLeaderboards(
  tickets: (ZymoPqrTicket & { actions: ZymoPqrAction[]; evidence: ZymoPqrEvidence[] })[],
): Promise<ScoreLeaderboards> {
  const priorityRows = await prisma.zymoConfigList.findMany({
    where: { listType: "priorities" },
    select: { value: true, slaHours: true },
  })
  const slaByPriority = new Map(priorityRows.map((r) => [r.value, r.slaHours]))

  const scored = tickets.map((ticket) => ({
    ticket,
    score: ticketQualityScore(ticket, slaByPriority.get(ticket.priority) ?? null),
  }))

  const byPlatform = buildLeaderboard(
    scored.map(({ ticket, score }) => ({ label: ticket.platform || "Sin definir", score, resuelto: isResuelto(ticket) })),
  )

  const personEntries: { label: string; score: number; resuelto: boolean }[] = []
  for (const { ticket, score } of scored) {
    const resuelto = isResuelto(ticket)
    if (ticket.supervisor) personEntries.push({ label: ticket.supervisor, score, resuelto })
    if (ticket.coordinator) personEntries.push({ label: ticket.coordinator, score, resuelto })
  }
  const byPerson = buildLeaderboard(personEntries)

  return { byPlatform, byPerson }
}
