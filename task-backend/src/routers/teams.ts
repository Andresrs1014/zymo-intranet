import { Router, Request, Response } from "express"
import { z } from "zod"
import { requireManageAccess, requireMembership } from "../utils/permissions"
import { idParamSchema, userIdParamSchema } from "../utils/validators"
import * as teamService from "../services/teamService"

const router = Router()

// ─── GET /api/teams/my-teams ──────────────────────────────────────────────────
router.get("/my-teams", async (req: Request, res: Response) => {
  const teams = await teamService.getMyTeams(req.user!)
  res.json(teams)
})

// ─── GET /api/teams/managed ───────────────────────────────────────────────────
router.get("/managed", async (req: Request, res: Response) => {
  const teams = await teamService.getManagedTeams(req.user!)
  res.json(teams)
})

// ─── POST /api/teams ──────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const { name } = z.object({ name: z.string() }).parse(req.body)
  const team = await teamService.createTeam(req.user!, name)
  res.status(201).json(team)
})

// ─── PATCH /api/teams/:id ─────────────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const { name } = z.object({ name: z.string() }).parse(req.body)
  const result = await teamService.renameTeam(req.user!, id, name)
  res.json(result)
})

// ─── GET /api/teams/:id/members ───────────────────────────────────────────────
router.get("/:id/members", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await requireMembership(req.user!, id)
  const members = await teamService.getTeamMembers(id)
  res.json(members)
})

// ─── GET /api/teams/:id/available-users ──────────────────────────────────────
router.get("/:id/available-users", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await requireManageAccess(req.user!, id)
  const token = req.headers.authorization!.slice(7)
  const users = await teamService.getAvailableUsers(id, token)
  res.json(users)
})

// ─── POST /api/teams/:id/members ──────────────────────────────────────────────
router.post("/:id/members", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await requireManageAccess(req.user!, id)
  const { userId } = z.object({ userId: z.number().int().positive() }).parse(req.body)
  const member = await teamService.addMember(req.user!, id, userId)
  res.status(201).json(member)
})

// ─── DELETE /api/teams/:id/members/:userId ────────────────────────────────────
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const { userId } = userIdParamSchema.parse(req.params)
  await requireManageAccess(req.user!, id)
  await teamService.removeMember(req.user!, id, userId)
  res.status(204).send()
})

// ─── POST /api/teams/:id/members/:userId/promote ──────────────────────────────
router.post("/:id/members/:userId/promote", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const { userId } = userIdParamSchema.parse(req.params)
  // promoteMember enforces owner-only internally
  await teamService.promoteMember(req.user!, id, userId)
  res.status(204).send()
})

// ─── POST /api/teams/:id/members/:userId/demote ───────────────────────────────
router.post("/:id/members/:userId/demote", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  const { userId } = userIdParamSchema.parse(req.params)
  // demoteMember enforces owner-only internally
  await teamService.demoteMember(req.user!, id, userId)
  res.status(204).send()
})

export default router
