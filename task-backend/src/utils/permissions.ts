import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { isAdmin, AuthPayload } from "../middleware/auth"

/**
 * Returns true if userId is owner or co_gestor of teamId, or is admin.
 * Throws 403 if not.
 */
export async function requireManageAccess(
  user: AuthPayload,
  teamId: number,
): Promise<void> {
  if (isAdmin(user)) return

  const userId = Number(user.sub ?? user.id)

  const team = await prisma.team.findFirst({
    where: { id: teamId, isActive: true },
    select: { ownerUserId: true },
  })

  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (team.ownerUserId === userId) return

  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId, isActive: true, role: "co_gestor" },
  })

  if (!member) throw new AppError(403, "No tienes permisos de gestión en este equipo")
}

/**
 * Returns true if userId is an active member (any role) of teamId.
 * Throws 403 if not.
 */
export async function requireMembership(
  user: AuthPayload,
  teamId: number,
): Promise<void> {
  if (isAdmin(user)) return

  const userId = Number(user.sub ?? user.id)

  const team = await prisma.team.findFirst({
    where: { id: teamId, isActive: true },
    select: { ownerUserId: true },
  })

  if (!team) throw new AppError(404, "Equipo no encontrado")

  if (team.ownerUserId === userId) return

  const member = await prisma.teamMember.findFirst({
    where: { teamId, userId, isActive: true },
  })

  if (!member) throw new AppError(403, "No perteneces a este equipo")
}

/**
 * Returns true if user is owner of the team (not just co_gestor).
 */
export async function requireOwner(
  user: AuthPayload,
  teamId: number,
): Promise<void> {
  if (isAdmin(user)) return

  const userId = Number(user.sub ?? user.id)

  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerUserId: userId, isActive: true },
  })

  if (!team) throw new AppError(403, "Solo el dueño del equipo puede realizar esta acción")
}

/**
 * Returns the team IDs the user can manage (owner + co_gestor).
 */
export async function getManagedTeamIds(user: AuthPayload): Promise<number[]> {
  const userId = Number(user.sub ?? user.id)

  if (isAdmin(user)) {
    const teams = await prisma.team.findMany({ where: { isActive: true }, select: { id: true } })
    return teams.map((t) => t.id)
  }

  const ownedTeams = await prisma.team.findMany({
    where: { ownerUserId: userId, isActive: true },
    select: { id: true },
  })

  const coGestorTeams = await prisma.teamMember.findMany({
    where: { userId, isActive: true, role: "co_gestor" },
    select: { teamId: true },
  })

  const ids = new Set([
    ...ownedTeams.map((t) => t.id),
    ...coGestorTeams.map((m) => m.teamId),
  ])

  return Array.from(ids)
}

/**
 * Returns the team IDs where user is any active member.
 */
export async function getMemberTeamIds(user: AuthPayload): Promise<number[]> {
  const userId = Number(user.sub ?? user.id)

  if (isAdmin(user)) {
    const teams = await prisma.team.findMany({ where: { isActive: true }, select: { id: true } })
    return teams.map((t) => t.id)
  }

  const ownedTeams = await prisma.team.findMany({
    where: { ownerUserId: userId, isActive: true },
    select: { id: true },
  })

  const memberTeams = await prisma.teamMember.findMany({
    where: { userId, isActive: true },
    select: { teamId: true },
  })

  const ids = new Set([
    ...ownedTeams.map((t) => t.id),
    ...memberTeams.map((m) => m.teamId),
  ])

  return Array.from(ids)
}
