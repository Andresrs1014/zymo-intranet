import { Router, Request, Response } from "express"
import { z } from "zod"
import prisma from "../config/prisma"
import { requireSigAccess } from "../middleware/auth"
import { sincronizarAreas } from "../services/areasIntranet"

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

// POST /api/areas — las carpetas ya no se crean aquí: nacen de las áreas de la intranet
router.post("/", (_req: Request, res: Response) => {
  res.status(409).json({ error: "Las carpetas del SIG se crean desde las áreas: Configuración → Organización. Aparecen aquí solas." })
})

// PATCH /api/areas/:id — admin o gerente. El nombre de una carpeta enlazada se cambia en Organización.
router.patch("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin" && role !== "gerente") { res.status(403).json({ error: "Solo admin o gerente puede editar áreas" }); return }

  const id = parseInt(req.params.id)
  const parsed = AreaSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(422).json({ error: parsed.error.flatten() }); return }
  const actual = await prisma.sigArea.findUnique({ where: { id } })
  if (!actual) { res.status(404).json({ error: "Área no encontrada" }); return }
  if (actual.intranetAreaId != null && parsed.data.nombre !== undefined && parsed.data.nombre !== actual.nombre) {
    res.status(409).json({ error: "El nombre viene del área de la intranet: cámbialo en Configuración → Organización." })
    return
  }

  const area = await prisma.sigArea.update({ where: { id }, data: parsed.data })
  res.json(area)
})

// POST /api/areas/sincronizar — la intranet avisa que cambió una área (crear, renombrar, borrar): se refleja ya
router.post("/sincronizar", requireSigAccess, async (_req: Request, res: Response) => {
  await sincronizarAreas(true)
  res.status(204).send()
})

// DELETE /api/areas/:id — solo admin; las carpetas enlazadas desaparecen al borrar el área en Organización
router.delete("/:id", requireSigAccess, async (req: Request, res: Response) => {
  const role = req.user?.role
  if (role !== "admin") { res.status(403).json({ error: "Solo admin puede eliminar áreas" }); return }

  const id = parseInt(req.params.id)
  const area = await prisma.sigArea.findUnique({ where: { id } })
  if (area?.intranetAreaId != null) {
    res.status(409).json({ error: "Esta carpeta pertenece a un área de la intranet; no se elimina desde el SIG." })
    return
  }
  const count = await prisma.sigProcedimiento.count({ where: { areaId: id } })
  if (count > 0) {
    res.status(409).json({ error: "No se puede eliminar un área con procedimientos. Mueve o elimina los procedimientos primero." })
    return
  }
  await prisma.sigArea.delete({ where: { id } })
  res.status(204).send()
})

export default router
