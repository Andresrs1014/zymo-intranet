import { Router } from "express"
import { z } from "zod"
import fs from "fs"
import path from "path"
import multer from "multer"
import { prisma } from "../../config/prisma"
import { env } from "../../config/env"
import { createPqrTicketWithCode, previewNextCode } from "../../services/pqrCode"
import { currentDateValue } from "../../utils/formatters"
import { businessHoursBetween } from "../../utils/businessHours"
import { notifyTicketReceived } from "../../services/emailService"
import type { AuthPayload } from "../../middleware/auth"

const router = Router()

// ─── SLA (Fase C) — horas límite configurables por prioridad, no por texto ───

interface SlaTicketFields {
  priority: string
  createdAt: Date
  closedAt: Date | null
}

async function attachSla<T extends SlaTicketFields>(
  tickets: T[],
): Promise<(T & { slaLimitHours: number | null; slaElapsedHours: number; slaOverdue: boolean | null })[]> {
  const priorityRows = await prisma.zymoConfigList.findMany({
    where: { listType: "priorities" },
    select: { value: true, slaHours: true },
  })
  const slaByPriority = new Map(priorityRows.map((r) => [r.value, r.slaHours]))
  const now = new Date()
  return tickets.map((t) => {
    const slaLimitHours = slaByPriority.get(t.priority) ?? null
    const slaElapsedHours = businessHoursBetween(t.createdAt, t.closedAt ?? now)
    const slaOverdue = slaLimitHours != null ? slaElapsedHours > slaLimitHours : null
    return { ...t, slaLimitHours, slaElapsedHours, slaOverdue }
  })
}

// ─── Restricción de gestión (Fase E) — solo el asignado o un admin/config ────

interface AssignableTicket {
  supervisorEmail: string | null
  analystEmail: string | null
  coordinatorEmail: string | null
}

function canManageTicket(user: AuthPayload | undefined, ticket: AssignableTicket): boolean {
  if (!user) return false
  const role = user.role
  const perms = user.app_permissions ?? []
  if (role === "admin" || role === "gerente" || perms.includes("mod_tickets_config")) return true

  const assignedEmails = [ticket.supervisorEmail, ticket.analystEmail, ticket.coordinatorEmail]
    .filter((e): e is string => Boolean(e))
    .map((e) => e.toLowerCase())
  // Sin ningún email asignado en el ticket (dato incompleto/ticket viejo) — no se
  // restringe, para no dejar tickets huérfanos sin nadie que los pueda gestionar.
  if (!assignedEmails.length) return true

  const userEmail = (user.email ?? "").toLowerCase()
  return assignedEmails.includes(userEmail)
}

