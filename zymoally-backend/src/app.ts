import "dotenv/config"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import path from "path"
import { env } from "./config/env"
import { startReminderCron } from "./cron"
import { authenticate, requireSacAccess, requireTicketsAccess } from "./middleware/auth"
import pqrRouter from "./routers/tickets/pqr"
import pqrConfigRouter from "./routers/tickets/pqrConfig"
import pqrDashboardRouter from "./routers/tickets/pqrDashboard"
import pqrAlertasRouter from "./routers/tickets/pqrAlertas"
import surveysRouter from "./routers/sac/surveys"
import experienceRouter from "./routers/sac/experience"
import visitsRouter from "./routers/sac/visits"
import sacDashboardRouter from "./routers/sac/sacDashboard"
import sacAlertasRouter from "./routers/sac/sacAlertas"
import sacConfigRouter from "./routers/sac/sacConfig"
import { ticketsExportRouter, sacExportRouter } from "./routers/export"
import publicSurveyRouter from "./routers/public/survey"
import publicShortLinkRouter from "./routers/public/shortlink"

const app = express()

// --- Middleware ---
app.use(
  cors({
    origin: env.CORS_ORIGIN ?? "*",
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"],
  })
)
app.use(express.json())

// --- Static uploads ---
app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)))

// --- Health check ---
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "zymoally-backend" })
})

// --- Encuesta pública (magic-link, sin login — cliente final) ---
app.use("/public/survey", publicSurveyRouter)

// --- Links cortos (ej. "Enviar encuesta") — redirect público, sin login ---
app.use("/s", publicShortLinkRouter)

// --- Auth ---
app.use("/api", authenticate)

// --- Tickets (dominio PQR) ---
app.use("/api/tickets/pqr", requireTicketsAccess, pqrRouter)
app.use("/api/tickets/config", requireTicketsAccess, pqrConfigRouter)
app.use("/api/tickets/dashboard", requireTicketsAccess, pqrDashboardRouter)
app.use("/api/tickets/alertas", requireTicketsAccess, pqrAlertasRouter)
app.use("/api/tickets/export", requireTicketsAccess, ticketsExportRouter)

// --- SAC (dominio Servicio al Cliente) ---
app.use("/api/sac/surveys", requireSacAccess, surveysRouter)
app.use("/api/sac/experience", requireSacAccess, experienceRouter)
app.use("/api/sac/visits", requireSacAccess, visitsRouter)
app.use("/api/sac/dashboard", requireSacAccess, sacDashboardRouter)
app.use("/api/sac/alertas", requireSacAccess, sacAlertasRouter)
app.use("/api/sac/config", requireSacAccess, sacConfigRouter)
app.use("/api/sac/export", requireSacAccess, sacExportRouter)

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
    console.log(`zymoally-backend listening on port ${env.PORT}`)
  })
  startReminderCron()
}

export default app
