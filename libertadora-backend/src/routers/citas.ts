import { Router } from "express"
import { CitaBody, CitaPatch, listCitas, createCita, updateCita, deleteCita } from "../services/citas"

const router = Router()

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listCitas())
  } catch (err) {
    next(err)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const parsed = CitaBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    res.status(201).json(await createCita(parsed.data))
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
    const parsed = CitaPatch.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() })
      return
    }
    res.json(await updateCita(id, parsed.data))
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
    await deleteCita(id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
