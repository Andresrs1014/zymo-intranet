import { Router, Request, Response } from "express"
import { z } from "zod"
import * as aiService from "../services/aiService"

const router = Router()

// ─── POST /api/ai/suggestions ─────────────────────────────────────────────────
router.post("/suggestions", async (req: Request, res: Response) => {
  const { titulo } = z.object({ titulo: z.string().min(1) }).parse(req.body)
  const suggestions = await aiService.getSuggestions(titulo)
  res.json(suggestions)
})

export default router
