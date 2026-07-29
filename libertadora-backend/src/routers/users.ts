import { Router } from "express"
import {
  CreateUserBody,
  ResetPasswordBody,
  listUsers,
  createUser,
  setUserActive,
  setUserAdmin,
  resetUserPassword,
} from "../services/users"

const router = Router()

// GET / — lista de cuentas (staff + Skandia, todas del mismo tipo)
router.get("/", async (_req, res, next) => {
  try {
    res.json(await listUsers())
  } catch (err) {
    next(err)
  }
})

// POST / — crea una cuenta nueva, contraseña fijada a mano por un admin
router.post("/", async (req, res, next) => {
  try {
    const parsed = CreateUserBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    res.status(201).json(await createUser(parsed.data))
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      res.status(409).json({ error: "Ya existe una cuenta con ese correo" })
      return
    }
    next(err)
  }
})

router.patch("/:id/desactivar", async (req, res, next) => {
  try {
    res.json(await setUserActive(req.params.id, false))
  } catch (err) {
    next(err)
  }
})

router.patch("/:id/reactivar", async (req, res, next) => {
  try {
    res.json(await setUserActive(req.params.id, true))
  } catch (err) {
    next(err)
  }
})

router.patch("/:id/admin", async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.body?.isAdmin)
    res.json(await setUserAdmin(req.params.id, isAdmin))
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
    await resetUserPassword(req.params.id, parsed.data.password)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
