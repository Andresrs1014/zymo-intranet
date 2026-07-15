import jwt from "jsonwebtoken"
import { env } from "../config/env"

/** Token de servicio — mismo patrón que zymoally-backend/src/services/masterDataSync.ts */
export function mintServiceToken(): string {
  if (!env.SYNC_SERVICE_EMAIL) {
    throw new Error(
      "SYNC_SERVICE_EMAIL no está configurada — no se puede sincronizar el directorio sin cuenta de servicio.",
    )
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { sub: env.SYNC_SERVICE_EMAIL, exp: nowSeconds + 5 * 60 },
    env.JWT_SECRET,
    { algorithm: "HS256" },
  )
}

export async function fetchIntranet<T>(pathAndQuery: string, token: string): Promise<T> {
  const res = await fetch(`${env.INTRANET_API_URL}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300)
    throw new Error(`Intranet ${pathAndQuery} respondió ${res.status}: ${body}`)
  }
  return (await res.json()) as T
}
