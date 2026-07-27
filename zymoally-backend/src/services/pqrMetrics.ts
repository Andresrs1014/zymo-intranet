import type { ZymoPqrEvidence, ZymoPqrTicket } from "@prisma/client"
import { currentDateValue, daysOpen, impactAgeStatus } from "../utils/formatters"

type TicketWithEvidence = ZymoPqrTicket & { evidence?: ZymoPqrEvidence[] }

// Ported from ZymoAlly app.js pqrAiSummary() (líneas 513-534)
export function pqrAiSummary(items: TicketWithEvidence[]): string[] {
  if (!items.length) {
    return [
      "Sin tickets PQR en la consulta actual. Prioridad: revisar filtros o registrar casos con evidencia, responsable, fecha compromiso y canal de cierre.",
      "IA PQR: cuando existan registros filtrados, active lectura de riesgos, tiempos objetivo y acciones de servicio.",
    ]
  }
  const open = items.filter((item) => !/cerrado/i.test(item.status || "")).length
  const critical = items.filter((item) => /critica/i.test(item.priority || "") || /escalado/i.test(item.status || "")).length
  const withEvidence = items.filter((item) => item.evidence && item.evidence.length).length
  const due = items.filter((item) => item.dueDate && item.dueDate <= currentDateValue() && !/cerrado/i.test(item.status || "")).length
  const overLimit = items.filter((item) => impactAgeStatus(item) === "vencido").length
  const lines = [
    `Lectura IA PQR: ${items.length} ticket(s), ${open} abierto(s), ${critical} critico(s) o escalado(s), ${due} con compromiso vencido o al limite y ${overLimit} fuera del tiempo objetivo por impacto.`,
    `Trazabilidad documental: ${withEvidence} ticket(s) tienen evidencia cargada. Mantener soporte de cierre para auditoria y servicio al cliente.`,
  ]
  if (critical) lines.push("Accion IA: escalar criticidad con responsable, causa raiz, contencion inmediata y comunicacion formal al cliente.")
  if (due) lines.push("Accion IA: priorizar tickets vencidos y enviar confirmacion de avance por WhatsApp o correo.")
  if (overLimit) lines.push("Accion IA: revisar antiguedad sin cierre frente al impacto, actualizar acciones efectuadas y documentar evidencia de avance.")
  if (open && !critical) lines.push("Accion IA: mantener cadencia de seguimiento y cerrar con evidencia verificable.")
  return lines
}

function countBy<T extends Record<string, unknown>>(items: T[], field: keyof T): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = String(item[field] ?? "Sin dato")
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

// Ported from renderPqrDashboard() metric block (app.js líneas 760-786)
export function pqrDashboardMetrics(items: TicketWithEvidence[]) {
  const open = items.filter((item) => !/cerrado/i.test(item.status || "")).length
  const critical = items.filter((item) => /critica/i.test(item.priority || "") || /escalado/i.test(item.status || "")).length
  const withEvidence = items.filter((item) => item.evidence && item.evidence.length).length
  const due = items.filter((item) => item.dueDate && item.dueDate <= currentDateValue() && !/cerrado/i.test(item.status || "")).length
  const overLimit = items.filter((item) => impactAgeStatus(item) === "vencido").length
  const closed = items.filter((item) => /cerrado/i.test(item.status || "")).length
  return {
    total: items.length,
    open,
    critical,
    withEvidence,
    due,
    overLimit,
    closed,
    byStatus: countBy(items, "status"),
    byType: countBy(items, "type"),
    byArea: countBy(items, "area"),
  }
}

// Ported from alerts() — subset de tickets PQR (app.js líneas 374-388)
export function pqrAlerts(tickets: ZymoPqrTicket[]) {
  return tickets
    .filter((ticket) => {
      if (/cerrado/i.test(ticket.status || "")) return false
      const due = Boolean(ticket.dueDate && ticket.dueDate <= currentDateValue())
      return due || impactAgeStatus(ticket) === "vencido" || /critica|alta/i.test(`${ticket.priority} ${ticket.impact}`) || /escalado/i.test(ticket.status || "")
    })
    .map((ticket) => ({
      title: `Ticket PQR ${ticket.code || "sin codigo"} - ${ticket.client || "Cliente"}`,
      priority: /critica|escalado/i.test(`${ticket.priority} ${ticket.impact} ${ticket.status}`) ? "Critica" : "Alta",
      detail: `Estado ${ticket.status || "Sin estado"}, impacto ${ticket.impact || "Sin impacto"}, ${daysOpen(ticket)} dia(s) sin cerrar. Compromiso: ${ticket.dueDate || "por definir"}.`,
      target: ticket.supervisor || ticket.analysts[0] || ticket.owner || "Responsable PQR",
      source: "Ticket PQR",
      sourceGroup: "pqr" as const,
    }))
    .slice(0, 50)
}
