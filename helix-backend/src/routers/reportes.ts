import { Router } from "express"
import { getStatusReport, getSeguimientos } from "../services/reportesService"
import { getROIData } from "../services/roiService"

const router = Router()

// GET /api/reportes — full text status report
router.get("/", async (_req, res, next) => {
  try {
    const reporte = await getStatusReport()
    res.json({ reporte })
  } catch (err) {
    next(err)
  }
})

// GET /api/reportes/roi — ROI data per subproject
router.get("/roi", async (_req, res, next) => {
  try {
    const data = await getROIData()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /api/reportes/seguimientos — follow-up items
router.get("/seguimientos", async (_req, res, next) => {
  try {
    const items = await getSeguimientos()
    res.json(items)
  } catch (err) {
    next(err)
  }
})

export default router
