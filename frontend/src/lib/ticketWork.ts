import type { Ticket } from "@/types/ticket"

export function currentDateValue(): string {
  return new Date().toISOString().slice(0, 10)
}

// Espejo de daysOpen() en zymoally-backend/src/utils/formatters.ts — mismo
// cálculo, mismo comportamiento, para que el badge del cliente coincida con
// lo que el backend usaría si se le pidiera.
export function daysOpen(ticket: Pick<Ticket, "date" | "status" | "closedDate">): number {
  const start = new Date(`${ticket.date}T12:00:00`)
  const endDate = /cerrado/i.test(ticket.status) && ticket.closedDate ? ticket.closedDate : currentDateValue()
  const end = new Date(`${endDate}T12:00:00`)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
}

export function impactLimit(impact?: string | null): number {
  if (/critico/i.test(impact || "")) return 1
  if (/alto/i.test(impact || "")) return 2
  if (/medio/i.test(impact || "")) return 5
  return 8
}

export type ImpactAgeStatus = "cerrado" | "vencido" | "en-tiempo"

export function impactAgeStatus(ticket: Pick<Ticket, "date" | "status" | "closedDate" | "impact">): ImpactAgeStatus {
  if (/cerrado/i.test(ticket.status)) return "cerrado"
  return daysOpen(ticket) > impactLimit(ticket.impact) ? "vencido" : "en-tiempo"
}

interface Tone {
  text: string
  bg: string
  border: string
}

// Tonos fijos por texto de prioridad — badge visual únicamente, no reemplaza
// el motor de alertas/SLA (ese fix es F4, aparte).
export function priorityTone(priority: string): Tone {
  if (/critica/i.test(priority)) return { text: "#a8172f", bg: "#fce9ed", border: "#f0b8c3" }
  if (/alta/i.test(priority)) return { text: "#b45309", bg: "#fef3c7", border: "#fcd34d" }
  if (/media/i.test(priority)) return { text: "#3f3f46", bg: "#f4f4f5", border: "#d4d4d8" }
  return { text: "#52525b", bg: "#fafafa", border: "#e4e4e7" }
}
