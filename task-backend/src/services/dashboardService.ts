import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload, getUserId, isAdmin } from "../middleware/auth"
import { getManagedTeamIds, getMemberTeamIds } from "../utils/permissions"
import axios from "axios"
import { env } from "../config/env"

interface DateRange {
  desde?: string
  hasta?: string
}

function buildDateFilter(range: DateRange) {
  const filter: Record<string, Date> = {}
  if (range.desde) filter["gte"] = new Date(range.desde)
  if (range.hasta) filter["lte"] = new Date(range.hasta)
  return Object.keys(filter).length > 0 ? filter : undefined
}

async function assertManagerAccess(user: AuthPayload, teamId: number): Promise<void> {
  if (isAdmin(user)) return
  const managed = await getManagedTeamIds(user)
  if (!managed.includes(teamId)) {
    throw new AppError(403, "Solo gestores del equipo pueden ver este dashboard")
  }
}

// ─── Team KPIs ────────────────────────────────────────────────────────────────

export async function getTeamKpis(user: AuthPayload, teamId: number, range: DateRange) {
  await assertManagerAccess(user, teamId)

  const dateFilter = buildDateFilter(range)
  const where = { teamId, ...(dateFilter ? { fecha: dateFilter } : {}) }

  const [total, states, timeAgg, activeUsers] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.groupBy({
      by: ["estado"],
      where,
      _count: { id: true },
    }),
    prisma.task.aggregate({
      where: { ...where, tiempoTotalMinutos: { not: null } },
      _sum: { tiempoTotalMinutos: true },
      _avg: { tiempoTotalMinutos: true },
    }),
    prisma.task.findMany({
      where: { ...where, asignadoAId: { not: null } },
      select: { asignadoAId: true },
      distinct: ["asignadoAId"],
    }),
  ])

  const stateMap = Object.fromEntries(states.map((s) => [s.estado, s._count.id]))

  // Determine final/canceled states
  const listConfigs = await prisma.listConfig.findMany({
    where: { teamId, listType: "estado", isActive: true },
    select: { value: true, isFinal: true, isCanceled: true },
  })
  const finalStates = new Set(listConfigs.filter((s) => s.isFinal).map((s) => s.value))
  const canceledStates = new Set(listConfigs.filter((s) => s.isCanceled).map((s) => s.value))

  const completadas = Array.from(finalStates).reduce((sum, s) => sum + (stateMap[s] ?? 0), 0)
  const canceladas = Array.from(canceledStates).reduce((sum, s) => sum + (stateMap[s] ?? 0), 0)
  const enProgreso = total - completadas - canceladas

  return {
    total,
    completadas,
    enProgreso,
    canceladas,
    horasTotales: Math.round((timeAgg._sum.tiempoTotalMinutos ?? 0) / 60 * 100) / 100,
    promedioMinutosPorTarea: Math.round(timeAgg._avg.tiempoTotalMinutos ?? 0),
    usuariosActivos: activeUsers.length,
    byEstado: stateMap,
  }
}

// ─── Person summaries ─────────────────────────────────────────────────────────

export async function getPersonSummaries(user: AuthPayload, teamId: number, range: DateRange, token?: string) {
  await assertManagerAccess(user, teamId)

  const dateFilter = buildDateFilter(range)
  const where = { teamId, ...(dateFilter ? { fecha: dateFilter } : {}) }

  // Get actual team members to avoid showing users from other teams
  const [teamMembers, teamOwner] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId, isActive: true },
      select: { userId: true },
    }),
    prisma.team.findFirst({ where: { id: teamId }, select: { ownerUserId: true } }),
  ])
  const memberIds = new Set([
    ...(teamOwner ? [teamOwner.ownerUserId] : []),
    ...teamMembers.map((m) => m.userId),
  ])

  const rows = await prisma.task.groupBy({
    by: ["asignadoAId", "asignadoANombre", "estado"],
    where: { ...where, asignadoAId: { not: null, in: Array.from(memberIds) } },
    _count: { id: true },
    _sum: { tiempoTotalMinutos: true },
  })

  // Build name map from intranet API (best-effort)
  let nameMap = new Map<number, string>()
  if (token) {
    try {
      const res = await axios.get<{ id: number; full_name: string | null; email: string }[]>(
        `${env.INTRANET_API_URL}/api/tasks-v2/users`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      for (const u of Array.isArray(res.data) ? res.data : []) {
        nameMap.set(u.id, u.full_name ?? u.email)
      }
    } catch { /* enrichment is best-effort */ }
  }

  const personMap = new Map<number, {
    userId: number
    nombre: string
    total: number
    horasTotal: number
    byEstado: Record<string, number>
  }>()

  for (const row of rows) {
    const uid = row.asignadoAId!
    if (!personMap.has(uid)) {
      personMap.set(uid, {
        userId: uid,
        nombre: nameMap.get(uid) ?? row.asignadoANombre ?? `Usuario ${uid}`,
        total: 0,
        horasTotal: 0,
        byEstado: {},
      })
    }
    const p = personMap.get(uid)!
    p.total += row._count.id
    p.horasTotal += Math.round((row._sum.tiempoTotalMinutos ?? 0) / 60 * 100) / 100
    p.byEstado[row.estado] = (p.byEstado[row.estado] ?? 0) + row._count.id
  }

  return Array.from(personMap.values()).sort((a, b) => b.total - a.total)
}

