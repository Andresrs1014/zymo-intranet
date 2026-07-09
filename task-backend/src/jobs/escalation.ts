import axios from "axios"
import prisma from "../config/prisma"
import { env } from "../config/env"

const COOLDOWN_ACTION = "alerta_escalamiento"

// ponytail: guard en memoria — alcanza porque el cron corre en un único proceso Node;
// si algún día se escala a múltiples instancias, subir a un advisory lock de Postgres.
let running = false

export async function runEscalationCheck(): Promise<void> {
  if (running) {
    console.warn("[Escalation] Corrida anterior aún en curso, se omite este tick.")
    return
  }
  running = true
  try {
    await runEscalationCheckInner()
  } finally {
    running = false
  }
}

async function runEscalationCheckInner(): Promise<void> {
  const startHour = env.ESCALATION_START_HOUR
  const endHour = env.ESCALATION_END_HOUR

  // Respect business hours (UTC-5 equivalent check on UTC hour)
  const nowUtc = new Date()
  const localHour = (nowUtc.getUTCHours() - 5 + 24) % 24
  if (localHour < startHour || localHour >= endHour) {
    return
  }

  const cutoff = new Date(Date.now() - env.ESCALATION_HOURS * 60 * 60 * 1000)

  // Get all non-final, non-canceled states across all teams
  const finalStates = await prisma.listConfig.findMany({
    where: { listType: "estado", OR: [{ isFinal: true }, { isCanceled: true }], isActive: true },
    select: { value: true, teamId: true },
  })

  // Group by team
  const teamFinalStates = new Map<number, Set<string>>()
  for (const s of finalStates) {
    if (!teamFinalStates.has(s.teamId)) teamFinalStates.set(s.teamId, new Set())
    teamFinalStates.get(s.teamId)!.add(s.value)
  }

  // Find stale tasks: asignadas, not in final/canceled state, not updated in > escalation_hours
  const staleTasks = await prisma.task.findMany({
    where: {
      asignadoAId: { not: null },
      updatedAt: { lt: cutoff },
    },
    include: {
      team: { select: { id: true, ownerUserId: true } },
    },
  })

  // Check 24h cooldown para todas las tareas candidatas en una sola query (evita N+1)
  const recentAlerts = await prisma.activityLog.findMany({
    where: {
      taskId: { in: staleTasks.map((t) => t.id) },
      accion: "edicion",
      detalle: COOLDOWN_ACTION,
      fecha: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { taskId: true },
  })
  const alertedTaskIds = new Set(recentAlerts.map((a) => a.taskId))

  for (const task of staleTasks) {
    const teamFinals = teamFinalStates.get(task.teamId) ?? new Set()
    if (teamFinals.has(task.estado)) continue // Already final/canceled
    if (alertedTaskIds.has(task.id)) continue // Already alerted in the last 24h

    const message = `La tarea "${task.titulo}" asignada a ${task.asignadoANombre ?? "—"} lleva más de ${env.ESCALATION_HOURS}h sin actualización.`

    // Send WhatsApp alert to team owner
    await axios
      .post(
        `${env.INTRANET_API_URL}/api/whatsapp/send`,
        { userId: task.team.ownerUserId, message },
        { timeout: 5000, headers: { "X-Internal-Key": env.INTERNAL_KEY } },
      )
      .catch((err: Error) => {
        console.error(`[Escalation] WhatsApp send failed for task ${task.id}:`, err.message)
      })

    // Log to prevent duplicate alerts within 24h
    await prisma.activityLog.create({
      data: {
        taskId: task.id,
        userId: 0,
        userNombre: "Sistema",
        accion: "edicion",
        detalle: COOLDOWN_ACTION,
      },
    })

    console.log(`[Escalation] Alerted for task ${task.id}: ${task.titulo}`)
  }
}
