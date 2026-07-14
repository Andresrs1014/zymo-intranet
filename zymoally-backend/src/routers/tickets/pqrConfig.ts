import { Router } from "express"
import { z } from "zod"
import { prisma } from "../../config/prisma"
import { requireTicketsConfig } from "../../middleware/auth"
import { PQR_LIST_TYPES, defaultAreaPrefixes, defaultPqrConfig } from "../../utils/constants"
import { normalizePrefix } from "../../utils/formatters"
import { syncMasterData } from "../../services/masterDataSync"

const router = Router()

// GET /listas — maestros agrupados por listType (patrón renderPqrOptions, app.js:544-599)
router.get("/listas", async (_req, res, next) => {
  try {
    const items = await prisma.zymoConfigList.findMany({ where: { isActive: true }, orderBy: [{ listType: "asc" }, { sortOrder: "asc" }, { id: "asc" }] })
    const grouped = Object.fromEntries(PQR_LIST_TYPES.map((type) => [type, items.filter((i) => i.listType === type).map((i) => ({ id: i.id, value: i.value, label: i.label }))]))
    res.json(grouped)
  } catch (err) {
    next(err)
  }
})

// GET /areas — prefijos por área (patrón areaPrefixes, app.js:30-35)
router.get("/areas", async (_req, res, next) => {
  try {
    const items = await prisma.zymoAreaPrefix.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })
    res.json(items)
  } catch (err) {
    next(err)
  }
})

const ListItemBody = z.object({
  listType: z.enum(PQR_LIST_TYPES),
  value: z.string().min(1),
  label: z.string().min(1),
  sortOrder: z.number().int().optional(),
})

router.post("/listas", requireTicketsConfig, async (req, res, next) => {
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

router.patch("/listas/:id", requireTicketsConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const body = ListItemUpdateBody.parse(req.body)
    const item = await prisma.zymoConfigList.update({ where: { id }, data: body })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

router.delete("/listas/:id", requireTicketsConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    await prisma.zymoConfigList.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

const AreaPrefixBody = z.object({
  area: z.string().min(1),
  prefix: z.string().min(1),
  sortOrder: z.number().int().optional(),
})

router.post("/areas", requireTicketsConfig, async (req, res, next) => {
  try {
    const body = AreaPrefixBody.parse(req.body)
    const item = await prisma.zymoAreaPrefix.create({ data: { ...body, prefix: normalizePrefix(body.prefix) } })
    res.status(201).json(item)
  } catch (err) {
    next(err)
  }
})

const AreaPrefixUpdateBody = z.object({
  area: z.string().min(1).optional(),
  prefix: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

router.patch("/areas/:id", requireTicketsConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const body = AreaPrefixUpdateBody.parse(req.body)
    const item = await prisma.zymoAreaPrefix.update({
      where: { id },
      data: { ...body, prefix: body.prefix ? normalizePrefix(body.prefix) : undefined },
    })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

router.delete("/areas/:id", requireTicketsConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    await prisma.zymoAreaPrefix.delete({ where: { id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// POST /reset — restaura maestros por defecto (patrón resetPqrConfigBtn, app.js:1897-1903)
router.post("/reset", requireTicketsConfig, async (_req, res, next) => {
  try {
    await prisma.$transaction([
      prisma.zymoConfigList.deleteMany({}),
      prisma.zymoAreaPrefix.deleteMany({}),
      prisma.zymoConfigList.createMany({
        data: PQR_LIST_TYPES.flatMap((listType) =>
          defaultPqrConfig[listType].map((value, index) => ({ listType, value, label: value, sortOrder: index }))
        ),
      }),
      prisma.zymoAreaPrefix.createMany({
        data: defaultAreaPrefixes.map((item, index) => ({ ...item, sortOrder: index })),
      }),
    ])
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// POST /sync — sincroniza áreas/plataformas/personas desde el directorio intranet.
// Gate mod_tickets_config (botón temporal; la pantalla de config global es F5).
router.post("/sync", requireTicketsConfig, async (_req, res, next) => {
  try {
    const result = await syncMasterData()
    res.json(result)
  } catch (err) {
    // syncMasterData lanza mensajes pensados para mostrarse al usuario (lock
    // en curso, cuenta de servicio mal configurada, error del directorio
    // intranet) — el handler global descarta err.message, así que se
    // responde aquí para que el botón manual muestre la razón real.
    if (err instanceof Error) {
      res.status(409).json({ error: err.message })
      return
    }
    next(err)
  }
})

export default router
