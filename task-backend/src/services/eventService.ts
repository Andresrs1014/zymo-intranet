import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload, getUserId, isAdmin } from "../middleware/auth"
import { getManagedTeamIds, getMemberTeamIds } from "../utils/permissions"
import * as webhookService from "./webhookService"
import { env } from "../config/env"

interface TimeSlot {
  startMinutes: number
  endMinutes: number
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + (m ?? 0)
}

function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
}

async function enrichUserNames(userIds: number[]): Promise<Map<number, string>> {
  const nameMap = new Map<number, string>()
  try {
    const res = await fetch(`${env.INTRANET_API_URL}/api/tasks-v2/users`, {
      headers: { "X-Internal-Key": env.INTERNAL_KEY },
    })
    if (res.ok) {
      const users = await res.json() as { id: number; full_name: string | null; email: string }[]
      for (const u of users) {
        if (userIds.includes(u.id)) {
          nameMap.set(u.id, u.full_name ?? u.email)
        }
      }
    }
  } catch { /* best-effort */ }
  return nameMap
}

/** Detect schedule conflicts for a set of participants on a given date */
async function detectConflicts(
  eventId: number | null,
  teamId: number,
  fecha: string,
  horaInicio: string,
  duracionMinutos: number,
  participantIds: number[],
): Promise<Map<number, string>> {
  if (participantIds.length === 0) return new Map()

  const slot: TimeSlot = {
    startMinutes: parseTimeToMinutes(horaInicio),
    endMinutes: parseTimeToMinutes(horaInicio) + duracionMinutos,
  }

  const otherEvents = await prisma.event.findMany({
    where: {
      teamId,
      fecha: new Date(fecha),
      ...(eventId ? { id: { not: eventId } } : {}),
      participants: { some: { userId: { in: participantIds } } },
    },
    select: {
      id: true,
      titulo: true,
      horaInicio: true,
      duracionMinutos: true,
      participants: { select: { userId: true } },
    },
  })

  const conflicts = new Map<number, string>()

  for (const ev of otherEvents) {
    const evSlot: TimeSlot = {
      startMinutes: parseTimeToMinutes(ev.horaInicio),
      endMinutes: parseTimeToMinutes(ev.horaInicio) + ev.duracionMinutos,
    }
    if (!overlaps(slot, evSlot)) continue
    for (const p of ev.participants) {
      if (participantIds.includes(p.userId)) {
        conflicts.set(p.userId, `Conflicto con "${ev.titulo}" a las ${ev.horaInicio}`)
      }
    }
  }

  return conflicts
}

// ─── Create event ─────────────────────────────────────────────────────────────

export interface CreateEventInput {
  teamId: number
  titulo: string
  descripcion?: string
  plataforma?: string
  prioridad?: string
  modalidad?: string
  sede?: string
  fecha: string
  horaInicio: string
  duracionMinutos?: number
  participantIds?: number[]
}

