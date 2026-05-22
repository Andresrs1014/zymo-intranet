import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "./config/env";
import { authenticate } from "./middleware/auth";
import subproyectosRouter from "./routers/subproyectos";
import actividadesRouter from "./routers/actividades";
import comentariosRouter from "./routers/comentarios";
import usuariosRouter from "./routers/usuarios";
import aiRouter from "./routers/ai";

const app = express();

// --- Middleware ---
app.use(
  cors({
    origin: env.CORS_ORIGIN ?? "*",
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "X-Internal-Key"],
  })
);
app.use(express.json());

// --- Health check ---
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "helix-backend" });
});

// --- API Routers ---
app.use("/api", authenticate);
app.use("/api/subproyectos", subproyectosRouter);
app.use("/api/actividades", actividadesRouter);
app.use("/api", comentariosRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/ai", aiRouter);

// --- 404 handler ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// --- Error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// --- Start server ---
if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`helix-backend listening on port ${env.PORT}`);
  });
}

export default app;
