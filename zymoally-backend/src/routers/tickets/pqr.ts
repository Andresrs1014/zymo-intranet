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
import { notifyTicketReceived, notifyTicketAssigned } from "../../services/emailService"
import { ticketQualityScore } from "../../services/scoreMetrics"
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
  analystEmails: string[]
  coordinatorEmail: string | null
}

function canManageTicket(user: AuthPayload | undefined, ticket: AssignableTicket): boolean {
  if (!user) return false
  const role = user.role
  const perms = user.app_permissions ?? []
  if (role === "admin" || role === "gerente" || perms.includes("mod_tickets_config")) return true

  const assignedEmails = [ticket.supervisorEmail, ...ticket.analystEmails, ticket.coordinatorEmail]
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

function hasOverride(user: AuthPayload | undefined): boolean {
  if (!user) return false
  const perms = user.app_permissions ?? []
  return user.role === "admin" || perms.includes("mod_tickets_config") || perms.includes("mod_tickets_gerencia")
}

// ─── Flujo por etapas: asignación (supervisor), listo (analista), validación (gerencia) ───

/** Solo el supervisor asignado al ticket puede formalizar la asignación de analistas. */
function canAssignTicket(user: AuthPayload | undefined, ticket: { supervisorEmail: string | null }): boolean {
  if (!user) return false
  if (hasOverride(user)) return true
  const userEmail = (user.email ?? "").toLowerCase()
  return Boolean(ticket.supervisorEmail) && ticket.supervisorEmail!.toLowerCase() === userEmail
}

/** Solo un analista asignado al ticket puede marcarlo listo para validación. */
function canMarkReady(user: AuthPayload | undefined, ticket: { analystEmails: string[] }): boolean {
  if (!user) return false
  if (hasOverride(user)) return true
  const userEmail = (user.email ?? "").toLowerCase()
  return ticket.analystEmails.map((e) => e.toLowerCase()).includes(userEmail)
}

/** Validar/cerrar es supervisión independiente — no depende de quién esté asignado al ticket. */
function canValidateTicket(user: AuthPayload | undefined): boolean {
  if (!user) return false
  const perms = user.app_permissions ?? []
  return user.role === "admin" || perms.includes("mod_tickets_gerencia")
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

const jsonArray = z.preprocess(
  (v) => (typeof v === "string" ? JSON.parse(v) : v),
  z.array(z.string()),
)

const CreateTicketBody = z.object({
  area: z.string().min(1),
  areaPrefix: z.string().min(1),
  client: z.string().optional(),
  platform: z.string().optional(),
  supervisor: z.string().optional(),
  supervisorEmail: z.string().optional(),
  analysts: jsonArray.optional(),
  analystEmails: jsonArray.optional(),
  coordinator: z.string().optional(),
  coordinatorEmail: z.string().optional(),
  manager: z.string().optional(),
  managerEmail: z.string().optional(),
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
        { analystEmails: { has: email.toLowerCase() } },
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
          [t.code, t.client, t.owner, t.description, t.type, t.status, t.impact, t.managementCriteria, t.platform, t.supervisor, ...t.analysts, t.coordinator]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : tickets

    const withSla = await attachSla(filtered)
    // qualityScore por ticket (reusa el mismo cálculo del leaderboard agregado
    // de /tickets/dashboard) — necesario para la vista "todos los tickets" de
    // la gerencia (mod_tickets_gerencia), estilo partidas de OP.GG.
    const withScore = withSla.map((t) => ({ ...t, qualityScore: ticketQualityScore(t, t.slaLimitHours) }))
    res.json(withScore)
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

    // supervisor/analista(s)/coordinador/gestiona ahora traen su correo
    // directo del Directorio (el frontend los resuelve contra
    // /operativo/personas/lista-simple o /personas/por-plataforma y los
    // envía ya armados) — el backend ya no resuelve ningún correo aquí.
    const analystEmails = (body.analystEmails ?? []).map((e) => e.toLowerCase())

    const ticket = await createPqrTicketWithCode(body.date, body.areaPrefix, {
      area: body.area,
      client: body.client,
      platform: body.platform,
      supervisor: body.supervisor,
      supervisorEmail: body.supervisorEmail,
      analysts: body.analysts ?? [],
      analystEmails,
      coordinator: body.coordinator,
      coordinatorEmail: body.coordinatorEmail,
      manager: body.manager,
      managerEmail: body.managerEmail,
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
      evidence: files.length ? { create: files.map((f) => ({ filename: f.originalname, url: `/zymoally-uploads/${f.filename}` })) } : undefined,
    })

    // Fase D — notificación de recepción, ahora solo al supervisor/coordinador
    // (flujo por etapas): el analista se entera recién cuando el supervisor lo
    // asigna formalmente vía POST /:id/asignar, no antes. Fire-and-forget: un
    // problema de correo no debe bloquear ni fallar la creación del ticket. El
    // resultado (incluyendo "no había a quién avisar") queda en la bitácora del
    // propio ticket — visible para Planeación sin necesitar logs del servidor.
    const recipients = [body.supervisorEmail, body.coordinatorEmail].filter((e): e is string => Boolean(e))
    notifyTicketReceived(recipients, {
      code: ticket.code,
      area: ticket.area,
      type: ticket.type,
      priority: ticket.priority,
      description: ticket.description,
    })
      .then((result) => {
        if (result === "sent") return
        const texto = result === "no-recipients"
          ? "Notificación de recepción NO enviada: el supervisor/coordinador asignado no tiene correo corporativo registrado en el directorio."
          : "Notificación de recepción NO enviada: falló el envío por ambos SMTP configurados (ver Configuración de la intranet · SMTP corporativo)."
        return prisma.zymoPqrAction.create({ data: { ticketId: ticket.id, texto: `${currentDateValue()} - ${texto}` } })
      })
      .catch((err) => console.error("[email] notifyTicketReceived failed:", err))

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
// ponytail: prefijo /zymoally-uploads/ obligatorio — nginx enruta /uploads/ genérico a helix-backend, no a este servicio
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
        data: files.map((f) => ({ ticketId: id, filename: f.originalname, url: `/zymoally-uploads/${f.filename}` })),
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

// ─── Flujo por etapas ────────────────────────────────────────────────────────

const AsignarBody = z.object({
  analysts: z.array(z.string()).min(1, "Selecciona al menos un analista"),
  analystEmails: z.array(z.string()).min(1, "Selecciona al menos un analista"),
})

// POST /:id/asignar — el supervisor formaliza (o modifica) la asignación de
// analistas. Solo la PRIMERA vez fija originalAnalyst* (auditoría inmutable).
router.post("/:id/asignar", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const parsed = AsignarBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const { analysts, analystEmails } = parsed.data
    const normalizedEmails = analystEmails.map((e) => e.toLowerCase())

    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canAssignTicket(req.user, existing)) {
      res.status(403).json({ error: "Solo el supervisor asignado (o un admin) puede asignar analistas a este ticket" })
      return
    }

    const esPrimeraAsignacion = existing.originalAnalysts.length === 0
    const nuevos = normalizedEmails.filter((e) => !existing.analystEmails.map((x) => x.toLowerCase()).includes(e))

    const ticket = await prisma.zymoPqrTicket.update({
      where: { id },
      data: {
        analysts,
        analystEmails: normalizedEmails,
        ...(esPrimeraAsignacion ? { originalAnalysts: analysts, originalAnalystEmails: normalizedEmails, assignedAt: new Date() } : {}),
        status: existing.status === "Abierto" || existing.status === "En analisis" ? "En gestion" : existing.status,
        actions: { create: [{ texto: `${currentDateValue()} - Analista(s) asignado(s): ${analysts.join(", ")}` }] },
      },
      include: { actions: true, evidence: true },
    })

    if (nuevos.length) {
      notifyTicketAssigned(nuevos, {
        code: ticket.code, area: ticket.area, type: ticket.type, priority: ticket.priority, description: ticket.description,
      }).catch((err) => console.error("[email] notifyTicketAssigned failed:", err))
    }

    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

// PATCH /:id/marcar-listo — el analista pasa el ticket a validación gerencial.
// Bloqueado si no hay evidencia cargada (obligatoria, no opcional en este paso).
router.patch("/:id/marcar-listo", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id }, include: { evidence: true } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (!canMarkReady(req.user, existing)) { denyManage(res); return }
    if (!existing.evidence.length) {
      res.status(400).json({ error: "Debes subir evidencia antes de marcar el ticket como listo para validación" })
      return
    }

    const ticket = await prisma.zymoPqrTicket.update({
      where: { id },
      data: {
        status: "Pendiente validacion",
        readyForValidationAt: new Date(),
        actions: { create: [{ texto: `${currentDateValue()} - Analista marcó el ticket listo para validación gerencial` }] },
      },
      include: { actions: true, evidence: true },
    })
    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

const ValidarCierreBody = z.object({
  accion: z.enum(["cerrar", "regresar"]),
  comentario: z.string().optional(),
})

// PATCH /:id/validar-cierre — la gerencia (mod_tickets_gerencia) valida y
// cierra, o regresa el ticket al analista si la evidencia no está completa.
router.patch("/:id/validar-cierre", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const parsed = ValidarCierreBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    if (!canValidateTicket(req.user)) {
      res.status(403).json({ error: "Solo la gerencia de operaciones (o un admin) puede validar el cierre de tickets" })
      return
    }
    const existing = await prisma.zymoPqrTicket.findUnique({ where: { id } })
    if (!existing) { res.status(404).json({ error: "Ticket no encontrado" }); return }
    if (existing.status !== "Pendiente validacion") {
      res.status(409).json({ error: `El ticket no está pendiente de validación (estado actual: ${existing.status})` })
      return
    }

    const { accion, comentario } = parsed.data
    const nombre = req.user?.full_name || req.user?.email || "Gerencia"
    const ticket = accion === "cerrar"
      ? await prisma.zymoPqrTicket.update({
          where: { id },
          data: {
            status: "Cerrado",
            closedDate: currentDateValue(),
            closedAt: new Date(),
            validatedBy: nombre,
            validatedByEmail: req.user?.email ?? null,
            actions: { create: [{ texto: `${currentDateValue()} - Cierre validado por ${nombre}` }] },
          },
          include: { actions: true, evidence: true },
        })
      : await prisma.zymoPqrTicket.update({
          where: { id },
          data: {
            status: "En gestion",
            actions: { create: [{ texto: `${currentDateValue()} - ${nombre} regresó el ticket a gestión${comentario ? `: ${comentario}` : ""}` }] },
          },
          include: { actions: true, evidence: true },
        })
    res.json(ticket)
  } catch (err) {
    next(err)
  }
})

export default router
