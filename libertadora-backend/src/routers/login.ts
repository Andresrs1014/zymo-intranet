import { Router } from "express"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { env } from "../config/env"
import { verifyLogin } from "../services/users"
import { requireAuth } from "../middleware/auth"

const router = Router()

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

const SESSION_TTL = "7d"

// POST /api/login — única puerta de entrada, staff y Skandia por igual
router.post("/", async (req, res, next) => {
  try {
    const parsed = LoginBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Correo y contraseña son obligatorios" })
      return
    }
    const user = await verifyLogin(parsed.data.email, parsed.data.password)
    if (!user) {
      res.status(401).json({ error: "Correo o contraseña incorrectos" })
      return
    }
    const token = jwt.sign(
      { scope: "libertadora_session", userId: user.id },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: SESSION_TTL }
    )
    res.json({ token, nombre: user.nombre, email: user.email, isAdmin: user.isAdmin })
  } catch (err) {
    next(err)
  }
})

// GET /api/login/me — confirma sesión vigente y trae el estado fresco (isAdmin puede cambiar en caliente)
router.get("/me", requireAuth, (req, res) => {
  res.json(req.appUser)
})

export default router
