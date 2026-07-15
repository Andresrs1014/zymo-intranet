import { DirectoryCacheTipo } from "@prisma/client"
import prisma from "../config/prisma"
import { fetchIntranet, mintServiceToken } from "../utils/intranetFetch"

interface IntranetArea {
  id: number
  name: string
}

interface IntranetPersona {
  id: number
  nombre: string
  user_id?: number | null
}

interface IntranetPersonasResponse {
  total: number
  items: IntranetPersona[]
}

interface SyncSection {
  fetched: number
  created: number
  updated: number
}

export interface SyncDirectoryCacheResult {
  areas: SyncSection
  personas: SyncSection
  ranAt: string
}

type CacheUpsertRow = {
  externalId: string
  nombre: string
  tipo: DirectoryCacheTipo
  intranetUserId?: number | null
}

async function upsertDirectoryCache(rows: CacheUpsertRow[]): Promise<SyncSection> {
  const section: SyncSection = { fetched: rows.length, created: 0, updated: 0 }
  const now = new Date()

  for (const row of rows) {
    const existing = await prisma.directoryCache.findUnique({
      where: { tipo_externalId: { tipo: row.tipo, externalId: row.externalId } },
    })

    if (existing) {
      await prisma.directoryCache.update({
        where: { id: existing.id },
        data: {
          nombre: row.nombre,
          intranetUserId: row.intranetUserId ?? null,
          syncedAt: now,
        },
      })
      section.updated++
      continue
    }

    await prisma.directoryCache.create({
      data: {
        externalId: row.externalId,
        nombre: row.nombre,
        tipo: row.tipo,
        intranetUserId: row.intranetUserId ?? null,
        syncedAt: now,
      },
    })
    section.created++
  }

  return section
}

let syncing = false

/** Sincroniza áreas y personas activas del directorio intranet → directory_cache (global, solo lectura). */
export async function syncDirectoryCache(): Promise<SyncDirectoryCacheResult> {
  if (syncing) {
    throw new Error("Ya hay una sincronización del directorio en curso.")
  }
  syncing = true
  try {
    const token = mintServiceToken()
    const [areas, personasResp] = await Promise.all([
      fetchIntranet<IntranetArea[]>("/areas", token),
      fetchIntranet<IntranetPersonasResponse>("/tc/personas?estado=Activo&limit=500", token),
    ])

    const areasResult = await upsertDirectoryCache(
      areas.map((a) => ({
        externalId: String(a.id),
        nombre: a.name,
        tipo: DirectoryCacheTipo.area,
      })),
    )

    const personasResult = await upsertDirectoryCache(
      personasResp.items.map((p) => ({
        externalId: String(p.id),
        nombre: p.nombre,
        tipo: DirectoryCacheTipo.persona,
        intranetUserId: p.user_id ?? null,
      })),
    )

    return {
      areas: areasResult,
      personas: personasResult,
      ranAt: new Date().toISOString(),
    }
  } finally {
    syncing = false
  }
}
