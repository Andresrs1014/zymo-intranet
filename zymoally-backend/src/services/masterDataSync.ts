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

interface IntranetCliente {
  id: number
  nombre: string
}

interface IntranetClientesResponse {
  items: IntranetCliente[]
}

interface IntranetUser {
  id: number
  full_name: string | null
  email: string
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
  clients: SyncSection
  supervisors: SyncSection
  analysts: SyncSection
  coordinators: SyncSection
  managers: SyncSection
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
    const body = (await res.text()).slice(0, 300)
    throw new Error(`Intranet ${pathAndQuery} respondió ${res.status}: ${body}`)
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
interface SyncListItem {
  externalId: string
  label: string
  contactEmail?: string
  contactPhone?: string
}

async function syncConfigList(listType: string, items: SyncListItem[]): Promise<SyncSection> {
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
        data: {
          label: item.label,
          contactEmail: item.contactEmail || null,
          contactPhone: item.contactPhone || null,
          syncedAt: new Date(),
        },
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
        contactEmail: item.contactEmail || null,
        contactPhone: item.contactPhone || null,
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
// ponytail: lock en memoria de un solo proceso — suficiente porque
// zymoally-backend corre como un único contenedor sin réplicas. Evita que un
// click manual solape con el cron y choque creando el mismo externalId dos
// veces a mitad de loop.
let syncing = false

export async function syncMasterData(): Promise<SyncMasterDataResult> {
  if (syncing) {
    throw new Error("Ya hay una sincronización en curso, espera a que termine.")
  }
  syncing = true
  try {
    const token = mintServiceToken()
    const [areas, sedes, users, clientesResp] = await Promise.all([
      fetchIntranet<IntranetArea[]>("/areas", token),
      fetchIntranet<IntranetSede[]>("/sedes?para_solicitudes_oc=true", token),
      // Usuarios reales de la intranet (login propio) — supervisor/analista/
      // coordinador/gestiona se eligen todos de esta misma lista, para que el
      // correo de contacto sea siempre el de login (garantizado), no el
      // "correo corporativo" opcional de T&C que motivó este cambio.
      fetchIntranet<IntranetUser[]>("/api/tasks-v2/users", token),
      // Directorio de clientes corporativos (T&C, solo lectura — se gestionan
      // de verdad en Operativo).
      fetchIntranet<IntranetClientesResponse>("/tc/clientes?limit=500", token),
    ])

    const userItems: SyncListItem[] = users.map((u) => ({
      externalId: String(u.id),
      label: u.full_name ?? u.email,
      contactEmail: u.email,
    }))

    // Limpieza de transición única: supervisors/analysts/coordinators se
    // poblaban antes desde personas de T&C (externalId = id de PtcPersona);
    // ahora vienen de usuarios reales (externalId = id de User). Son
    // namespaces de id distintos — sin este borrado, una fila vieja queda
    // huérfana (duplicado en el select) o, peor, un id viejo coincide por
    // casualidad con el id de un usuario distinto y el upsert por externalId
    // la pisa con la persona equivocada. No toca filas agregadas a mano
    // (externalId null).
    const currentUserIds = new Set(userItems.map((i) => i.externalId))
    for (const listType of ["supervisors", "analysts", "coordinators"] as const) {
      const existing = await prisma.zymoConfigList.findMany({
        where: { listType, externalId: { not: null } },
        select: { id: true, externalId: true },
      })
      const staleIds = existing.filter((e) => !currentUserIds.has(e.externalId!)).map((e) => e.id)
      if (staleIds.length) await prisma.zymoConfigList.deleteMany({ where: { id: { in: staleIds } } })
    }

    const areasResult = await syncAreas(areas)
    const platformsResult = await syncConfigList(
      "platforms",
      sedes.map((s) => ({ externalId: String(s.id), label: s.name })),
    )
    const clientsResult = await syncConfigList(
      "clients",
      clientesResp.items.map((c) => ({ externalId: String(c.id), label: c.nombre })),
    )
    const supervisorsResult = await syncConfigList("supervisors", userItems)
    const analystsResult = await syncConfigList("analysts", userItems)
    const coordinatorsResult = await syncConfigList("coordinators", userItems)
    const managersResult = await syncConfigList("managers", userItems)

    return {
      areas: areasResult,
      platforms: platformsResult,
      clients: clientsResult,
      supervisors: supervisorsResult,
      analysts: analystsResult,
      coordinators: coordinatorsResult,
      managers: managersResult,
      ranAt: new Date().toISOString(),
    }
  } finally {
    syncing = false
  }
}
