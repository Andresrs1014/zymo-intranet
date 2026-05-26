import prisma from "../config/prisma"
import { AppError } from "../middleware/errorHandler"
import { AuthPayload } from "../middleware/auth"
import { requireManageAccess, requireMembership } from "../utils/permissions"
import type { ListType } from "@prisma/client"

const DEFAULT_ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "#6b7280", sortOrder: 0, isInitialAssignment: true, isFinal: false, isCanceled: false },
  { value: "en_progreso", label: "En progreso", color: "#3b82f6", sortOrder: 1, isInitialAssignment: false, isFinal: false, isCanceled: false },
  { value: "revision", label: "Revisión", color: "#f59e0b", sortOrder: 2, isInitialAssignment: false, isFinal: false, isCanceled: false },
  { value: "completada", label: "Completada", color: "#10b981", sortOrder: 3, isInitialAssignment: false, isFinal: true, isCanceled: false },
  { value: "cancelada", label: "Cancelada", color: "#ef4444", sortOrder: 4, isInitialAssignment: false, isFinal: false, isCanceled: true },
]

const DEFAULT_ETIQUETAS = [
  { value: "desarrollos", label: "Desarrollos", color: "#6366f1", sortOrder: 0 },
  { value: "actualizaciones", label: "Actualizaciones", color: "#8b5cf6", sortOrder: 1 },
  { value: "auditorias", label: "Auditorías", color: "#ec4899", sortOrder: 2 },
  { value: "implementacion_okr", label: "Implementación OKR", color: "#f97316", sortOrder: 3 },
  { value: "tareas_diarias", label: "Tareas Diarias", color: "#14b8a6", sortOrder: 4 },
]

const DEFAULT_PLATAFORMAS = [
  { value: "logimat_1", label: "Logimat 1", color: "#3b82f6", sortOrder: 0 },
  { value: "logimat_2", label: "Logimat 2", color: "#6366f1", sortOrder: 1 },
  { value: "imccargo", label: "IMCCARGO", color: "#10b981", sortOrder: 2 },
  { value: "imc_deposito", label: "IMC Depósito", color: "#f59e0b", sortOrder: 3 },
]

const DEFAULT_MODALIDADES = [
  { value: "presencial", label: "Presencial", color: "#10b981", sortOrder: 0 },
  { value: "virtual", label: "Virtual", color: "#6366f1", sortOrder: 1 },
  { value: "hibrido", label: "Híbrido", color: "#f59e0b", sortOrder: 2 },
]

const DEFAULT_PRIORIDADES = [
  { value: "baja", label: "Baja", color: "#6b7280", sortOrder: 0 },
  { value: "media", label: "Media", color: "#3b82f6", sortOrder: 1 },
  { value: "alta", label: "Alta", color: "#f59e0b", sortOrder: 2 },
  { value: "critica", label: "Crítica", color: "#ef4444", sortOrder: 3 },
]

async function seedDefaults(teamId: number): Promise<void> {
  const ops = [
    ...DEFAULT_ESTADOS.map((e) =>
      prisma.listConfig.upsert({
        where: { teamId_listType_value: { teamId, listType: "estado", value: e.value } },
        update: {},
        create: { teamId, listType: "estado", ...e },
      }),
    ),
    ...DEFAULT_ETIQUETAS.map((e) =>
      prisma.listConfig.upsert({
        where: { teamId_listType_value: { teamId, listType: "etiqueta", value: e.value } },
        update: {},
        create: { teamId, listType: "etiqueta", ...e },
      }),
    ),
    ...DEFAULT_PLATAFORMAS.map((e) =>
      prisma.listConfig.upsert({
        where: { teamId_listType_value: { teamId, listType: "plataforma", value: e.value } },
        update: {},
        create: { teamId, listType: "plataforma", ...e },
      }),
    ),
    ...DEFAULT_MODALIDADES.map((e) =>
      prisma.listConfig.upsert({
        where: { teamId_listType_value: { teamId, listType: "modalidad", value: e.value } },
        update: {},
        create: { teamId, listType: "modalidad", ...e },
      }),
    ),
    ...DEFAULT_PRIORIDADES.map((e) =>
      prisma.listConfig.upsert({
        where: { teamId_listType_value: { teamId, listType: "prioridad", value: e.value } },
        update: {},
        create: { teamId, listType: "prioridad", ...e },
      }),
    ),
  ]
  await Promise.all(ops)
}

