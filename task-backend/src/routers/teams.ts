import { Router, Request, Response } from "express"
import { z } from "zod"
import { requireManageAccess, requireMembership } from "../utils/permissions"
import { idParamSchema, userIdParamSchema } from "../utils/validators"
import * as teamService from "../services/teamService"

import { isAdmin } from "../middleware/auth"

const router = Router()

// ─── GET /api/teams ────────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) {
    res.status(403).json({ error: "No autorizado" })
    return
  }
  const teams = await teamService.getAllActiveTeams()
  res.json(teams)
})

// ─── GET /api/teams/my-teams ──────────────────────────────────────────────────
router.get("/my-teams", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined
  const teams = await teamService.getMyTeams(req.user!, token)
  res.json(teams)
})

// ─── GET /api/teams/managed ───────────────────────────────────────────────────
router.get("/managed", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined
  const teams = await teamService.getManagedTeams(req.user!, token)
  res.json(teams)
})

// ─── POST /api/teams ──────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  const { name } = z.object({ name: z.string() }).parse(req.body)
  const token = req.headers.authorization!.slice(7)
  const team = await teamService.createTeam(req.user!, name, token)
  res.status(201).json(team)
})

// ─── DELETE /api/teams/:id ────────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params)
  await teamService.deleteTeam(req.user!, id)
  res.status(204).send()
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
  const { userId, userNombre } = z.object({
    userId: z.number().int().positive(),
    userNombre: z.string().max(120).optional(),
  }).parse(req.body)
  const token = req.headers.authorization!.slice(7)
  const member = await teamService.addMember(req.user!, id, userId, userNombre, token)
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

// ─── GET /api/teams/user/:userId ──────────────────────────────────────────────
router.get("/user/:userId", async (req: Request, res: Response) => {
  const { userId } = userIdParamSchema.parse(req.params)
  if (!isAdmin(req.user!)) {
    res.status(403).json({ error: "Solo administradores pueden consultar equipos de otros usuarios" })
    return
  }
  const result = await teamService.getUserTeams(userId)
  res.json(result)
})

// ─── POST /api/teams/admin/assign-owner ────────────────────────────────────────
router.post("/admin/assign-owner", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) {
    res.status(403).json({ error: "No autorizado" })
    return
  }
  const body = z.object({
    userId: z.number().int().positive(),
    teamId: z.number().int().positive().optional(),
    newTeamName: z.string().min(1).optional(),
  }).parse(req.body)

  const result = await teamService.adminAssignOwner(body.userId, body.teamId, body.newTeamName)
  res.json(result)
})

// ─── POST /api/teams/admin/assign-member ───────────────────────────────────────
router.post("/admin/assign-member", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) {
    res.status(403).json({ error: "No autorizado" })
    return
  }
  const body = z.object({
    userId: z.number().int().positive(),
    teamId: z.number().int().positive(),
  }).parse(req.body)

  const result = await teamService.adminAssignMember(body.userId, body.teamId)
  res.json(result)
})

// ─── POST /api/teams/admin/remove-member ───────────────────────────────────────
router.post("/admin/remove-member", async (req: Request, res: Response) => {
  if (!isAdmin(req.user!)) {
    res.status(403).json({ error: "No autorizado" })
    return
  }
  const body = z.object({
    userId: z.number().int().positive(),
    teamId: z.number().int().positive(),
  }).parse(req.body)

  const result = await teamService.adminRemoveMember(body.userId, body.teamId)
  res.json(result)
})

export default router