export async function createEvent(user: AuthPayload, input: CreateEventInput) {
  const userId = getUserId(user)

  const trimmed = input.titulo.trim()
  if (trimmed.length < 3) throw new AppError(422, "El título debe tener al menos 3 caracteres")

  const duracion = input.duracionMinutos ?? 60
  const participantIds = Array.from(new Set([userId, ...(input.participantIds ?? [])]))

  const conflicts = await detectConflicts(
    null,
    input.teamId,
    input.fecha,
    input.horaInicio,
    duracion,
    participantIds,
  )

  const nameMap = await enrichUserNames(participantIds)

  const created = await prisma.event.create({
    data: {
      teamId: input.teamId,
      ownerUserId: userId,
      titulo: trimmed,
      descripcion: input.descripcion ?? null,
      plataforma: input.plataforma ?? null,
      prioridad: input.prioridad ?? null,
      modalidad: input.modalidad ?? null,
      sede: input.sede ?? null,
      fecha: new Date(input.fecha),
      horaInicio: input.horaInicio,
      duracionMinutos: duracion,
      creadoPorId: userId,
      creadoPorNombre: user.full_name ?? `Usuario ${userId}`,
      participants: {
        create: participantIds.map((uid) => ({
          userId: uid,
          userNombre: uid === userId ? (user.full_name ?? `Usuario ${uid}`) : (nameMap.get(uid) ?? `Usuario ${uid}`),
          hasConflict: conflicts.has(uid),
          conflictDetail: conflicts.get(uid) ?? null,
          confirmado: uid === userId,
        })),
      },
    },
    include: { participants: true },
  })

  // Fire-and-forget: notificar a Power Automate para crear reunión Teams/Outlook
  void (async () => {
    const participantesInfo = await Promise.all(
      participantIds.map(async (uid) => {
        try {
          const res = await fetch(`${env.INTRANET_API_URL}/api/users/${uid}`, {
            headers: { "X-Internal-Key": env.INTERNAL_KEY },
          })
          if (!res.ok) return { email: `usuario${uid}@zymo.com`, nombre: `Usuario ${uid}` }
          const data = await res.json() as { email?: string; full_name?: string }
          return { email: data.email ?? `usuario${uid}@zymo.com`, nombre: data.full_name ?? `Usuario ${uid}` }
        } catch {
          return { email: `usuario${uid}@zymo.com`, nombre: `Usuario ${uid}` }
        }
      })
    )

    const team = await prisma.team.findFirst({ where: { id: input.teamId }, select: { name: true } })

    await webhookService.sendWebhook({
      type: "evento_creado",
      titulo: trimmed,
      descripcion: input.descripcion,
      fecha: input.fecha,
      horaInicio: input.horaInicio,
      duracionMinutos: duracion,
      modalidad: input.modalidad ?? null,
      sede: input.sede ?? null,
      organizadorNombre: user.full_name ?? `Usuario ${userId}`,
      equipo: team?.name ?? "Equipo",
      participantes: participantesInfo,
    } satisfies webhookService.EventoCreadoPayload)
  })().catch((e) => console.error("[webhook] evento_creado failed:", e))

  return created
}

// ─── List events ──────────────────────────────────────────────────────────────

export async function listEvents(
  user: AuthPayload,
  teamId: number,
  fecha?: string,
) {
  const userId = getUserId(user)
  const managedTeams = await getManagedTeamIds(user)
  const isManager = isAdmin(user) || managedTeams.includes(teamId)

  const where: Record<string, unknown> = { teamId }
  if (fecha) where["fecha"] = new Date(fecha)

  if (!isManager) {
    where["participants"] = { some: { userId } }
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    include: { participants: true },
  })

  // Enrich participant names best-effort (fixes stored "Usuario N" placeholders)
  if (events.length > 0) {
    const allParticipantIds = Array.from(new Set(events.flatMap((e) => e.participants.map((p) => p.userId))))
    const nameMap = await enrichUserNames(allParticipantIds)
    if (nameMap.size > 0) {
      for (const event of events) {
        for (const p of event.participants) {
          const enriched = nameMap.get(p.userId)
          if (enriched) p.userNombre = enriched
        }
      }
    }
  }

  return events
}

// ─── Update event ─────────────────────────────────────────────────────────────

export interface UpdateEventInput {
  titulo?: string
  descripcion?: string | null
  plataforma?: string | null
  prioridad?: string | null
  modalidad?: string | null
  sede?: string | null
  horaInicio?: string
  duracionMinutos?: number
}

