import jwt from "jsonwebtoken"
import { env } from "../config/env"

type Entity = "prospecto" | "cita"
type Action = "create" | "update" | "delete"

/**
 * Respaldo automático hacia sig-backend (decisión del usuario: "que caiga al
 * SIG... como backup automático, por si se necesita"). Fire-and-forget: nunca
 * debe bloquear ni tumbar la escritura real en la BD propia de este módulo,
 * mismo patrón que emailService.ts en zymoally-backend.
 *
 * Autenticación: se autofirma un JWT de servicio de vida corta con el mismo
 * JWT_SECRET compartido por toda la intranet (rol "admin", que sig-backend ya
 * trata como bypass total) — no hace falta inventar un mecanismo de llave
 * interna nuevo en sig-backend, se reutiliza la confianza que ya existe.
 */
export async function backupToSig(entity: Entity, action: Action, externalId: number, payload: unknown): Promise<void> {
  try {
    const serviceToken = jwt.sign(
      { sub: "libertadora-backend", role: "admin", email: "service@libertadora-backend.internal" },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "5m" }
    )
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${env.SIG_BACKEND_URL}/api/libertadora-backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify({ entity, action, externalId, payload }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`[sigBackup] respuesta no-OK de sig-backend (${res.status}) para ${entity}#${externalId}`)
    }
  } catch (err) {
    console.warn(`[sigBackup] no se pudo respaldar ${entity}#${externalId} en sig-backend:`, err)
  }
}
