import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload, getUserId, isAdmin } from "../middleware/auth"
import { validateTitle } from "../utils/validators"
import { PaginationParams } from "../utils/pagination"
import { validateTransition, getFinalState, StateConfig } from "./stateMachine"
import { getMemberTeamIds, getManagedTeamIds, requireMembership } from "../utils/permissions"
import { Prisma, type TaskAcceptanceStatus, type ActivityAction } from "@prisma/client"
import * as emailService from "./emailService"
import * as webhookService from "./webhookService"
import { resolveUserName, resolveActorName, enrichUserNames } from "../utils/userNames"

export interface CreateTaskInput {
  teamId: number
  titulo: string
  descripcionTecnica?: string
  etiqueta: string
  plataforma: string
  estado?: string
  prioridad?: string
  fecha: string
  asignadoAId?: number
  asignadoANombre?: string
  impacto?: string
  modalidad?: string
  horaInicio?: string | null
  horaCierre?: string | null
  duracionEstimadaMinutos?: number | null
}

export interface UpdateTaskInput {
  titulo?: string
  descripcionTecnica?: string | null
  descripcionGerencial?: string | null
  impacto?: string | null
  etiqueta?: string
  plataforma?: string
  estado?: string
  prioridad?: string
  fecha?: string
  asignadoAId?: number | null
  asignadoANombre?: string | null
  modalidad?: string | null
  horaInicio?: string | null
  horaCierre?: string | null
  duracionEstimadaMinutos?: number | null
  version: number
}

export interface TaskFilters {
  teamId?: number
  search?: string
  estado?: string
  etiqueta?: string
  plataforma?: string
  fechaDesde?: string
  fechaHasta?: string
  responsableId?: number
  subidoPorId?: number
  prioridad?: string
  soloSinAsignar?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getStateConfigs(teamId: number): Promise<StateConfig[]> {
  const rows = await prisma.listConfig.findMany({
    where: { teamId, listType: "estado", isActive: true },
    select: { value: true, isFinal: true, isCanceled: true, isInitialAssignment: true },
    orderBy: { sortOrder: "asc" },
  })
  return rows
}

async function getUserRoleInTeam(
  userId: number,
  teamId: number,
): Promise<"owner" | "co_gestor" | "member"> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, isActive: true },
    select: { ownerUserId: true },
  })
  if (!team) throw new AppError(404, "Equipo no encontrado")
  if (team.ownerUserId === userId) return "owner"

  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId, isActive: true },
    select: { role: true },
  })
  if (!member) throw new AppError(403, "No perteneces a este equipo")
  return member.role as "co_gestor" | "member"
}

async function validateListValue(teamId: number, listType: string, value: string): Promise<void> {
  const exists = await prisma.listConfig.findFirst({
    where: { teamId, listType: listType as "estado" | "etiqueta" | "plataforma" | "modalidad" | "prioridad" | "prioridad_agenda", value, isActive: true },
  })
  if (!exists) throw new AppError(422, `Valor inválido para ${listType}: ${value}`)
}

