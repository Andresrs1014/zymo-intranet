import { Router } from "express"
import { prisma } from "../../config/prisma"

const router = Router()

// Solo lectura para el socio externo (Skandia) — decisión explícita del
// usuario: ven la meta comercial, no la editan. La edición sigue solo en
// /api/meta (staff).
router.get("/", async (_req, res, next) => {
  try {
    const meta = await prisma.libertadoraMeta.findUnique({ where: { id: 1 } })
    res.json(meta ?? { id: 1, metaMensual: null, metaAnual: null, metaCierres: null, metaCitas: null })
  } catch (err) {
    next(err)
  }
})

export default router
