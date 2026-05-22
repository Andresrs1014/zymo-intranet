import { Router } from "express"
import { getDashboardData } from "../services/dashboardService"
import { prisma } from "../config/prisma"

const router = Router()

// GET /api/dashboard — main dashboard data
router.get("/", async (req, res, next) => {
  try {
    const { subproyectoId } = req.query
    const spId =
      subproyectoId !== undefined && subproyectoId !== ""
        ? parseInt(subproyectoId as string, 10)
        : undefined

    if (spId !== undefined && isNaN(spId)) {
      res.status(400).json({ error: "subproyectoId inválido" })
      return
    }

    const data = await getDashboardData(spId)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /api/dashboard/flujo — activities grouped by subproject for flow panel
router.get("/flujo", async (req, res, next) => {
  try {
    const { subproyectoId } = req.query
    const spId =
      subproyectoId !== undefined && subproyectoId !== ""
        ? parseInt(subproyectoId as string, 10)
        : undefined

    if (spId !== undefined && isNaN(spId)) {
      res.status(400).json({ error: "subproyectoId inválido" })
      return
    }

    const where = spId !== undefined ? { id: spId } : {}

    const subproyectos = await prisma.helixSubproyecto.findMany({
      where,
      include: {
        actividades: {
          select: {
            id: true,
            nombre: true,
            estado: true,
            avance: true,
            responsableNombre: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = subproyectos.map((sp) => ({
      id: sp.id,
      nombre: sp.nombre,
      actividades: sp.actividades,
    }))

    res.json({ subproyectos: result })
  } catch (err) {
    next(err)
  }
})

export default router