// ─── Charts data ──────────────────────────────────────────────────────────────

export async function getCharts(user: AuthPayload, teamId: number, range: DateRange) {
  await assertManagerAccess(user, teamId)

  const dateFilter = buildDateFilter(range)
  const where = { teamId, ...(dateFilter ? { fecha: dateFilter } : {}) }

  const [byResponsable, byEstado, byEtiqueta, horasPorDia] = await Promise.all([
    prisma.task.groupBy({
      by: ["asignadoANombre"],
      where: { ...where, asignadoAId: { not: null } },
      _count: { id: true },
    }),
    prisma.task.groupBy({ by: ["estado"], where, _count: { id: true } }),
    prisma.task.groupBy({ by: ["etiqueta"], where, _count: { id: true } }),
    prisma.task.groupBy({
      by: ["fecha"],
      where: { ...where, tiempoTotalMinutos: { not: null } },
      _sum: { tiempoTotalMinutos: true },
      orderBy: { fecha: "asc" },
    }),
  ])

  return {
    byResponsable: byResponsable.map((r) => ({
      nombre: r.asignadoANombre,
      count: r._count.id,
    })),
    byEstado: byEstado.map((r) => ({ estado: r.estado, count: r._count.id })),
    byEtiqueta: byEtiqueta.map((r) => ({ etiqueta: r.etiqueta, count: r._count.id })),
    horasPorDia: horasPorDia.map((r) => ({
      fecha: r.fecha,
      horas: Math.round((r._sum.tiempoTotalMinutos ?? 0) / 60 * 100) / 100,
    })),
  }
}

// ─── Without entry today ──────────────────────────────────────────────────────

export async function getMembersWithoutEntryToday(user: AuthPayload, teamId: number, token?: string) {
  await assertManagerAccess(user, teamId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [allMembers, todayAssignees] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId, isActive: true },
      select: { userId: true },
    }),
    prisma.task.findMany({
      where: { teamId, fecha: today, asignadoAId: { not: null } },
      select: { asignadoAId: true },
      distinct: ["asignadoAId"],
    }),
  ])

  // Also check owner
  const team = await prisma.team.findFirst({ where: { id: teamId }, select: { ownerUserId: true } })
  const allIds = new Set([
    ...(team ? [team.ownerUserId] : []),
    ...allMembers.map((m) => m.userId),
  ])
  const withEntry = new Set(todayAssignees.map((t) => t.asignadoAId!))

  // Enrich names best-effort
  let nameMap = new Map<number, string>()
  if (token) {
    try {
      const res = await axios.get<{ id: number; full_name: string | null; email: string }[]>(
        `${env.INTRANET_API_URL}/api/tasks-v2/users`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      for (const u of Array.isArray(res.data) ? res.data : []) {
        nameMap.set(u.id, u.full_name ?? u.email)
      }
    } catch { /* best-effort */ }
  }

  return Array.from(allIds)
    .filter((id) => !withEntry.has(id))
    .map((id) => ({ userId: id, nombre: nameMap.get(id) ?? `Usuario ${id}` }))
}

// ─── My KPIs ─────────────────────────────────────────────────────────────────

export async function getMyKpis(user: AuthPayload, teamId: number, range: DateRange) {
  const userId = getUserId(user)

  const memberTeams = isAdmin(user) ? null : await getMemberTeamIds(user)
  if (memberTeams && !memberTeams.includes(teamId)) {
    throw new AppError(403, "No perteneces a este equipo")
  }

  const dateFilter = buildDateFilter(range)
  const where = {
    teamId,
    asignadoAId: userId,
    ...(dateFilter ? { fecha: dateFilter } : {}),
  }

  const [total, states, timeAgg, pending] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.groupBy({ by: ["estado"], where, _count: { id: true } }),
    prisma.task.aggregate({
      where: { ...where, tiempoTotalMinutos: { not: null } },
      _sum: { tiempoTotalMinutos: true },
    }),
    prisma.task.count({ where: { ...where, aceptacion: "pendiente" } }),
  ])

  return {
    total,
    horasTotales: Math.round((timeAgg._sum.tiempoTotalMinutos ?? 0) / 60 * 100) / 100,
    pendientesAceptar: pending,
    byEstado: Object.fromEntries(states.map((s) => [s.estado, s._count.id])),
  }
}
