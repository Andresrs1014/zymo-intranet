import { Router } from "express"
import { z } from "zod"
import { prisma } from "../../config/prisma"
import { requireSacConfig } from "../../middleware/auth"
import { SAC_LIST_TYPES, defaultSacConfig } from "../../utils/constants"

const router = Router()

// GET /listas — opciones de formularios SAC agrupadas por listType (patrón GET /tickets/config/listas)
router.get("/listas", async (_req, res, next) => {
  try {
    const items = await prisma.zymoConfigList.findMany({ where: { isActive: true }, orderBy: [{ listType: "asc" }, { sortOrder: "asc" }, { id: "asc" }] })
    const grouped = Object.fromEntries(SAC_LIST_TYPES.map((type) => [type, items.filter((i) => i.listType === type).map((i) => ({ id: i.id, value: i.value, label: i.label }))]))
    res.json(grouped)
  } catch (err) {
    next(err)
  }
})

const ListItemBody = z.object({
  listType: z.enum(SAC_LIST_TYPES),
  value: z.string().min(1),
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
})

router.post("/listas", requireSacConfig, async (req, res, next) => {
  try {
    const body = ListItemBody.parse(req.body)
    const item = await prisma.zymoConfigList.create({ data: body })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

const ListItemUpdateBody = z.object({
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

router.patch("/listas/:id", requireSacConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const body = ListItemUpdateBody.parse(req.body)
    const item = await prisma.zymoConfigList.update({ where: { id }, data: body })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

router.delete("/listas/:id", requireSacConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    await prisma.zymoConfigList.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// POST /reset — restaura opciones de formularios SAC a sus valores por defecto (patrón POST /tickets/config/reset)
router.post("/reset", requireSacConfig, async (_req, res, next) => {
  try {
    await prisma.$transaction([
      prisma.zymoConfigList.deleteMany({ where: { listType: { in: [...SAC_LIST_TYPES] } } }),
      prisma.zymoConfigList.createMany({
        data: SAC_LIST_TYPES.flatMap((listType) =>
          defaultSacConfig[listType].map((item, index) => ({ listType, value: item.value, label: item.label, sortOrder: index }))
        ),
      }),
    ])
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