export async function getLists(user: AuthPayload, teamId: number) {
  await requireMembership(user, teamId)

  // Auto-seed if team has no configs
  const count = await prisma.listConfig.count({ where: { teamId } })
  if (count === 0) await seedDefaults(teamId)

  const configs = await prisma.listConfig.findMany({
    where: { teamId, isActive: true },
    orderBy: [{ listType: "asc" }, { sortOrder: "asc" }],
  })

  const grouped: Record<string, typeof configs> = {}
  for (const c of configs) {
    if (!grouped[c.listType]) grouped[c.listType] = []
    grouped[c.listType].push(c)
  }
  return grouped
}

export async function createListItem(
  user: AuthPayload,
  teamId: number,
  input: {
    listType: string
    value: string
    label: string
    color?: string
    sortOrder?: number
  },
) {
  await requireManageAccess(user, teamId)

  const value = input.value.trim().toLowerCase().replace(/\s+/g, "_")
  if (!value) throw new AppError(422, "El valor no puede estar vacío")

  const existing = await prisma.listConfig.findFirst({
    where: { teamId, listType: input.listType as ListType, value },
  })
  if (existing) {
    if (existing.isActive) throw new AppError(409, "Ya existe un item con ese valor")
    // Reactivate
    return prisma.listConfig.update({
      where: { id: existing.id },
      data: { isActive: true, label: input.label, color: input.color ?? null },
    })
  }

  return prisma.listConfig.create({
    data: {
      teamId,
      listType: input.listType as ListType,
      value,
      label: input.label,
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  })
}

export async function updateListItem(
  user: AuthPayload,
  teamId: number,
  listType: string,
  value: string,
  input: { label?: string; color?: string | null; sortOrder?: number; isActive?: boolean },
) {
  await requireManageAccess(user, teamId)

  const item = await prisma.listConfig.findFirst({
    where: { teamId, listType: listType as ListType, value },
  })
  if (!item) throw new AppError(404, "Item no encontrado")

  return prisma.listConfig.update({
    where: { id: item.id },
    data: {
      label: input.label ?? item.label,
      color: input.color !== undefined ? input.color : item.color,
      sortOrder: input.sortOrder ?? item.sortOrder,
      isActive: input.isActive !== undefined ? input.isActive : item.isActive,
    },
  })
}

export async function deleteListItem(
  user: AuthPayload,
  teamId: number,
  listType: string,
  value: string,
): Promise<void> {
  await requireManageAccess(user, teamId)

  const item = await prisma.listConfig.findFirst({
    where: { teamId, listType: listType as ListType, value },
  })
  if (!item) throw new AppError(404, "Item no encontrado")

  await prisma.listConfig.update({ where: { id: item.id }, data: { isActive: false } })
}

export async function setSpecialFlag(
  user: AuthPayload,
  teamId: number,
  value: string,
  flags: { isFinal?: boolean; isCanceled?: boolean; isInitialAssignment?: boolean },
) {
  await requireManageAccess(user, teamId)

  const item = await prisma.listConfig.findFirst({
    where: { teamId, listType: "estado", value, isActive: true },
  })
  if (!item) throw new AppError(404, "Estado no encontrado")

  // Ensure only 1 of each special flag per team
  if (flags.isFinal) {
    await prisma.listConfig.updateMany({
      where: { teamId, listType: "estado", isFinal: true },
      data: { isFinal: false },
    })
  }
  if (flags.isCanceled) {
    await prisma.listConfig.updateMany({
      where: { teamId, listType: "estado", isCanceled: true },
      data: { isCanceled: false },
    })
  }
  if (flags.isInitialAssignment) {
    await prisma.listConfig.updateMany({
      where: { teamId, listType: "estado", isInitialAssignment: true },
      data: { isInitialAssignment: false },
    })
  }

  return prisma.listConfig.update({
    where: { id: item.id },
    data: {
      isFinal: flags.isFinal ?? item.isFinal,
      isCanceled: flags.isCanceled ?? item.isCanceled,
      isInitialAssignment: flags.isInitialAssignment ?? item.isInitialAssignment,
    },
  })
}
