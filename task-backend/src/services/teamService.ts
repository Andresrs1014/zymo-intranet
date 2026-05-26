import axios from "axios"
import prisma from "../config/prisma"
import { env } from "../config/env"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload, getUserId, isAdmin } from "../middleware/auth"

export interface TeamWithRole {
  id: number
  name: string
  ownerUserId: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  myRole: "owner" | "co_gestor" | "member"
  memberCount: number
}

export interface TeamMemberView {
  id: number
  userId: number
  userNombre: string | null
  role: string
  isActive: boolean
  createdAt: Date
}

/** Soft-deletes a team. Only the owner can do this. */
export async function deleteTeam(user: AuthPayload, teamId: number): Promise<void> {
  const userId = getUserId(user)
  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")
  if (!isAdmin(user) && team.ownerUserId !== userId) {
    throw new AppError(403, "Solo el dueño puede eliminar el espacio de trabajo")
  }
  await prisma.team.update({ where: { id: teamId }, data: { isActive: false } })
}

/** Returns all teams where the user is an active member or owner */
export async function getMyTeams(user: AuthPayload, token?: string): Promise<TeamWithRole[]> {
  const userId = getUserId(user)

  let ownedTeams = await prisma.team.findMany({
    where: { ownerUserId: userId, isActive: true },
    include: { _count: { select: { members: { where: { isActive: true } } } } },
  })

  if (ownedTeams.length === 0 && token) {
    try {
      const response = await axios.get<{ user_tools?: string[] }>(
        `${env.INTRANET_API_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const tools = response.data?.user_tools ?? []
      if (tools.includes("tool_task_manage_dev")) {
        const newTeamId = await getOrCreateTeam(user)
        ownedTeams = await prisma.team.findMany({
          where: { id: newTeamId, isActive: true },
          include: { _count: { select: { members: { where: { isActive: true } } } } },
        })
      }
    } catch (err) {
      console.error("Error auto-creating team for user:", err)
    }
  }

  const memberRows = await prisma.teamMember.findMany({
    where: { userId, isActive: true },
    include: {
      team: {
        include: { _count: { select: { members: { where: { isActive: true } } } } },
      },
    },
  })

  const result: TeamWithRole[] = []
  const seen = new Set<number>()

  for (const t of ownedTeams) {
    seen.add(t.id)
    result.push({
      id: t.id,
      name: t.name,
      ownerUserId: t.ownerUserId,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      myRole: "owner",
      memberCount: t._count.members,
    })
  }

  for (const m of memberRows) {
    if (seen.has(m.teamId)) continue
    seen.add(m.teamId)
    const t = m.team
    result.push({
      id: t.id,
      name: t.name,
      ownerUserId: t.ownerUserId,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      myRole: m.role as "co_gestor" | "member",
      memberCount: t._count.members,
    })
  }

  return result
}

/** Returns teams where user can manage (owner or co_gestor) */
export async function getManagedTeams(user: AuthPayload, token?: string): Promise<TeamWithRole[]> {
  const all = await getMyTeams(user, token)
  if (isAdmin(user)) return all
  return all.filter((t) => t.myRole === "owner" || t.myRole === "co_gestor")
}

/** Create a new team owned by the requesting user */
export async function createTeam(user: AuthPayload, name: string, token: string): Promise<TeamWithRole> {
  const userId = getUserId(user)

  if (!isAdmin(user)) {
    try {
      const response = await axios.get<{ user_tools?: string[] }>(
        `${env.INTRANET_API_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const tools = response.data?.user_tools ?? []
      if (!tools.includes("tool_task_manage_dev")) {
        throw new AppError(403, "No tienes permiso para crear equipos (se requiere el rol de gestor)")
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw new AppError(403, "Error al verificar permisos del usuario en la intranet: " + (err.message ?? err))
    }
  }

  const trimmed = name.trim()
  if (trimmed.length < 3) throw new AppError(422, "El nombre debe tener al menos 3 caracteres")
  if (trimmed.length > 120) throw new AppError(422, "El nombre no puede superar 120 caracteres")

  const team = await prisma.team.create({
    data: { name: trimmed, ownerUserId: userId },
    include: { _count: { select: { members: { where: { isActive: true } } } } },
  })

  return {
    id: team.id,
    name: team.name,
    ownerUserId: team.ownerUserId,
    isActive: team.isActive,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    myRole: "owner",
    memberCount: team._count.members,
  }
}

/** Rename a team (owner only) */
export async function renameTeam(
  user: AuthPayload,
  teamId: number,
  name: string,
): Promise<{ id: number; name: string }> {
  const userId = getUserId(user)
  const trimmed = name.trim()
  if (trimmed.length < 3) throw new AppError(422, "El nombre debe tener al menos 3 caracteres")
  if (trimmed.length > 120) throw new AppError(422, "El nombre no puede superar 120 caracteres")

  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (!isAdmin(user) && team.ownerUserId !== userId) {
    throw new AppError(403, "Solo el dueño del equipo puede renombrarlo")
  }

  const updated = await prisma.team.update({ where: { id: teamId }, data: { name: trimmed } })
  return { id: updated.id, name: updated.name }
}

/** List active members of a team */
export async function getTeamMembers(teamId: number): Promise<TeamMemberView[]> {
  const rows = await prisma.teamMember.findMany({
    where: { teamId, isActive: true },
    orderBy: { createdAt: "asc" },
  })
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userNombre: r.userNombre ?? null,
    role: r.role,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }))
}