async function logActivity(
  taskId: number,
  userId: number,
  userNombre: string,
  accion: ActivityAction,
  detalle?: string,
  campos?: Record<string, { old: unknown; new: unknown }>,
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      taskId,
      userId,
      userNombre,
      accion,
      detalle: detalle ?? null,
      campos: campos ? (campos as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  })
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createTask(
  user: AuthPayload,
  input: CreateTaskInput,
): Promise<ReturnType<typeof getTask>> {
  const userId = getUserId(user)
  await requireMembership(user, input.teamId)
  const titulo = validateTitle(input.titulo)

  // Validate etiqueta / plataforma exist in this team
  await validateListValue(input.teamId, "etiqueta", input.etiqueta)
  await validateListValue(input.teamId, "plataforma", input.plataforma)

  // Resolve initial state
  const stateConfigs = await getStateConfigs(input.teamId)
  const estado = input.estado ?? (stateConfigs[0]?.value ?? "pendiente")
  if (input.estado) await validateListValue(input.teamId, "estado", input.estado)

  // Validate assignee belongs to team (if provided)
  if (input.asignadoAId) {
    const team = await prisma.team.findFirst({
      where: { id: input.teamId, isActive: true },
      select: { ownerUserId: true },
    })
    if (!team) throw new AppError(404, "Equipo no encontrado")
    const isOwner = team.ownerUserId === input.asignadoAId
    const isMember = isOwner || !!(await prisma.teamMember.findFirst({
      where: { teamId: input.teamId, userId: input.asignadoAId, isActive: true },
    }))
    if (!isMember) throw new AppError(422, "El usuario asignado no pertenece al equipo")
  }

  const actorNombre = await resolveActorName(userId, user.full_name)

  // Auto-asignar al creador si no hay asignado explícito
  const resolvedAsignadoId = input.asignadoAId ?? userId
  let resolvedAsignadoNombre: string | null
  if (!input.asignadoAId) {
    resolvedAsignadoNombre = actorNombre
  } else if (input.asignadoANombre) {
    resolvedAsignadoNombre = input.asignadoANombre
  } else {
    resolvedAsignadoNombre = await resolveUserName(input.asignadoAId) ?? `Usuario ${input.asignadoAId}`
  }

  const aceptacion: TaskAcceptanceStatus =
    resolvedAsignadoId !== userId ? "pendiente" : "aceptada"

  const task = await prisma.task.create({
    data: {
      teamId: input.teamId,
      subidoPorId: userId,
      subidoPorNombre: actorNombre,
      asignadoAId: resolvedAsignadoId,
      asignadoANombre: resolvedAsignadoNombre,
      titulo,
      descripcionTecnica: input.descripcionTecnica ?? null,
      etiqueta: input.etiqueta,
      plataforma: input.plataforma,
      estado,
      prioridad: input.prioridad ?? "media",
      fecha: new Date(input.fecha),
      impacto: input.impacto ?? null,
      modalidad: input.modalidad ?? null,
      horaInicio: input.horaInicio ? new Date(input.horaInicio) : null,
      horaCierre: input.horaCierre ? new Date(input.horaCierre) : null,
      tiempoTotalMinutos: (() => {
        if (!input.horaInicio || !input.horaCierre) return null
        const diff = new Date(input.horaCierre).getTime() - new Date(input.horaInicio).getTime()
        return diff > 0 ? Math.round(diff / 60000) : null
      })(),
      duracionEstimadaMinutos: input.duracionEstimadaMinutos ?? null,
      aceptacion,
      version: 1,
    },
  })

  await logActivity(task.id, userId, actorNombre, "creacion", titulo)

  // Fire-and-forget: notificar al asignado si es diferente al creador
  if (task.asignadoAId && task.asignadoAId !== userId) {
    const team = await prisma.team.findFirst({ where: { id: task.teamId }, select: { name: true } })
    const teamNombre = team?.name ?? "Equipo"
    void emailService.notifyTaskAssigned(
      task.asignadoAId,
      userId,
      actorNombre,
      task.titulo,
      task.fecha,
      task.prioridad,
      teamNombre,
    ).catch((e) => console.error("[email] notifyTaskAssigned failed:", e))

    void webhookService.sendWebhook({
      type: "tarea_asignada",
      titulo: task.titulo,
      descripcion: task.descripcionTecnica ?? undefined,
      fecha: task.fecha.toISOString().split("T")[0],
      horaInicio: task.horaInicio?.toISOString() ?? undefined,
      horaCierre: task.horaCierre?.toISOString() ?? undefined,
      duracionEstimadaMinutos: task.duracionEstimadaMinutos,
      asignadoNombre: task.asignadoANombre ?? `Usuario ${task.asignadoAId}`,
      asignadoPorNombre: actorNombre,
      equipo: teamNombre,
      prioridad: task.prioridad,
      urlTarea: "https://zymointranet.com/herramientas/tareas",
    } satisfies webhookService.TareaAsignadaPayload).catch((e) => console.error("[webhook] tarea_asignada failed:", e))
  }

  return getTask(task.id, user)
}

