import "dotenv/config"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import { env } from "./config/env"
import { requireAuth, requireAdmin } from "./middleware/auth"
import loginRouter from "./routers/login"
import prospectosRouter from "./routers/prospectos"
import citasRouter from "./routers/citas"
import metaRouter from "./routers/meta"
import dashboardRouter from "./routers/dashboard"
import usersRouter from "./routers/users"
import informePdfRouter from "./routers/informePdf"

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

// --- Login — única puerta de entrada, staff y Skandia por igual (app 100%
// separada de la intranet, decisión del usuario 2026-07-28). GET /me exige sesión. ---
app.use("/api/login", loginRouter)

// --- Todo lo demás exige sesión vigente ---
app.use("/api", requireAuth)
app.use("/api/prospectos", prospectosRouter)
app.use("/api/citas", citasRouter)
app.use("/api/meta", metaRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/informe/pdf", informePdfRouter)
// Gestión de cuentas — solo administradores
app.use("/api/users", requireAdmin, usersRouter)

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