/** Get users from the intranet FastAPI that are NOT already in the team */
export async function getAvailableUsers(
  teamId: number,
  token: string,
): Promise<{ id: number; full_name: string | null; email: string }[]> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, isActive: true },
    select: { ownerUserId: true },
  })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  const existingMembers = await prisma.teamMember.findMany({
    where: { teamId, isActive: true },
    select: { userId: true },
  })
  const memberIds = new Set([
    team.ownerUserId,
    ...existingMembers.map((m) => m.userId),
  ])

  const response = await axios.get<{ id: number; full_name: string | null; email: string }[]>(
    `${env.INTRANET_API_URL}/api/tasks-v2/users`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  const users = Array.isArray(response.data) ? response.data : []

  return users.filter((u) => !memberIds.has(u.id))
}

/** Add a member to the team */
export async function addMember(
  user: AuthPayload,
  teamId: number,
  userId: number,
  userNombre?: string,
  token?: string,
): Promise<TeamMemberView> {
  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (team.ownerUserId === userId) {
    throw new AppError(422, "El dueño del equipo ya pertenece a él")
  }

  const existing = await prisma.teamMember.findFirst({ where: { teamId, userId } })
  if (existing) {
    if (existing.isActive) throw new AppError(422, "El usuario ya es miembro del equipo")
    const reactivated = await prisma.teamMember.update({
      where: { id: existing.id },
      data: { isActive: true, role: "member", ...(userNombre ? { userNombre } : {}) },
    })
    return {
      id: reactivated.id,
      userId: reactivated.userId,
      userNombre: reactivated.userNombre ?? null,
      role: reactivated.role,
      isActive: reactivated.isActive,
      createdAt: reactivated.createdAt,
    }
  }

  const member = await prisma.teamMember.create({
    data: { teamId, userId, role: "member", userNombre: userNombre ?? null },
  })

  // Auto-activate tool_task_submit so the new member can use the task system
  if (token) {
    try {
      await axios.post(
        `${env.INTRANET_API_URL}/api/tasks-v2/users/${userId}/activate-submit`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
    } catch (err) {
      console.warn(`Could not auto-activate tool_task_submit for user ${userId}:`, err)
    }
  }

  return {
    id: member.id,
    userId: member.userId,
    userNombre: member.userNombre ?? null,
    role: member.role,
    isActive: member.isActive,
    createdAt: member.createdAt,
  }
}

/** Soft-delete a member from the team */
export async function removeMember(
  user: AuthPayload,
  teamId: number,
  targetUserId: number,
): Promise<void> {
  const requesterId = getUserId(user)

  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (team.ownerUserId === targetUserId) {
    throw new AppError(422, "No se puede remover al dueño del equipo")
  }

  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId: targetUserId, isActive: true },
  })
  if (!member) throw new AppError(404, "Miembro no encontrado en el equipo")

  // co_gestor can remove members; only owner can remove co_gestors
  if (!isAdmin(user) && requesterId !== team.ownerUserId) {
    if (member.role === "co_gestor") {
      throw new AppError(403, "Solo el dueño puede remover a un co-gestor")
    }
    const requesterMember = await prisma.teamMember.findFirst({
      where: { teamId, userId: requesterId, isActive: true, role: "co_gestor" },
    })
    if (!requesterMember) throw new AppError(403, "No tienes permisos de gestión en este equipo")
  }

  await prisma.teamMember.update({ where: { id: member.id }, data: { isActive: false } })
}

/** Promote a member to co_gestor (owner only) */
export async function promoteMember(
  user: AuthPayload,
  teamId: number,
  targetUserId: number,
): Promise<void> {
  const requesterId = getUserId(user)

  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (!isAdmin(user) && requesterId !== team.ownerUserId) {
    throw new AppError(403, "Solo el dueño del equipo puede promover miembros")
  }

  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId: targetUserId, isActive: true },
  })
  if (!member) throw new AppError(404, "Miembro no encontrado en el equipo")
  if (member.role === "co_gestor") throw new AppError(422, "El usuario ya es co-gestor")

  await prisma.teamMember.update({ where: { id: member.id }, data: { role: "co_gestor" } })
}

/** Demote a co_gestor to member (owner only) */
export async function demoteMember(
  user: AuthPayload,
  teamId: number,
  targetUserId: number,
): Promise<void> {
  const requesterId = getUserId(user)

  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (!isAdmin(user) && requesterId !== team.ownerUserId) {
    throw new AppError(403, "Solo el dueño del equipo puede degradar miembros")
  }

  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId: targetUserId, isActive: true },
  })
  if (!member) throw new AppError(404, "Miembro no encontrado en el equipo")
  if (member.role === "member") throw new AppError(422, "El usuario ya es miembro")

  await prisma.teamMember.update({ where: { id: member.id }, data: { role: "member" } })
}