export async function updateTask(
  taskId: number,
  user: AuthPayload,
  input: UpdateTaskInput,
): Promise<ReturnType<typeof getTask>> {
  const userId = getUserId(user)
  const actorNombre = await resolveActorName(userId, user.full_name)

  const current = await prisma.task.findFirst({ where: { id: taskId } })
  if (!current) throw new AppError(404, "Tarea no encontrada")

  // Membership check
  const memberTeams = isAdmin(user) ? null : await getMemberTeamIds(user)
  if (memberTeams && !memberTeams.includes(current.teamId)) {
    throw new AppError(403, "No tienes acceso a esta tarea")
  }

  // Optimistic locking
  if (input.version !== current.version) {
    throw new AppError(409, "Conflicto de versión: la tarea fue modificada por otra sesión")
  }

  const userRole = isAdmin(user) ? "owner" : await getUserRoleInTeam(userId, current.teamId)

  const campos: Record<string, { old: unknown; new: unknown }> = {}
  const data: Record<string, unknown> = {}

  // Build diff and data
  if (input.titulo !== undefined) {
    const trimmed = validateTitle(input.titulo)
    if (trimmed !== current.titulo) {
      campos["titulo"] = { old: current.titulo, new: trimmed }
      data["titulo"] = trimmed
    }
  }

  if (input.descripcionTecnica !== undefined && input.descripcionTecnica !== current.descripcionTecnica) {
    campos["descripcionTecnica"] = { old: current.descripcionTecnica, new: input.descripcionTecnica }
    data["descripcionTecnica"] = input.descripcionTecnica
  }

  if (input.descripcionGerencial !== undefined && input.descripcionGerencial !== current.descripcionGerencial) {
    campos["descripcionGerencial"] = { old: current.descripcionGerencial, new: input.descripcionGerencial }
    data["descripcionGerencial"] = input.descripcionGerencial
  }

  if (input.impacto !== undefined && input.impacto !== current.impacto) {
    campos["impacto"] = { old: current.impacto, new: input.impacto }
    data["impacto"] = input.impacto
  }

  if (input.etiqueta !== undefined && input.etiqueta !== current.etiqueta) {
    await validateListValue(current.teamId, "etiqueta", input.etiqueta)
    campos["etiqueta"] = { old: current.etiqueta, new: input.etiqueta }
    data["etiqueta"] = input.etiqueta
  }

  if (input.plataforma !== undefined && input.plataforma !== current.plataforma) {
    await validateListValue(current.teamId, "plataforma", input.plataforma)
    campos["plataforma"] = { old: current.plataforma, new: input.plataforma }
    data["plataforma"] = input.plataforma
  }

  if (input.estado !== undefined && input.estado !== current.estado) {
    const stateConfigs = await getStateConfigs(current.teamId)
    validateTransition(current.estado, input.estado, stateConfigs, userRole)
    campos["estado"] = { old: current.estado, new: input.estado }
    data["estado"] = input.estado

    // Auto-close hora_cierre when reaching a final state
    const finalState = getFinalState(stateConfigs)
    if (finalState === input.estado && !current.horaCierre) {
      data["horaCierre"] = new Date()
    }
  }

  if (input.prioridad !== undefined && input.prioridad !== current.prioridad) {
    campos["prioridad"] = { old: current.prioridad, new: input.prioridad }
    data["prioridad"] = input.prioridad
  }

  if (input.fecha !== undefined) {
    const newFecha = new Date(input.fecha)
    if (newFecha.getTime() !== current.fecha.getTime()) {
      campos["fecha"] = { old: current.fecha, new: newFecha }
      data["fecha"] = newFecha
    }
  }

  if (input.asignadoAId !== undefined && input.asignadoAId !== current.asignadoAId) {
    if (input.asignadoAId !== null) {
      const team = await prisma.team.findFirst({
        where: { id: current.teamId, isActive: true },
        select: { ownerUserId: true },
      })
      const isOwner = team?.ownerUserId === input.asignadoAId
      const isMember = isOwner || !!(await prisma.teamMember.findFirst({
        where: { teamId: current.teamId, userId: input.asignadoAId, isActive: true },
      }))
      if (!isMember) throw new AppError(422, "El usuario asignado no pertenece al equipo")
    }
    campos["asignadoAId"] = { old: current.asignadoAId, new: input.asignadoAId }
    data["asignadoAId"] = input.asignadoAId
    if (input.asignadoAId === null) {
      data["asignadoANombre"] = null
    } else if (input.asignadoANombre) {
      data["asignadoANombre"] = input.asignadoANombre
    } else {
      data["asignadoANombre"] = await resolveUserName(input.asignadoAId) ?? `Usuario ${input.asignadoAId}`
    }
    if (input.asignadoAId && input.asignadoAId !== userId) {
      data["aceptacion"] = "pendiente"
    }
  }

  if (input.modalidad !== undefined && input.modalidad !== current.modalidad) {
    campos["modalidad"] = { old: current.modalidad, new: input.modalidad }
    data["modalidad"] = input.modalidad
  }

  if (input.duracionEstimadaMinutos !== undefined) {
    data["duracionEstimadaMinutos"] = input.duracionEstimadaMinutos
  }

  if (input.horaInicio !== undefined) {
    const val = input.horaInicio ? new Date(input.horaInicio) : null
    campos["horaInicio"] = { old: current.horaInicio, new: val }
    data["horaInicio"] = val
  }

  if (input.horaCierre !== undefined) {
    const val = input.horaCierre ? new Date(input.horaCierre) : null
    campos["horaCierre"] = { old: current.horaCierre, new: val }
    data["horaCierre"] = val

    // Recalculate tiempoTotalMinutos whenever horaCierre changes
    const inicio = (data["horaInicio"] as Date | null | undefined) ?? current.horaInicio
    if (val && inicio) {
      const diffMs = val.getTime() - new Date(inicio).getTime()
      if (diffMs > 0) data["tiempoTotalMinutos"] = Math.round(diffMs / 60000)
    } else {
      data["tiempoTotalMinutos"] = null
    }
  }

  // Also recalculate if horaInicio changed and horaCierre already exists
  if (input.horaInicio !== undefined && data["horaCierre"] === undefined) {
    const cierre = current.horaCierre
    const nuevoInicio = data["horaInicio"] as Date | null | undefined
    if (cierre && nuevoInicio) {
      const diffMs = new Date(cierre).getTime() - nuevoInicio.getTime()
      if (diffMs > 0) data["tiempoTotalMinutos"] = Math.round(diffMs / 60000)
    }
  }

  if (Object.keys(data).length === 0) return getTask(taskId, user)

  data["version"] = { increment: 1 }

  await prisma.task.update({ where: { id: taskId }, data })

  const accion = input.estado ? "cambio_estado" : "edicion"
  await logActivity(
    taskId,
    userId,
    actorNombre,
    accion,
    undefined,
    Object.keys(campos).length > 0 ? campos : undefined,
  )

  return getTask(taskId, user)
}

