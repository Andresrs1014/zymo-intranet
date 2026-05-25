import { Router, Request, Response } from "express"
import { z } from "zod"
import { idParamSchema } from "../utils/validators"
import { parsePagination, setPaginationHeaders } from "../utils/pagination"
import * as taskService from "../services/taskService"
import type { Priority } from "@prisma/client"

const router = Router()

const priorityValues: Priority[] = ["baja", "media", "alta", "critica"]

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const body = z
    .object({
      teamId: z.number().int().positive(),
      titulo: z.string(),
      descripcionTecnica: z.string().optional(),
      etiqueta: z.string(),
      plataforma: z.string(),
      estado: z.string().optional(),
      prioridad: z.enum(["baja", "media", "alta", "critica"]).optional(),
      fecha: z.string(),
      asignadoAId: z.number().int().positive().optional(),
      asignadoANombre: z.string().optional(),
      impacto: z.string().optional(),
      tiempoEstimadoMinutos: z.number().int().positive().optional(),
      modalidad: z.string().optional(),
      sede: z.string().optional(),
    })
    .parse(req.body)

  const task = await taskService.createTask(req.user!, body)
  res.status(201).json(task)
})

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const q = req.query
  const pagination = parsePagination(req)

  const filters: taskService.TaskFilters = {
    teamId: q.teamId ? Number(q.teamId) : undefined,
    search: q.search ? String(q.search) : undefined,
    estado: q.estado ? String(q.estado) : undefined,
    etiqueta: q.etiqueta ? String(q.etiqueta) : undefined,
    plataforma: q.plataforma ? String(q.plataforma) : undefined,
    fechaDesde: q.fechaDesde ? String(q.fechaDesde) : undefined,
    fechaHasta: q.fechaHasta ? String(q.fechaHasta) : undefined,
    responsableId: q.responsableId ? Number(q.responsableId) : undefined,
    prioridad: priorityValues.includes(q.prioridad as Priority)
      ? (q.prioridad as Priority)
      : undefined,
  }

  const { total, tasks } = await taskService.listTasks(req.user!, filters, pagination)
  setPaginationHeaders(res, total, pagination.page, pagination.limit)
  res.json(tasks)
})

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const task = await taskService.getTask(id, req.user!)
  res.json(task)
})

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const body = z
    .object({
      titulo: z.string().optional(),
      descripcionTecnica: z.string().nullable().optional(),
      descripcionGerencial: z.string().nullable().optional(),
      impacto: z.string().nullable().optional(),
      etiqueta: z.string().optional(),
      plataforma: z.string().optional(),
      estado: z.string().optional(),
      prioridad: z.enum(["baja", "media", "alta", "critica"]).optional(),
      fecha: z.string().optional(),
      asignadoAId: z.number().int().positive().nullable().optional(),
      asignadoANombre: z.string().nullable().optional(),
      tiempoEstimadoMinutos: z.number().int().positive().nullable().optional(),
      modalidad: z.string().nullable().optional(),
      sede: z.string().nullable().optional(),
      horaInicio: z.string().nullable().optional(),
      horaCierre: z.string().nullable().optional(),
      version: z.number().int().positive(),
    })
    .parse(req.body)

  const task = await taskService.updateTask(id, req.user!, body)
  res.json(task)
})

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await taskService.deleteTask(id, req.user!)
  res.status(204).send()
})

// ─── GET /api/tasks/:id/history ───────────────────────────────────────────────
router.get("/:id/history", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const logs = await taskService.getTaskHistory(id, req.user!)
  res.json(logs)
})

// ─── PATCH /api/tasks/:id/accept ─────────────────────────────────────────────
router.patch("/:id/accept", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const { aceptacion } = z
    .object({ aceptacion: z.enum(["aceptada", "rechazada"]) })
    .parse(req.body)
  await taskService.acceptOrRejectTask(id, req.user!, aceptacion)
  res.status(204).send()
})

export default router