/**
 * Auto-creates a team for a user if they have tool_task_manage permission
 * and don't own one yet. Returns the existing or newly created team id.
 */
export async function getOrCreateTeam(user: AuthPayload): Promise<number> {
  const userId = getUserId(user)

  const existing = await prisma.team.findFirst({
    where: { ownerUserId: userId, isActive: true },
    select: { id: true },
  })
  if (existing) return existing.id

  const team = await prisma.team.create({
    data: {
      name: `Equipo de ${user.full_name ?? `Usuario ${userId}`}`,
      ownerUserId: userId,
    },
    select: { id: true },
  })
  return team.id
}

/**
 * Returns all active teams in the system (for admin views)
 */
export async function getAllActiveTeams(): Promise<{ id: number; name: string; ownerUserId: number }[]> {
  return prisma.team.findMany({
    where: { isActive: true },
    select: { id: true, name: true, ownerUserId: true },
    orderBy: { name: "asc" },
  })
}

/**
 * Returns all archived (soft-deleted) teams (admin only)
 */
export async function getArchivedTeams(): Promise<{ id: number; name: string; ownerUserId: number; updatedAt: Date }[]> {
  return prisma.team.findMany({
    where: { isActive: false },
    select: { id: true, name: true, ownerUserId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  })
}

/**
 * Restores a soft-deleted team (admin only)
 */
export async function restoreTeam(teamId: number): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: false } })
  if (!team) throw new AppError(404, "Equipo archivado no encontrado")
  await prisma.team.update({ where: { id: teamId }, data: { isActive: true } })
}

/**
 * Permanently deletes a team and all related data (admin only)
 */
export async function hardDeleteTeam(teamId: number): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  await prisma.$transaction([
    prisma.activityLog.deleteMany({ where: { task: { teamId } } }),
    prisma.attachment.deleteMany({ where: { task: { teamId } } }),
    prisma.eventParticipant.deleteMany({ where: { event: { teamId } } }),
    prisma.event.deleteMany({ where: { teamId } }),
    prisma.task.deleteMany({ where: { teamId } }),
    prisma.listConfig.deleteMany({ where: { teamId } }),
    prisma.teamMember.deleteMany({ where: { teamId } }),
    prisma.team.delete({ where: { id: teamId } }),
  ])
}

/**
 * Returns teams owned by or containing the user as a member
 */
export async function getUserTeams(targetUserId: number): Promise<{ ownedTeams: { id: number; name: string }[]; memberTeams: { id: number; name: string }[] }> {
  const owned = await prisma.team.findMany({
    where: { ownerUserId: targetUserId, isActive: true },
    select: { id: true, name: true },
  })
  const memberRows = await prisma.teamMember.findMany({
    where: { userId: targetUserId, isActive: true },
    include: { team: true },
  })
  const memberTeams = memberRows
    .filter((m) => m.team.isActive)
    .map((m) => ({ id: m.team.id, name: m.team.name }))

  return { ownedTeams: owned, memberTeams }
}

/**
 * Admin: Assigns an owner to a team (or creates a new team)
 */
export async function adminAssignOwner(targetUserId: number, teamId?: number, newTeamName?: string): Promise<{ success: boolean; teamId: number }> {
  if (teamId) {
    const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
    if (!team) throw new AppError(404, "Equipo no encontrado")
    await prisma.team.update({
      where: { id: teamId },
      data: { ownerUserId: targetUserId },
    })
    return { success: true, teamId }
  } else if (newTeamName) {
    const trimmed = newTeamName.trim()
    if (trimmed.length < 3) throw new AppError(422, "El nombre debe tener al menos 3 caracteres")
    const team = await prisma.team.create({
      data: { name: trimmed, ownerUserId: targetUserId },
    })
    return { success: true, teamId: team.id }
  } else {
    throw new AppError(400, "Debe especificar un teamId existente o un newTeamName")
  }
}

/**
 * Admin: Adds a user as a member of a team
 */
export async function adminAssignMember(targetUserId: number, teamId: number): Promise<{ success: boolean }> {
  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) throw new AppError(404, "Equipo no encontrado")

  const existing = await prisma.teamMember.findFirst({
    where: { teamId, userId: targetUserId },
  })

  if (existing) {
    await prisma.teamMember.update({
      where: { id: existing.id },
      data: { isActive: true, role: "member" },
    })
  } else {
    await prisma.teamMember.create({
      data: { teamId, userId: targetUserId, role: "member" },
    })
  }
  return { success: true }
}

/**
 * Admin: Removes a user from a team
 */
export async function adminRemoveMember(targetUserId: number, teamId: number): Promise<{ success: boolean }> {
  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId: targetUserId, isActive: true },
  })
  if (member) {
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { isActive: false },
    })
  }
  return { success: true }
}
