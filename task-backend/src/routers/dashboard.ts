import { Router, Request, Response } from "express"
import { z } from "zod"
import * as dashboardService from "../services/dashboardService"

const router = Router()

const teamQuery = z.object({
  teamId: z.string().regex(/^\d+$/).transform(Number),
  desde: z.string().optional(),
  hasta: z.string().optional(),
})

// ─── GET /api/dashboard/team-kpis ────────────────────────────────────────────
router.get("/team-kpis", async (req: Request, res: Response) => {
  const { teamId, desde, hasta } = teamQuery.parse(req.query)
  const data = await dashboardService.getTeamKpis(req.user!, teamId, { desde, hasta })
  res.json(data)
})

// ─── GET /api/dashboard/person-summaries ─────────────────────────────────────
router.get("/person-summaries", async (req: Request, res: Response) => {
  const { teamId, desde, hasta } = teamQuery.parse(req.query)
  const token = req.headers.authorization?.slice(7)
  const data = await dashboardService.getPersonSummaries(req.user!, teamId, { desde, hasta }, token)
  res.json(data)
})

// ─── GET /api/dashboard/charts ────────────────────────────────────────────────
router.get("/charts", async (req: Request, res: Response) => {
  const { teamId, desde, hasta } = teamQuery.parse(req.query)
  const data = await dashboardService.getCharts(req.user!, teamId, { desde, hasta })
  res.json(data)
})

// ─── GET /api/dashboard/without-entry-today ───────────────────────────────────
router.get("/without-entry-today", async (req: Request, res: Response) => {
  const { teamId } = z
    .object({ teamId: z.string().regex(/^\d+$/).transform(Number) })
    .parse(req.query)
  const token = req.headers.authorization?.slice(7)
  const data = await dashboardService.getMembersWithoutEntryToday(req.user!, teamId, token)
  res.json(data)
})

// ─── GET /api/dashboard/my-kpis ───────────────────────────────────────────────
router.get("/my-kpis", async (req: Request, res: Response) => {
  const { teamId, desde, hasta } = teamQuery.parse(req.query)
  const data = await dashboardService.getMyKpis(req.user!, teamId, { desde, hasta })
  res.json(data)
})

export default router