export async function deleteTask(taskId: number, user: AuthPayload): Promise<void> {
  const userId = getUserId(user)

  const task = await prisma.task.findFirst({ where: { id: taskId } })
  if (!task) throw new AppError(404, "Tarea no encontrada")

  if (!isAdmin(user)) {
    const managedTeams = await getManagedTeamIds(user)
    if (!managedTeams.includes(task.teamId)) {
      throw new AppError(403, "Solo gestores del equipo pueden eliminar tareas")
    }
  }

  await prisma.task.delete({ where: { id: taskId } })

  const actorNombre = await resolveActorName(userId, user.full_name)
  await logActivity(taskId, userId, actorNombre, "eliminacion", task.titulo)
}

export async function getTask(taskId: number, user: AuthPayload) {
  const memberTeams = isAdmin(user) ? null : await getMemberTeamIds(user)

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...(memberTeams ? { teamId: { in: memberTeams } } : {}),
    },
    include: {
      attachments: { orderBy: { uploadedAt: "asc" } },
      activityLogs: { orderBy: { fecha: "desc" }, take: 1 },
    },
  })

  if (!task) throw new AppError(404, "Tarea no encontrada")

  const nameMap = await enrichUserNames([task.subidoPorId, task.asignadoAId].filter((id): id is number => id != null))
  const subidoNombre = nameMap.get(task.subidoPorId)
  if (subidoNombre) task.subidoPorNombre = subidoNombre
  if (task.asignadoAId != null) {
    const asignadoNombre = nameMap.get(task.asignadoAId)
    if (asignadoNombre) task.asignadoANombre = asignadoNombre
  }

  return task
}

