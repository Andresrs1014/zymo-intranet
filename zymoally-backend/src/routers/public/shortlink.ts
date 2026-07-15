import { Router } from "express"
import { resolveShortLink } from "../../services/shortLink"

const router = Router()

// GET /s/:code — redirect público, sin auth (mismo nivel que /public/survey)
router.get("/:code", async (req, res, next) => {
  try {
    const url = await resolveShortLink(req.params.code)
    if (!url) {
      res.status(404).send("Link no encontrado o expirado.")
      return
    }
    res.redirect(302, url)
  } catch (err) {
    next(err)
  }
})

export default router