export async function updateEvent(
  eventId: number,
  user: AuthPayload,
  input: UpdateEventInput,
) {
  const userId = getUserId(user)

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: { participants: { select: { userId: true } } },
  })
  if (!event) throw new AppError(404, "Evento no encontrado")

  // Only owner, manager, or co_gestor can edit
  const managedTeams = await getManagedTeamIds(user)
  const canEdit = isAdmin(user) || managedTeams.includes(event.teamId) || event.ownerUserId === userId
  if (!canEdit) throw new AppError(403, "No tienes permisos para editar este evento")

  const newHoraInicio = input.horaInicio ?? event.horaInicio
  const newDuracion = input.duracionMinutos ?? event.duracionMinutos
  const participantIds = event.participants.map((p) => p.userId)

  const conflicts = await detectConflicts(
    eventId,
    event.teamId,
    event.fecha.toISOString().slice(0, 10),
    newHoraInicio,
    newDuracion,
    participantIds,
  )

  // Update participant conflict flags
  const participantUpdates = event.participants.map((p) =>
    prisma.eventParticipant.updateMany({
      where: { eventId, userId: p.userId },
      data: {
        hasConflict: conflicts.has(p.userId),
        conflictDetail: conflicts.get(p.userId) ?? null,
      },
    }),
  )

  const [updatedEvent] = await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: {
        titulo: input.titulo?.trim() ?? event.titulo,
        descripcion: input.descripcion !== undefined ? input.descripcion : event.descripcion,
        plataforma: input.plataforma !== undefined ? input.plataforma : event.plataforma,
        prioridad: input.prioridad !== undefined ? input.prioridad : event.prioridad,
        modalidad: input.modalidad !== undefined ? input.modalidad : event.modalidad,
        sede: input.sede !== undefined ? input.sede : event.sede,
        horaInicio: newHoraInicio,
        duracionMinutos: newDuracion,
      },
      include: { participants: true },
    }),
    ...participantUpdates,
  ])

  return updatedEvent
}

// ─── Delete event ─────────────────────────────────────────────────────────────

export async function deleteEvent(eventId: number, user: AuthPayload): Promise<void> {
  const userId = getUserId(user)

  const event = await prisma.event.findFirst({ where: { id: eventId } })
  if (!event) throw new AppError(404, "Evento no encontrado")

  const managedTeams = await getManagedTeamIds(user)
  const canDelete = isAdmin(user) || managedTeams.includes(event.teamId) || event.ownerUserId === userId
  if (!canDelete) throw new AppError(403, "No tienes permisos para eliminar este evento")

  await prisma.event.delete({ where: { id: eventId } })
}

// ─── Update participants ──────────────────────────────────────────────────────

export async function updateParticipants(
  eventId: number,
  user: AuthPayload,
  add: number[],
  remove: number[],
) {
  const userId = getUserId(user)

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    include: { participants: { select: { userId: true } } },
  })
  if (!event) throw new AppError(404, "Evento no encontrado")

  const managedTeams = await getManagedTeamIds(user)
  const canEdit = isAdmin(user) || managedTeams.includes(event.teamId) || event.ownerUserId === userId
  if (!canEdit) throw new AppError(403, "No tienes permisos para modificar participantes")

  // Remove
  if (remove.length > 0) {
    await prisma.eventParticipant.deleteMany({
      where: { eventId, userId: { in: remove } },
    })
  }

  // Add new participants
  const existing = new Set(event.participants.map((p) => p.userId))
  const toAdd = add.filter((id) => !existing.has(id))

  if (toAdd.length > 0) {
    const currentParticipantIds = [
      ...event.participants.map((p) => p.userId).filter((id) => !remove.includes(id)),
      ...toAdd,
    ]
    const conflicts = await detectConflicts(
      eventId,
      event.teamId,
      event.fecha.toISOString().slice(0, 10),
      event.horaInicio,
      event.duracionMinutos,
      currentParticipantIds,
    )

    const nameMap = await enrichUserNames(toAdd)

    await prisma.eventParticipant.createMany({
      data: toAdd.map((uid) => ({
        eventId,
        userId: uid,
        userNombre: uid === userId ? (user.full_name ?? `Usuario ${uid}`) : (nameMap.get(uid) ?? `Usuario ${uid}`),
        hasConflict: conflicts.has(uid),
        conflictDetail: conflicts.get(uid) ?? null,
        confirmado: false,
      })),
      skipDuplicates: true,
    })
  }

  return prisma.event.findFirst({
    where: { id: eventId },
    include: { participants: true },
  })
}

// ─── Confirm attendance ───────────────────────────────────────────────────────

export async function confirmAttendance(eventId: number, user: AuthPayload): Promise<void> {
  const userId = getUserId(user)

  const participant = await prisma.eventParticipant.findFirst({
    where: { eventId, userId },
  })
  if (!participant) throw new AppError(404, "No eres participante de este evento")

  await prisma.eventParticipant.update({
    where: { id: participant.id },
    data: { confirmado: true },
  })
}
