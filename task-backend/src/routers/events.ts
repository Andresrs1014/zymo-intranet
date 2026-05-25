import { Router, Request, Response } from "express"
import { z } from "zod"
import { idParamSchema } from "../utils/validators"
import * as eventService from "../services/eventService"

const router = Router()

// ─── POST /api/events ─────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const body = z
    .object({
      teamId: z.number().int().positive(),
      titulo: z.string(),
      descripcion: z.string().optional(),
      plataforma: z.string().optional(),
      prioridad: z.string().optional(),
      modalidad: z.string().optional(),
      sede: z.string().optional(),
      fecha: z.string(),
      horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
      duracionMinutos: z.number().int().positive().optional(),
      participantIds: z.array(z.number().int().positive()).optional(),
    })
    .parse(req.body)

  const event = await eventService.createEvent(req.user!, body)
  res.status(201).json(event)
})

// ─── GET /api/events ──────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const { teamId, fecha } = z
    .object({
      teamId: z.string().regex(/^\d+$/).transform(Number),
      fecha: z.string().optional(),
    })
    .parse(req.query)

  const events = await eventService.listEvents(req.user!, teamId, fecha)
  res.json(events)
})

// ─── PATCH /api/events/:id ────────────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const body = z
    .object({
      titulo: z.string().optional(),
      descripcion: z.string().nullable().optional(),
      plataforma: z.string().nullable().optional(),
      prioridad: z.string().nullable().optional(),
      modalidad: z.string().nullable().optional(),
      sede: z.string().nullable().optional(),
      horaInicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      duracionMinutos: z.number().int().positive().optional(),
    })
    .parse(req.body)

  const event = await eventService.updateEvent(id, req.user!, body)
  res.json(event)
})

// ─── DELETE /api/events/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await eventService.deleteEvent(id, req.user!)
  res.status(204).send()
})

// ─── PATCH /api/events/:id/participants ───────────────────────────────────────
router.patch("/:id/participants", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const { add, remove } = z
    .object({
      add: z.array(z.number().int().positive()).default([]),
      remove: z.array(z.number().int().positive()).default([]),
    })
    .parse(req.body)

  const event = await eventService.updateParticipants(id, req.user!, add, remove)
  res.json(event)
})

// ─── PATCH /api/events/:id/confirm ───────────────────────────────────────────
router.patch("/:id/confirm", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await eventService.confirmAttendance(id, req.user!)
  res.status(204).send()
})

export default router
