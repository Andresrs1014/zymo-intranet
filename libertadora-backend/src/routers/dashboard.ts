import { Router } from "express"
import { kpis } from "../services/prospectos"

const router = Router()

router.get("/kpis", async (_req, res, next) => {
  try {
    res.json(await kpis())
  } catch (err) {
    next(err)
  }
})

export default router