function denyManage(res: import("express").Response): void {
  res.status(403).json({ error: "Solo el supervisor/analista/coordinador asignado (o un admin) puede gestionar este ticket" })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(env.UPLOAD_DIR)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `pqr_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } })

// Resuelve el email de contacto guardado en ZymoConfigList (sync de directorio) para
// el valor elegido en el select — se fija en el ticket al crear, no cambia si la
// persona rota de cargo después (trazabilidad histórica, ver Fase A del plan de
// "Gestionar mis tickets").
async function resolveContactEmail(listType: string, value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined
  const row = await prisma.zymoConfigList.findFirst({ where: { listType, value }, select: { contactEmail: true } })
  return row?.contactEmail || undefined
}

const CreateTicketBody = z.object({
  area: z.string().min(1),
  areaPrefix: z.string().min(1),
  client: z.string().optional(),
  platform: z.string().optional(),
  supervisor: z.string().optional(),
  analyst: z.string().optional(),
  coordinator: z.string().optional(),
  manager: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  owner: z.string().optional(),
  date: z.string().min(1),
  dueDate: z.string().optional(),
  type: z.string().min(1),
  status: z.string().min(1),
  priority: z.string().min(1),
  impact: z.string().optional(),
  channel: z.string().optional(),
  managementCriteria: z.string().optional(),
  description: z.string().optional(),
  actionsInitial: z.string().optional(),
})

// GET / — lista de tickets con filtros (patrón pqrFilteredTickets, app.js:496-511)
router.get("/", async (req, res, next) => {
  try {
    const { status, type, impact, area, client, supervisor, priority, search, asignadoAMi } = req.query as Record<string, string | undefined>
    const where: Record<string, unknown> = {}
    if (status && status !== "all") where.status = status
    if (type && type !== "all") where.type = type
    if (impact && impact !== "all") where.impact = impact
    if (area && area !== "all") where.area = area
    if (client && client !== "all") where.client = client
    if (supervisor && supervisor !== "all") where.supervisor = supervisor
    if (priority && priority !== "all") where.priority = priority

    if (asignadoAMi === "true") {
      const email = req.user?.email
      if (!email) { res.json([]); return }
      where.OR = [
        { supervisorEmail: { equals: email, mode: "insensitive" } },
        { analystEmail: { equals: email, mode: "insensitive" } },
        { coordinatorEmail: { equals: email, mode: "insensitive" } },
      ]
    }

    const tickets = await prisma.zymoPqrTicket.findMany({
      where,
      include: { actions: { orderBy: { createdAt: "asc" } }, evidence: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    })

    const term = (search || "").trim().toLowerCase()
    const filtered = term
      ? tickets.filter((t) =>
          [t.code, t.client, t.owner, t.description, t.type, t.status, t.impact, t.managementCriteria, t.platform, t.supervisor, t.analyst, t.coordinator]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : tickets

    res.json(await attachSla(filtered))
  } catch (err) {
    next(err)
  }
})

// GET /codigo-preview — previsualiza el próximo código sin crear el ticket
router.get("/codigo-preview", async (req, res, next) => {
  try {
    const { date, areaPrefix } = req.query as Record<string, string | undefined>
    const dateValue = date || currentDateValue()
    const prefix = areaPrefix || "PQR"
    const existing = await prisma.zymoPqrTicket.findMany({
      where: { code: { startsWith: `${prefix.toUpperCase()}-` } },
      select: { code: true },
    })
    res.json({ code: previewNextCode(dateValue, prefix, existing.map((t) => t.code)) })
  } catch (err) {
    next(err)
  }
})

// GET /:id — detalle
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) { res.status(400).json({ error: "ID inválido" }); return }
    const ticket = await prisma.zymoPqrTicket.findUnique({
      where: { id },
      include: { actions: { orderBy: { createdAt: "asc" } }, evidence: { orderBy: { createdAt: "asc" } } },
    })
    if (!ticket) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    const [withSla] = await attachSla([ticket])
    res.json(withSla)
  } catch (err) {
    next(err)
  }
})

// POST / — crear ticket (código autogenerado transaccional)
router.post("/", upload.array("evidence"), async (req, res, next) => {
  try {
    const parsed = CreateTicketBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const body = parsed.data
    const files = (req.files as Express.Multer.File[]) || []

    const [supervisorEmail, analystEmail, coordinatorEmail, managerEmail] = await Promise.all([
      resolveContactEmail("supervisors", body.supervisor),
      resolveContactEmail("analysts", body.analyst),
      resolveContactEmail("coordinators", body.coordinator),
      resolveContactEmail("managers", body.manager),
    ])

    const ticket = await createPqrTicketWithCode(body.date, body.areaPrefix, {
      area: body.area,
      client: body.client,
      platform: body.platform,
      supervisor: body.supervisor,
      supervisorEmail,
      analyst: body.analyst,
      analystEmail,
      coordinator: body.coordinator,
      coordinatorEmail,
      manager: body.manager,
      managerEmail,
      phone: body.phone,
      email: body.email,
      owner: body.owner,
      date: body.date,
      dueDate: body.dueDate,
      type: body.type,
      status: body.status,
      priority: body.priority,
      impact: body.impact,
      channel: body.channel,
      managementCriteria: body.managementCriteria,
      closedDate: /cerrado/i.test(body.status) ? currentDateValue() : undefined,
      closedAt: /cerrado/i.test(body.status) ? new Date() : undefined,
      description: body.description,
      actions: body.actionsInitial ? { create: [{ texto: body.actionsInitial }] } : undefined,
      evidence: files.length ? { create: files.map((f) => ({ filename: f.originalname, url: `/uploads/${f.filename}` })) } : undefined,
    })

    // Fase D — notificación de recepción al área asignada. Fire-and-forget: un
    // problema de correo no debe bloquear ni fallar la creación del ticket.
    const recipients = [supervisorEmail, analystEmail, coordinatorEmail].filter((e): e is string => Boolean(e))
    void notifyTicketReceived(recipients, {
      code: ticket.code,
      area: ticket.area,
      type: ticket.type,
      priority: ticket.priority,
      description: ticket.description,
    }).catch((err) => console.error("[email] notifyTicketReceived failed:", err))

    res.status(201).json(ticket)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/estado — actualizar estado (registra acción, app.js:1797-1811)
router.patch("/:id/estado", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { status } = z.object({ status: z.string().min(1) }).parse(req.body)
    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canManageTicket(req.user, existing)) { denyManage(res); return }

    const entrandoCerrado = /cerrado/i.test(status) && !existing.closedDate
    const ticket = await prisma.zymoPqrTicket.update({
      where: { id },
      data: {
        status,
        closedDate: entrandoCerrado ? currentDateValue() : existing.closedDate,
        closedAt: entrandoCerrado ? new Date() : existing.closedAt,
        actions: { create: [{ texto: `${currentDateValue()} - Estado actualizado a ${status}` }] },
      },
      include: { actions: true, evidence: true },
    })
    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/criterio — actualizar criterio de gestión (app.js:1813-1822)
router.patch("/:id/criterio", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { managementCriteria } = z.object({ managementCriteria: z.string().min(1) }).parse(req.body)
    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canManageTicket(req.user, existing)) { denyManage(res); return }

    const ticket = await prisma.zymoPqrTicket.update({
      where: { id },
      data: {
        managementCriteria,
        actions: { create: [{ texto: `${currentDateValue()} - Criterio de gestion actualizado a ${managementCriteria}` }] },
      },
      include: { actions: true, evidence: true },
    })
    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/fecha-compromiso — fecha de compromiso del área asignada (dueDate)
router.patch("/:id/fecha-compromiso", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { dueDate } = z.object({ dueDate: z.string() }).parse(req.body)
    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canManageTicket(req.user, existing)) { denyManage(res); return }

    const ticket = await prisma.zymoPqrTicket.update({
      where: { id },
      data: {
        dueDate: dueDate || null,
        actions: { create: [{ texto: `${currentDateValue()} - Fecha de compromiso actualizada a ${dueDate || "sin definir"}` }] },
      },
      include: { actions: true, evidence: true },
    })
    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/cierre — fecha de cierre (app.js:1823-1832)
router.patch("/:id/cierre", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { closedDate } = z.object({ closedDate: z.string() }).parse(req.body)
    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canManageTicket(req.user, existing)) { denyManage(res); return }

    const ticket = await prisma.zymoPqrTicket.update({
      where: { id },
      data: {
        closedDate: closedDate || null,
        closedAt: closedDate ? new Date() : null,
        actions: { create: [{ texto: `${currentDateValue()} - Fecha de cierre registrada: ${closedDate || "pendiente"}` }] },
      },
      include: { actions: true, evidence: true },
    })
    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

// POST /:id/acciones — agregar acción manual (app.js:1775-1796)
router.post("/:id/acciones", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { texto } = z.object({ texto: z.string().min(1) }).parse(req.body)
    const ticket = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!ticket) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canManageTicket(req.user, ticket)) { denyManage(res); return }
    const action = await prisma.zymoPqrAction.create({
      data: { ticketId: id, texto: `${currentDateValue()} - ${texto}` },
    })
    res.status(201).json(action)
  } catch (err) {
    next(err)
  }
})

// POST /:id/evidencia — cargar evidencia (multer, patrón helix-backend actividades.ts)
router.post("/:id/evidencia", upload.array("evidence"), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const ticket = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!ticket) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canManageTicket(req.user, ticket)) { denyManage(res); return }
    const files = (req.files as Express.Multer.File[]) || []
    if (!files.length) { res.status(400).json({ error: "Archivo(s) requerido(s)" }); return }

    const names = files.map((f) => f.originalname)
    await prisma.$transaction([
      prisma.zymoPqrEvidence.createMany({
        data: files.map((f) => ({ ticketId: id, filename: f.originalname, url: `/uploads/${f.filename}` })),
      }),
      prisma.zymoPqrAction.create({
        data: { ticketId: id, texto: `${currentDateValue()} - Evidencia cargada en informe: ${names.join(", ")}` },
      }),
    ])

    const updated = await prisma.zymoPqrTicket.findUnique({
      where: { id },
      include: { actions: { orderBy: { createdAt: "asc" } }, evidence: { orderBy: { createdAt: "asc" } } },
    })
    res.status(201).json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
