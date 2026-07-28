import { Router } from "express"
import { renderToBuffer } from "@react-pdf/renderer"
import { listProspectos, kpis } from "../services/prospectos"
import { InformePdfDocument } from "../services/informePdfDocument"

const router = Router()

// PDF real generado en el servidor -- sin diálogo de impresión del navegador
// de por medio, así que no hay pie de página con la URL que quitar.
router.get("/", async (_req, res, next) => {
  try {
    const [prospectos, resumen] = await Promise.all([listProspectos(), kpis()])
    const buffer = await renderToBuffer(<InformePdfDocument kpis={resumen} prospectos={prospectos} />)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", 'attachment; filename="Informe_SKANDIA_CREA-Libertadora_Seguros.pdf"')
    res.send(buffer)
  } catch (err) {
    next(err)
  }
})

export default router
