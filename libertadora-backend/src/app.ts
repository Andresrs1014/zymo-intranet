import "dotenv/config"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import { env } from "./config/env"
import { authenticate, requireLibertadoraAccess, requireGerente, requireLibertadoraPartnerScope } from "./middleware/auth"
import prospectosRouter from "./routers/prospectos"
import citasRouter from "./routers/citas"
import metaRouter from "./routers/meta"
import dashboardRouter from "./routers/dashboard"
import partnerUsersRouter from "./routers/partnerUsers"
import publicLoginRouter from "./routers/public/login"
import publicMetaRouter from "./routers/public/meta"

const app = express()

app.use(
  cors({
    origin: env.CORS_ORIGIN ?? "*",
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
)
app.use(express.json())

// --- Health check ---
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "libertadora-backend" })
})

// --- Login del socio externo (Skandia) — usuario y contraseña, sin cuenta en
// la intranet. Se monta antes de requireLibertadoraAccess/authenticate. ---
app.use("/public/login", publicLoginRouter)

// --- Acceso público del socio externo tras login — mismos routers que el
// staff interno usa, solo cambia el middleware de autenticación. Lectura +
// edición completa, decisión explícita del usuario (no solo lectura). ---
app.use("/public/prospectos", requireLibertadoraPartnerScope, prospectosRouter)
app.use("/public/citas", requireLibertadoraPartnerScope, citasRouter)
// Meta comercial — Skandia solo lectura (GET), la edición sigue siendo solo del staff.
app.use("/public/meta", requireLibertadoraPartnerScope, publicMetaRouter)

// --- Staff interno (JWT normal de la intranet) ---
app.use("/api", authenticate, requireLibertadoraAccess)
app.use("/api/prospectos", prospectosRouter)
app.use("/api/citas", citasRouter)
app.use("/api/meta", metaRouter)
app.use("/api/dashboard", dashboardRouter)
// Gestión de cuentas del socio externo — "Usuarios externos" en Configuración
app.use("/api/partner-users", requireGerente, partnerUsersRouter)

// --- 404 handler ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" })
})

// --- Error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: "Internal server error" })
})

// --- Start server ---
if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`libertadora-backend listening on port ${env.PORT}`)
  })
}

export default app
