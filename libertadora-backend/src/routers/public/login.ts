import { Router } from "express"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { env } from "../../config/env"
import { verifyPartnerLogin } from "../../services/partnerUsers"

const router = Router()

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

const SESSION_TTL = "7d"

// POST /public/login — usuario y contraseña del socio externo (Skandia)
router.post("/", async (req, res, next) => {
  try {
    const parsed = LoginBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Correo y contraseña son obligatorios" })
      return
    }
    const user = await verifyPartnerLogin(parsed.data.email, parsed.data.password)
    if (!user) {
      res.status(401).json({ error: "Correo o contraseña incorrectos" })
      return
    }
    const token = jwt.sign(
      { scope: "libertadora_partner", partnerUserId: user.id },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: SESSION_TTL }
    )
    res.json({ token, nombre: user.nombre, email: user.email })
  } catch (err) {
    next(err)
  }
})

export default router