export async function listTasks(
  user: AuthPayload,
  filters: TaskFilters,
  pagination: PaginationParams,
) {
  const memberTeams = isAdmin(user) ? null : await getMemberTeamIds(user)

  const where: Record<string, unknown> = {}

  if (memberTeams) {
    const allowedTeams = filters.teamId
      ? memberTeams.filter((id) => id === filters.teamId)
      : memberTeams
    where["teamId"] = { in: allowedTeams }
  } else if (filters.teamId) {
    where["teamId"] = filters.teamId
  }

  const andClauses: Record<string, unknown>[] = []

  if (filters.search) {
    andClauses.push({
      OR: [
        { titulo: { contains: filters.search, mode: "insensitive" } },
        { descripcionTecnica: { contains: filters.search, mode: "insensitive" } },
      ],
    })
  }

  if (filters.estado) where["estado"] = filters.estado
  if (filters.etiqueta) where["etiqueta"] = filters.etiqueta
  if (filters.plataforma) where["plataforma"] = filters.plataforma
  if (filters.prioridad) where["prioridad"] = filters.prioridad
  if (filters.responsableId) {
    andClauses.push({
      OR: [
        { asignadoAId: filters.responsableId },
        { asignadoAId: null, subidoPorId: filters.responsableId },
      ],
    })
  }
  if (filters.subidoPorId) where["subidoPorId"] = filters.subidoPorId
  if (filters.soloSinAsignar) where["asignadoAId"] = null

  if (andClauses.length > 0) where["AND"] = andClauses

  if (filters.fechaDesde || filters.fechaHasta) {
    const dateFilter: Record<string, Date> = {}
    if (filters.fechaDesde) dateFilter["gte"] = new Date(filters.fechaDesde)
    if (filters.fechaHasta) dateFilter["lte"] = new Date(filters.fechaHasta)
    where["fecha"] = dateFilter
  }

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      include: {
        attachments: { select: { id: true, filename: true, mimeType: true } },
      },
    }),
  ])

  // Enrich subidoPor/asignadoA names best-effort (fixes stored "Usuario N" placeholders
  // — el JWT no trae full_name, así que estos nombres pueden haber quedado mal
  // guardados al crear/asignar la tarea).
  const userIds = Array.from(
    new Set(tasks.flatMap((t) => [t.subidoPorId, t.asignadoAId]).filter((id): id is number => id != null)),
  )
  if (userIds.length > 0) {
    const nameMap = await enrichUserNames(userIds)
    if (nameMap.size > 0) {
      for (const t of tasks) {
        const subidoNombre = nameMap.get(t.subidoPorId)
        if (subidoNombre) t.subidoPorNombre = subidoNombre
        if (t.asignadoAId != null) {
          const asignadoNombre = nameMap.get(t.asignadoAId)
          if (asignadoNombre) t.asignadoANombre = asignadoNombre
        }
      }
    }
  }

  return { total, tasks }
}

export async function getTaskHistory(taskId: number, user: AuthPayload) {
  const memberTeams = isAdmin(user) ? null : await getMemberTeamIds(user)

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...(memberTeams ? { teamId: { in: memberTeams } } : {}),
    },
    select: { id: true },
  })
  if (!task) throw new AppError(404, "Tarea no encontrada")

  return prisma.activityLog.findMany({
    where: { taskId },
    orderBy: { fecha: "desc" },
  })
}

export async function acceptOrRejectTask(
  taskId: number,
  user: AuthPayload,
  aceptacion: "aceptada" | "rechazada",
): Promise<void> {
  const userId = getUserId(user)
  const actorNombre = await resolveActorName(userId, user.full_name)

  const task = await prisma.task.findFirst({ where: { id: taskId } })
  if (!task) throw new AppError(404, "Tarea no encontrada")
  if (task.asignadoAId !== userId) {
    throw new AppError(403, "Solo el usuario asignado puede aceptar o rechazar la tarea")
  }
  await requireMembership(user, task.teamId)
  if (task.aceptacion !== "pendiente") {
    throw new AppError(422, "La tarea ya fue aceptada o rechazada")
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      aceptacion: aceptacion as TaskAcceptanceStatus,
      version: { increment: 1 },
    },
  })

  await logActivity(
    taskId,
    userId,
    actorNombre,
    "edicion",
    `Tarea ${aceptacion}`,
    { aceptacion: { old: "pendiente", new: aceptacion } },
  )

  // Fire-and-forget: notificar al creador de la tarea
  void emailService.notifyTaskResponse(
    task.subidoPorId,
    actorNombre,
    task.titulo,
    task.fecha,
    aceptacion,
  ).catch((e) => console.error("[email] notifyTaskResponse failed:", e))
}
