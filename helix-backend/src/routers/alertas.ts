import { Router } from "express"
import {
  generarAlertasWhatsApp,
  registrarAlertas,
  getHistorialAlertas,
} from "../services/alertaService"

const router = Router()

// POST /api/alertas — generate + register with canal "auto"
router.post("/", async (_req, res, next) => {
  try {
    const alertas = await generarAlertasWhatsApp()
    await registrarAlertas(alertas, "auto")
    res.json({ alertas })
  } catch (err) {
    next(err)
  }
})

// POST /api/alertas/whatsapp — generate + register with canal "whatsapp"
router.post("/whatsapp", async (_req, res, next) => {
  try {
    const alertas = await generarAlertasWhatsApp()
    await registrarAlertas(alertas, "whatsapp")
    res.json({ alertas })
  } catch (err) {
    next(err)
  }
})

// POST /api/alertas/email — generate + register with canal "email"
router.post("/email", async (_req, res, next) => {
  try {
    const alertas = await generarAlertasWhatsApp()
    await registrarAlertas(alertas, "email")
    res.json({ alertas })
  } catch (err) {
    next(err)
  }
})

// GET /api/alertas/historial — last 30 alert history records
router.get("/historial", async (_req, res, next) => {
  try {
    const historial = await getHistorialAlertas(30)
    res.json({ historial })
  } catch (err) {
    next(err)
  }
})

export default router
