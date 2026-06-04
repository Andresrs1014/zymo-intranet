import "dotenv/config"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import { env } from "./config/env"
import { authenticate } from "./middleware/auth"
import areasRouter from "./routers/areas"
import procedimientosRouter from "./routers/procedimientos"
import commitsRouter from "./routers/commits"

const app = express()

app.use(cors({
  origin: env.CORS_ORIGIN ?? "*",
  credentials: true,
  allowedHeaders: ["Authorization", "Content-Type"],
}))
app.use(express.json({ limit: "10mb" })) // markdown puede ser largo

// Health check (sin auth)
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "sig-backend" })
})

// Rutas protegidas con JWT
app.use("/api", authenticate)
app.use("/api/areas", areasRouter)
app.use("/api/procedimientos", procedimientosRouter)
app.use("/api/commits", commitsRouter)

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" })
})

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: "Error interno del servidor" })
})

if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`sig-backend escuchando en puerto ${env.PORT}`)
  })
}

export default app
