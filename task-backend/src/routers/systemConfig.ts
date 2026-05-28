import { Router, Request, Response } from "express"
import { z } from "zod"
import { isAdmin } from "../middleware/auth"
import * as svc from "../services/systemConfigService"

const router = Router()

// ─── GET /api/config ─────────────────────────────────────────────────────────
// Returns all config (passwords masked)
router.get("/", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) { res.status(403).json({ error: "No autorizado" }); return }
  try {
    const all = await svc.getAllConfig()
    // Mask encrypted values in response
    const masked: Record<string, string> = {}
    for (const [k, v] of Object.entries(all)) {
      masked[k] = svc.ENCRYPTED_KEYS.has(k) && v ? "••••••••" : v
    }
    res.json(masked)
  } catch (e) {
    res.status(500).json({ error: "Error al leer configuración" })
  }
})

// ─── PUT /api/config ──────────────────────────────────────────────────────────
const updateSchema = z.object({
  smtp_host: z.string().optional(),
  smtp_port: z.string().optional(),
  smtp_user: z.string().optional(),
  smtp_password: z.string().optional(),
  smtp_from: z.string().optional(),
  smtp_enabled: z.enum(["true", "false"]).optional(),
  webhook_powerautomate_url: z.string().optional(),
  webhook_enabled: z.enum(["true", "false"]).optional(),
})

router.put("/", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) { res.status(403).json({ error: "No autorizado" }); return }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }
  try {
    const entries = Object.entries(parsed.data)
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) => ({
        key,
        value: value as string,
        encrypted: svc.ENCRYPTED_KEYS.has(key),
      }))
    await svc.setManyConfig(entries)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: "Error al guardar configuración" })
  }
})

// ─── POST /api/config/test-email ─────────────────────────────────────────────
router.post("/test-email", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) { res.status(403).json({ error: "No autorizado" }); return }
  try {
    const enabled = await svc.getConfig("smtp_enabled")
    if (enabled !== "true") {
      res.status(400).json({ error: "Email no está habilitado en la configuración" })
      return
    }
    // Import emailService lazily to avoid circular deps (implemented in Fase 2)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendTestEmail } = require("../services/emailService") as { sendTestEmail: (to: string) => Promise<void> }
    const adminEmail = req.user!.email
    if (!adminEmail) { res.status(400).json({ error: "No se pudo determinar tu email" }); return }
    await sendTestEmail(adminEmail)
    res.json({ ok: true, message: `Email de prueba enviado a ${adminEmail}` })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al enviar email de prueba"
    res.status(500).json({ error: msg })
  }
})

// ─── POST /api/config/test-webhook ───────────────────────────────────────────
router.post("/test-webhook", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) { res.status(403).json({ error: "No autorizado" }); return }
  try {
    const enabled = await svc.getConfig("webhook_enabled")
    if (enabled !== "true") {
      res.status(400).json({ error: "Webhook no está habilitado en la configuración" })
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sendWebhook } = require("../services/webhookService") as { sendWebhook: (payload: Record<string, unknown>) => Promise<void> }
    await sendWebhook({
      type: "test",
      mensaje: "Prueba de conexión desde ZYMO Intranet",
      timestamp: new Date().toISOString(),
    })
    res.json({ ok: true, message: "Webhook de prueba enviado" })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al enviar webhook de prueba"
    res.status(500).json({ error: msg })
  }
})

export default router
