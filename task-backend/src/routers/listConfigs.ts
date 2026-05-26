import { Router, Request, Response } from "express"
import { z } from "zod"
import { idParamSchema } from "../utils/validators"
import * as listConfigService from "../services/listConfigService"

const router = Router({ mergeParams: true })

const listTypeValues = ["estado", "etiqueta", "plataforma", "modalidad", "prioridad", "prioridad_agenda"] as const

// ─── GET /api/teams/:teamId/lists ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const { teamId } = z
    .object({ teamId: z.string().regex(/^\d+$/).transform(Number) })
    .parse(req.params)
  const data = await listConfigService.getLists(req.user!, teamId)
  res.json(data)
})

// ─── POST /api/teams/:teamId/lists ────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const { teamId } = z
    .object({ teamId: z.string().regex(/^\d+$/).transform(Number) })
    .parse(req.params)
  const body = z
    .object({
      listType: z.enum(listTypeValues),
      value: z.string().min(1),
      label: z.string().min(1),
      color: z.string().optional(),
      sortOrder: z.number().int().optional(),
    })
    .parse(req.body)

  const item = await listConfigService.createListItem(req.user!, teamId, body)
  res.status(201).json(item)
})

// ─── PATCH /api/teams/:teamId/lists/:listType/:value ─────────────────────────
router.patch("/:listType/:value", async (req: Request, res: Response) => {
  const { teamId } = z
    .object({ teamId: z.string().regex(/^\d+$/).transform(Number) })
    .parse(req.params)
  const { listType, value } = req.params
  const body = z
    .object({
      label: z.string().optional(),
      color: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .parse(req.body)

  const item = await listConfigService.updateListItem(req.user!, teamId, listType, value, body)
  res.json(item)
})

// ─── DELETE /api/teams/:teamId/lists/:listType/:value ─────────────────────────
router.delete("/:listType/:value", async (req: Request, res: Response) => {
  const { teamId } = z
    .object({ teamId: z.string().regex(/^\d+$/).transform(Number) })
    .parse(req.params)
  const { listType, value } = req.params
  await listConfigService.deleteListItem(req.user!, teamId, listType, value)
  res.status(204).send()
})

// ─── PATCH /api/teams/:teamId/lists/estado/:value/special ────────────────────
router.patch("/estado/:value/special", async (req: Request, res: Response) => {
  const { teamId } = z
    .object({ teamId: z.string().regex(/^\d+$/).transform(Number) })
    .parse(req.params)
  const { value } = req.params
  const flags = z
    .object({
      isFinal: z.boolean().optional(),
      isCanceled: z.boolean().optional(),
      isInitialAssignment: z.boolean().optional(),
    })
    .parse(req.body)

  const item = await listConfigService.setSpecialFlag(req.user!, teamId, value, flags)
  res.json(item)
})

export default router
