import { Router } from "express"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "../config/prisma"
import { requireGerente } from "../middleware/auth"

const router = Router()

const BackupBody = z.object({
  entity: z.enum(["prospecto", "cita"]),
  action: z.enum(["create", "update", "delete"]),
  externalId: z.number().int(),
  payload: z.unknown(),
})

// POST / — respaldo append-only que envía libertadora-backend en cada escritura.
// Protegido con el mismo JWT compartido de la intranet; el servicio se
// autofirma un token con rol "admin" (bypass ya existente en requireGerente),
// no hace falta una llave interna nueva para este caso.
router.post("/", requireGerente, async (req, res, next) => {
  try {
    const parsed = BackupBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    const row = await prisma.sigLibertadoraBackup.create({
      data: { ...parsed.data, payload: parsed.data.payload as Prisma.InputJsonValue },
    })
    res.status(201).json({ ok: true, id: row.id })
  } catch (err) {
    next(err)
  }
})

export default router
