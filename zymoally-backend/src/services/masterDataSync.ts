import jwt from "jsonwebtoken"
import { prisma } from "../config/prisma"
import { env } from "../config/env"
import { normalizePrefix } from "../utils/formatters"

// ─── Tipos de respuesta del backend Python (intranet) ───────────────────────
interface IntranetArea {
  id: number
  name: string
}

interface IntranetSede {
  id: number
  name: string
  visible_en_solicitudes_oc?: boolean
}

interface IntranetPersona {
  id: number
  nombre: string
}

interface IntranetPersonasResponse {
  total: number
  items: IntranetPersona[]
}

// ─── Resultado del sync ─────────────────────────────────────────────────────
interface SyncSection {
  fetched: number
  created: number
  updated: number
}

export interface SyncMasterDataResult {
  areas: SyncSection
  platforms: SyncSection
  personas: SyncSection
  ranAt: string
}

// ─── Token de servicio ───────────────────────────────────────────────────────
// get_current_user (backend Python, app/core/deps.py) decodifica el JWT, toma
// el claim "sub" (email), y carga el usuario REAL de la base de datos — no
// confía en role/id sueltos dentro del payload. El token debe llevar
// únicamente sub+exp, igual que create_access_token en Python. La cuenta
// SYNC_SERVICE_EMAIL debe existir de verdad en la tabla `user` (ver
// "Prerrequisito manual" al inicio del plan) con el role/permisos deseados.
function mintServiceToken(): string {
  if (!env.SYNC_SERVICE_EMAIL) {
    throw new Error(
      "SYNC_SERVICE_EMAIL no está configurada — no se puede sincronizar datos maestros sin la cuenta de servicio. Ver 'Prerrequisito manual' en el plan.",
    )
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { sub: env.SYNC_SERVICE_EMAIL, exp: nowSeconds + 5 * 60 },
    env.JWT_SECRET,
    { algorithm: "HS256" },
  )
}

// ─── Fetch autenticado contra la intranet (fetch nativo de Node 20) ─────────
async function fetchIntranet<T>(pathAndQuery: string, token: string): Promise<T> {
  const res = await fetch(`${env.INTRANET_API_URL}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Intranet ${pathAndQuery} respondió ${res.status}`)
  }
  return (await res.json()) as T
}

// ─── Helpers de unicidad (respetan las @@unique del schema) ─────────────────
async function uniqueConfigValue(listType: string, base: string): Promise<string> {
  let candidate = base
  let n = 2
  while (await prisma.zymoConfigList.findFirst({ where: { listType, value: candidate } })) {
    candidate = `${base} (${n})`
    n++
  }
  return candidate
}

async function uniqueAreaPrefix(name: string, taken: Set<string>): Promise<string> {
  const base = normalizePrefix(name)
  let candidate = base
  let n = 2
  while (taken.has(candidate)) {
    candidate = `${base}${n}`
    n++
  }
  return candidate
}

// ─── Upsert de un listType de ZymoConfigList por externalId ─────────────────
async function syncConfigList(
  listType: string,
  items: { externalId: string; label: string }[],
): Promise<SyncSection> {
  const section: SyncSection = { fetched: items.length, created: 0, updated: 0 }
  const maxRow = await prisma.zymoConfigList.aggregate({
    where: { listType },
    _max: { sortOrder: true },
  })
  let nextOrder = (maxRow._max.sortOrder ?? -1) + 1
  for (const item of items) {
    const existing = await prisma.zymoConfigList.findFirst({
      where: { listType, externalId: item.externalId },
    })
    if (existing) {
      await prisma.zymoConfigList.update({
        where: { id: existing.id },
        data: { label: item.label, syncedAt: new Date() },
      })
      section.updated++
      continue
    }
    const value = await uniqueConfigValue(listType, item.label)
    await prisma.zymoConfigList.create({
      data: {
        listType,
        value,
        label: item.label,
        externalId: item.externalId,
        sortOrder: nextOrder,
        isActive: true,
        syncedAt: new Date(),
      },
    })
    nextOrder++
    section.created++
  }
  return section
}

// ─── Upsert de áreas → ZymoAreaPrefix por externalId ────────────────────────
async function syncAreas(areas: IntranetArea[]): Promise<SyncSection> {
  const section: SyncSection = { fetched: areas.length, created: 0, updated: 0 }
  const existingPrefixes = await prisma.zymoAreaPrefix.findMany({ select: { prefix: true } })
  const taken = new Set(existingPrefixes.map((p) => p.prefix))
  const maxRow = await prisma.zymoAreaPrefix.aggregate({ _max: { sortOrder: true } })
  let nextOrder = (maxRow._max.sortOrder ?? -1) + 1
  for (const area of areas) {
    const externalId = String(area.id)
    const existing = await prisma.zymoAreaPrefix.findFirst({ where: { externalId } })
    if (existing) {
      await prisma.zymoAreaPrefix.update({
        where: { id: existing.id },
        data: { area: area.name, syncedAt: new Date() },
      })
      section.updated++
      continue
    }
    const prefix = await uniqueAreaPrefix(area.name, taken)
    taken.add(prefix)
    await prisma.zymoAreaPrefix.create({
      data: {
        area: area.name,
        prefix,
        isActive: true,
        sortOrder: nextOrder,
        externalId,
        syncedAt: new Date(),
      },
    })
    nextOrder++
    section.created++
  }
  return section
}

// ─── Orquestador público (compartido por cron y botón manual) ───────────────
export async function syncMasterData(): Promise<SyncMasterDataResult> {
  const token = mintServiceToken()
  const [areas, sedes, personasResp] = await Promise.all([
    fetchIntranet<IntranetArea[]>("/areas", token),
    fetchIntranet<IntranetSede[]>("/sedes?para_solicitudes_oc=true", token),
    fetchIntranet<IntranetPersonasResponse>("/tc/personas?estado=activo&limit=500", token),
  ])

  const areasResult = await syncAreas(areas)
  const platformsResult = await syncConfigList(
    "platforms",
    sedes.map((s) => ({ externalId: String(s.id), label: s.name })),
  )
  const personasResult = await syncConfigList(
    "personas",
    personasResp.items.map((p) => ({ externalId: String(p.id), label: p.nombre })),
  )

  return {
    areas: areasResult,
    platforms: platformsResult,
    personas: personasResult,
    ranAt: new Date().toISOString(),
  }
}
