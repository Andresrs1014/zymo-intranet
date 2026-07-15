import { Router, Request, Response } from "express"
import { z } from "zod"
import { DirectoryCacheTipo } from "@prisma/client"
import { requireDirectoryManager } from "../utils/permissions"
import { searchDirectoryCache, getDirectoryCacheStats } from "../services/directoryCacheService"
import { syncDirectoryCache } from "../services/directoryCacheSync"

const router = Router()

function bearerToken(req: Request): string | undefined {
  return req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined
}

// GET /api/directory/cache — búsqueda en caché (no escribe ListConfig/TeamMember)
router.get("/cache", async (req: Request, res: Response) => {
  await requireDirectoryManager(req.user!, bearerToken(req))

  const query = z
    .object({
      tipo: z.enum(["persona", "area"]).optional(),
      q: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .parse(req.query)

  const items = await searchDirectoryCache({
    tipo: query.tipo as DirectoryCacheTipo | undefined,
    q: query.q,
    limit: query.limit,
  })
  res.json(items)
})

// GET /api/directory/stats — conteos y última sync
router.get("/stats", async (req: Request, res: Response) => {
  await requireDirectoryManager(req.user!, bearerToken(req))
  const stats = await getDirectoryCacheStats()
  res.json(stats)
})

// POST /api/directory/sync — job manual → directory_cache únicamente
router.post("/sync", async (req: Request, res: Response) => {
  await requireDirectoryManager(req.user!, bearerToken(req))
  const result = await syncDirectoryCache()
  res.json(result)
})

export default router
