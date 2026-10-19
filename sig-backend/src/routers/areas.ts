import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess } from "../middleware/auth"
import { norm, sincronizarAreas, traerCatalogo } from "../services/areasIntranet"

const router = Router()

const AreaSchema = z.object({
  nombre: z.string().min(1).max(100),
  descripcion: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// GET /api/areas — lista todas las áreas con conteo de procedimientos
router.get("/", async (req: Request, res: Response) => {
  await sincronizarAreas()
  const areas = await prisma.sigArea.findMany({
    where: req.sigAreaIds ? { id: { in: req.sigAreaIds } } : {},
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { procedimientos: true } },
    },
  })
  res.json(areas)
})

// GET /api/areas/:id
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id)
  const area = await prisma.sigArea.findUnique({
    where: { id },
    include: {
      procedimientos: {
        orderBy: { codigo: "asc" },
        select: { id: true, codigo: true, titulo: true, estado: true, updatedAt: true },
      },
    },
  })
  if (!area) { res.status(404).json({ error: "Área no encontrada" }); return }
  res.json(area)
})

// POST /api/areas — las carpetas ya no se crean aquí: se piden desde Organización
router.post("/", (_req: Request, res: Response) => {
  res.status(409).json({ error: "Las carpetas del SIG se piden desde el área: Configuración → Organización → «Dar carpeta en el SIG»." })
})

const DesdeIntranetSchema = z.object({
  intranetAreaId: z.number().int().positive(),
  /** Usar una carpeta que ya existe y no está enlazada, en vez de crear una nueva */
  carpetaId: z.number().int().positive().optional(),
})

// POST /api/areas/desde-intranet — solo admin. Da a un área de la intranet su espacio en el SIG: crea la carpeta o enlaza una existente sin enlace.
router.post("/desde-intranet", requireSigAccess, async (req: Request, res: Response) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Solo admin puede dar carpetas del SIG a un área" }); return }
  const parsed = DesdeIntranetSchema.safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }
  const { intranetAreaId, carpetaId } = parsed.data

  const catalogo = await traerCatalogo()
  if (!catalogo) { res.status(502).json({ error: "No se pudo consultar las áreas de la intranet. Intenta de nuevo." }); return }
  const area = catalogo.find((a) => a.id === intranetAreaId)
  if (!area) { res.status(404).json({ error: "Esa área no existe en la intranet" }); return }
  if (await prisma.sigArea.findUnique({ where: { intranetAreaId } })) { res.status(409).json({ error: "Esa área ya tiene su carpeta en el SIG." }); return }

  const cargos = area.cargos ?? []
  let carpeta
  if (carpetaId !== undefined) {
    const existente = await prisma.sigArea.findUnique({ where: { id: carpetaId } })
    if (!existente) { res.status(404).json({ error: "Carpeta no encontrada" }); return }
    if (existente.intranetAreaId != null) { res.status(409).json({ error: "Esa carpeta ya está enlazada a otra área." }); return }
    carpeta = await prisma.sigArea.update({ where: { id: carpetaId }, data: { intranetAreaId, cargos } }) // conserva su nombre y su contenido
  } else {
    const todas = await prisma.sigArea.findMany({ select: { nombre: true } })
    if (todas.some((c) => norm(c.nombre) === norm(area.name))) {
      res.status(409).json({ error: `Ya existe una carpeta llamada «${area.name}». Enlázala con esta área o cámbiale el nombre primero.` })
      return
    }
    carpeta = await prisma.sigArea.create({ data: { nombre: area.name, intranetAreaId, cargos } })
  }
  await prisma.sigAreaExcluida.deleteMany({ where: { intranetAreaId } }) // si antes se había quitado a propósito, ya no
  res.status(201).json(carpeta)
})

// POST /api/areas/:id/desenlazar — solo admin. La carpeta se queda con todo su contenido, pero deja de ser la de esa área de la intranet.
router.post("/:id/desenlazar", requireSigAccess, async (req: Request, res: Response) => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Solo admin puede desenlazar carpetas" }); return }
  const id = parseInt(req.params.id)
  const carpeta = await prisma.sigArea.findUnique({ where: { id } })
  if (!carpeta) { res.status(404).json({ error: "Carpeta no encontrada" }); return }
  res.json(await prisma.sigArea.update({ where: { id }, data: { intranetAreaId: null } }))
})

// PATCH /api/areas/:id — admin o gerente. Renombrar la carpeta no cambia el área de la intranet ni el área de nadie.
router.patch("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin" && role !== "gerente") { res.status(403).json({ error: "Solo admin o gerente puede editar áreas" }); return }

  const id = parseInt(req.params.id)
  const parsed = AreaSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }
  const actual = await prisma.sigArea.findUnique({ where: { id } })
  if (!actual) { res.status(404).json({ error: "Área no encontrada" }); return }
  if (parsed.data.nombre !== undefined) {
    parsed.data.nombre = parsed.data.nombre.trim()
    const otras = await prisma.sigArea.findMany({ where: { id: { not: id } }, select: { nombre: true } })
    if (otras.some((o) => norm(o.nombre) === norm(parsed.data.nombre!))) {
      res.status(409).json({ error: "Ya existe una carpeta con ese nombre." })
      return
    }
  }

  const area = await prisma.sigArea.update({ where: { id }, data: parsed.data })
  res.json(area)
})

// POST /api/areas/sincronizar — la intranet avisa que cambió una área (crear, renombrar, borrar): se refleja ya
router.post("/sincronizar", requireSigAccess, async (_req: Request, res: Response) => {
  await sincronizarAreas(true)
  res.status(204).send()
})

// DELETE /api/areas/:id — solo admin, y solo una carpeta vacía. Si venía de un área de la intranet, esa área no se toca:
// se anota como excluida para que la sincronización no la vuelva a crear.
router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin") { res.status(403).json({ error: "Solo admin puede eliminar carpetas del SIG" }); return }

  const id = parseInt(req.params.id)
  const area = await prisma.sigArea.findUnique({ where: { id } })
  if (!area) { res.status(404).json({ error: "Carpeta no encontrada" }); return }
  const [procs, kpis] = await Promise.all([
    prisma.sigProcedimiento.count({ where: { areaId: id } }),
    prisma.sigIndicador.count({ where: { areaId: id } }),
  ])
  if (procs > 0 || kpis > 0) {
    res.status(409).json({ error: "La carpeta tiene contenido (procedimientos o indicadores). Solo se eliminan carpetas vacías." })
    return
  }
  await prisma.$transaction([
    ...(area.intranetAreaId != null
      ? [prisma.sigAreaExcluida.upsert({ where: { intranetAreaId: area.intranetAreaId }, create: { intranetAreaId: area.intranetAreaId }, update: {} })]
      : []),
    prisma.sigArea.delete({ where: { id } }),
  ])
  res.status(204).send()
})

export default router
