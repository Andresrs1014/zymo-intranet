import * as svc from "./systemConfigService"

export type WebhookPayload = Record<string, unknown>

async function postWithRetry(url: string, payload: WebhookPayload): Promise<void> {
  const body = JSON.stringify(payload)
  const headers = { "Content-Type": "application/json" }

  const attempt = async () => {
    const res = await fetch(url, { method: "POST", headers, body })
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`)
  }

  try {
    await attempt()
  } catch {
    // retry once after 2 seconds
    await new Promise((r) => setTimeout(r, 2000))
    await attempt()
  }
}

export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  const enabled = await svc.getConfig("webhook_enabled")
  if (enabled !== "true") return

  const url = await svc.getConfig("webhook_powerautomate_url")
  if (!url) throw new Error("URL del webhook no configurada")

  await postWithRetry(url, payload)
}

// ─── Payloads específicos ─────────────────────────────────────────────────────

export interface TareaAsignadaPayload {
  type: "tarea_asignada"
  titulo: string
  descripcion?: string
  fecha: string
  horaInicio?: string
  horaCierre?: string
  duracionEstimadaMinutos?: number | null
  asignadoEmail?: string
  asignadoNombre: string
  asignadoPorNombre: string
  equipo: string
  prioridad: string
  urlTarea: string
}

export interface EventoCreadoPayload {
  type: "evento_creado"
  titulo: string
  descripcion?: string
  fecha: string
  horaInicio: string
  duracionMinutos: number
  modalidad?: string | null
  sede?: string | null
  organizadorNombre: string
  equipo: string
  participantes: Array<{ email: string; nombre: string }>
}
