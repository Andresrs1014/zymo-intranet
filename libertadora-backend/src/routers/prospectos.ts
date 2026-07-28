import { Router } from "express"
import { ProspectoBody, ProspectoPatch, listProspectos, createProspecto, updateProspecto, deleteProspecto } from "../services/prospectos"

const router = Router()

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listProspectos())
  } catch (err) {
    next(err)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const parsed = ProspectoBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    res.status(201).json(await createProspecto(parsed.data))
  } catch (err) {
    next(err)
  }
})

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Id inválido" })
      return
    }
    const parsed = ProspectoPatch.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    res.json(await updateProspecto(id, parsed.data))
  } catch (err) {
    next(err)
  }
})

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Id inválido" })
      return
    }
    await deleteProspecto(id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
