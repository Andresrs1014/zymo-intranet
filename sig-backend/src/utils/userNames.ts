import { env } from "../config/env"

/**
 * Fetches display names for a list of user IDs from the intranet API.
 * Returns a Map<userId, displayName>. Best-effort — empty map on failure.
 */
export async function enrichUserNames(userIds: number[]): Promise<Map<number, string>> {
  const nameMap = new Map<number, string>()
  if (userIds.length === 0) return nameMap
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

/**
 * Resolves a single user's display name. Returns null on failure.
 */
export async function resolveUserName(userId: number): Promise<string | null> {
  const map = await enrichUserNames([userId])
  return map.get(userId) ?? null
}

/**
 * Resuelve el nombre del usuario autenticado (el que ejecuta la acción). El JWT
 * emitido por el backend Python NO incluye full_name (solo id/role/sede/area/email)
 * — leerlo del payload decodificado siempre da undefined, hay que consultar la
 * intranet. Ver mismo patrón en task-backend/src/utils/userNames.ts.
 */
export async function resolveActorName(userId: number, hintName?: string): Promise<string> {
  if (hintName) return hintName
  return (await resolveUserName(userId)) ?? `Usuario ${userId}`
}
