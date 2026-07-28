import { Router } from "express"
import { z } from "zod"
import {
  CreatePartnerUserBody,
  ResetPasswordBody,
  listPartnerUsers,
  createPartnerUser,
  setPartnerUserActive,
  resetPartnerUserPassword,
} from "../services/partnerUsers"

const router = Router()

// GET / — lista de cuentas del socio externo, para Configuración
router.get("/", async (_req, res, next) => {
  try {
    res.json(await listPartnerUsers())
  } catch (err) {
    next(err)
  }
})

// POST / — crea una cuenta nueva (una por persona de Skandia), contraseña fijada a mano
router.post("/", async (req, res, next) => {
  try {
    const parsed = CreatePartnerUserBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    res.status(201).json(await createPartnerUser(parsed.data))
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      res.status(409).json({ error: "Ya existe una cuenta con ese correo" })
      return
    }
    next(err)
  }
})

// PATCH /:id/desactivar — apaga el acceso de una persona puntual sin tocar las demás cuentas
router.patch("/:id/desactivar", async (req, res, next) => {
  try {
    res.json(await setPartnerUserActive(req.params.id, false))
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/reactivar
router.patch("/:id/reactivar", async (req, res, next) => {
  try {
    res.json(await setPartnerUserActive(req.params.id, true))
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/contrasena — reset manual, sin flujo de correo (decisión del usuario)
router.patch("/:id/contrasena", async (req, res, next) => {
  try {
    const parsed = ResetPasswordBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    await resetPartnerUserPassword(req.params.id, parsed.data.password)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
