import "dotenv/config"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import path from "path"
import { env } from "./config/env"
import { authenticate } from "./middleware/auth"
import { errorHandler } from "./middleware/errorHandler"
import teamsRouter from "./routers/teams"
import tasksRouter from "./routers/tasks"
import { taskAttachmentsRouter, attachmentActionsRouter } from "./routers/attachments"
import eventsRouter from "./routers/events"
import dashboardRouter from "./routers/dashboard"
import listConfigsRouter from "./routers/listConfigs"
import exportsRouter from "./routers/exports"
import aiRouter from "./routers/ai"

const app = express()

// --- Middleware ---
app.use(
  cors({
    origin: env.CORS_ORIGIN ?? "*",
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "X-Internal-Key"],
  })
)
app.use(express.json())

// --- Static uploads (before auth so thumbnails load in browser) ---
app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)))

// --- Health check ---
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "task-backend", version: "2.0.0" })
})

// --- Auth guard for all /api routes ---
app.use("/api", authenticate)

// --- Routers ---
app.use("/api/teams", teamsRouter)
app.use("/api/teams/:teamId/lists", listConfigsRouter)
app.use("/api/tasks", tasksRouter)
app.use("/api/tasks", taskAttachmentsRouter)    // POST/GET /api/tasks/:id/attachments
app.use("/api/attachments", attachmentActionsRouter)
app.use("/api/events", eventsRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/exports", exportsRouter)
app.use("/api/ai", aiRouter)

// --- 404 handler ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" })
})

// --- Global error handler ---
app.use(errorHandler as (err: Error, req: Request, res: Response, next: NextFunction) => void)

// --- Start server ---
if (require.main === module) {
  const { startScheduler } = require("./jobs/scheduler")
  startScheduler()

  app.listen(env.PORT, () => {
    console.log(`task-backend listening on port ${env.PORT}`)
  })
}

export default app
