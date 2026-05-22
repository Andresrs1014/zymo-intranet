import { Router } from "express"
import { env } from "../config/env"

const router = Router()

router.get("/", async (req, res, next) => {
  try {
    const response = await fetch(`${env.INTRANET_API_URL}/api/admin/usuarios`, {
      headers: {
        Authorization: req.headers.authorization ?? "",
      },
    })
    if (!response.ok) {
      res.status(response.status).json({ error: "Error al obtener usuarios" })
      return
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

export default router
