import { DirectoryCacheTipo, Prisma } from "@prisma/client"
import prisma from "../config/prisma"

export interface DirectoryCacheView {
  id: number
  externalId: string
  nombre: string
  tipo: DirectoryCacheTipo
  intranetUserId: number | null
  syncedAt: Date
}

export async function searchDirectoryCache(params: {
  tipo?: DirectoryCacheTipo
  q?: string
  limit?: number
}): Promise<DirectoryCacheView[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
  const where: Prisma.DirectoryCacheWhereInput = {}

  if (params.tipo) where.tipo = params.tipo

  if (params.q?.trim()) {
    where.nombre = { contains: params.q.trim(), mode: "insensitive" }
  }

  return prisma.directoryCache.findMany({
    where,
    orderBy: [{ nombre: "asc" }],
    take: limit,
  })
}

export async function getDirectoryCacheStats(): Promise<{
  areas: number
  personas: number
  personasConCuenta: number
  lastSyncedAt: string | null
}> {
  const [areas, personas, personasConCuenta, latest] = await Promise.all([
    prisma.directoryCache.count({ where: { tipo: DirectoryCacheTipo.area } }),
    prisma.directoryCache.count({ where: { tipo: DirectoryCacheTipo.persona } }),
    prisma.directoryCache.count({
      where: { tipo: DirectoryCacheTipo.persona, intranetUserId: { not: null } },
    }),
    prisma.directoryCache.findFirst({
      orderBy: { syncedAt: "desc" },
      select: { syncedAt: true },
    }),
  ])

  return {
    areas,
    personas,
    personasConCuenta,
    lastSyncedAt: latest?.syncedAt.toISOString() ?? null,
  }
}
