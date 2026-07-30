import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { env } from "./config/env";
import { authenticate } from "./middleware/auth";
import proyectosRouter from "./routers/proyectos";
import subproyectosRouter from "./routers/subproyectos";
import actividadesRouter from "./routers/actividades";
import comentariosRouter from "./routers/comentarios";
import subactividadesRouter from "./routers/subactividades";
import dependenciasRouter from "./routers/dependencias";
import usuariosRouter from "./routers/usuarios";
import aiRouter from "./routers/ai"
import encuestasRouter from "./routers/encuestas"
import dashboardRouter from "./routers/dashboard";
import reportesRouter from "./routers/reportes";
import alertasRouter from "./routers/alertas";
import { startScheduler } from "./jobs/scheduler";

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

// --- Static uploads (before auth so thumbnails load in browser) ---
app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

// --- Health check ---
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "helix-backend" });
});

// --- API Routers ---
app.use("/api", authenticate);
app.use("/api/proyectos", proyectosRouter);
app.use("/api/subproyectos", subproyectosRouter);
app.use("/api/dependencias", dependenciasRouter);
app.use("/api/actividades", actividadesRouter);
app.use("/api", comentariosRouter);
app.use("/api", subactividadesRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/ai", aiRouter)
app.use("/api/encuestas", encuestasRouter)
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reportes", reportesRouter);
app.use("/api/alertas", alertasRouter);

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
  startScheduler()
  app.listen(env.PORT, () => {
    console.log(`helix-backend listening on port ${env.PORT}`);
  });
}

export default app;
