import { prisma } from "../config/prisma"
import { notifyTicketReminder } from "./emailService"
import { currentDateValue } from "../utils/formatters"

// Fase F — cadencia de recordatorios acordada con el usuario (2026-07-16):
// solo alertar, nunca auto-cerrar. Días 7/15/22/30 desde createdAt (calendario,
// no horas laborales — es un seguimiento de relación, no el SLA técnico por
// prioridad de Fase C).
const MILESTONES = [7, 15, 22, 30]

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
}

function reachedMilestone(days: number, lastReminderDay: number): number | null {
  const next = [...MILESTONES].reverse().find((m) => m <= days && m > lastReminderDay)
  return next ?? null
}

export interface ReminderRunResult {
  checked: number
  sent: number
  ranAt: string
}

export async function runTicketReminders(): Promise<ReminderRunResult> {
  const tickets = await prisma.zymoPqrTicket.findMany({
    where: { status: { not: "Cerrado" } },
  })

  let sent = 0
  for (const ticket of tickets) {
    const recipients = [ticket.supervisorEmail, ...ticket.analystEmails, ticket.coordinatorEmail].filter(
      (e): e is string => Boolean(e),
    )
    if (!recipients.length) continue

    const days = daysSince(ticket.createdAt)
    const milestone = reachedMilestone(days, ticket.lastReminderDay)
    if (milestone === null) continue

    const result = await notifyTicketReminder(recipients, milestone >= 15 ? ticket.managerEmail : null, {
      code: ticket.code,
      area: ticket.area,
      type: ticket.type,
      priority: ticket.priority,
      daysOpen: days,
    })

    await prisma.zymoPqrTicket.update({
      where: { id: ticket.id },
      data: { lastReminderDay: milestone },
    })
    await prisma.zymoPqrAction.create({
      data: {
        ticketId: ticket.id,
        texto:
          result === "sent"
            ? `${currentDateValue()} - Recordatorio automático enviado (día ${milestone} sin cerrar).`
            : `${currentDateValue()} - Recordatorio automático (día ${milestone}) no se pudo enviar (${result}).`,
      },
    })
    if (result === "sent") sent++
  }

  return { checked: tickets.length, sent, ranAt: new Date().toISOString() }
}
