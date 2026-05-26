import { Router, Request, Response } from "express"
import { z } from "zod"
import * as exportService from "../services/exportService"
const router = Router()

const filtersQuery = z.object({
  teamId: z.string().regex(/^\d+$/).transform(Number),
  search: z.string().optional(),
  estado: z.string().optional(),
  etiqueta: z.string().optional(),
  plataforma: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  responsableId: z.string().regex(/^\d+$/).transform(Number).optional(),
  prioridad: z.string().optional(),
})

// ─── GET /api/exports/excel ───────────────────────────────────────────────────
router.get("/excel", async (req: Request, res: Response) => {
  const filters = filtersQuery.parse(req.query)
  await exportService.exportExcel(req.user!, filters as Parameters<typeof exportService.exportExcel>[1], res)
})

// ─── GET /api/exports/pdf ─────────────────────────────────────────────────────
router.get("/pdf", async (req: Request, res: Response) => {
  const filters = filtersQuery.parse(req.query)
  await exportService.exportPdf(req.user!, filters as Parameters<typeof exportService.exportPdf>[1], res)
})

export default router
