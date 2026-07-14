export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3005", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://zymoally:zymoallypass@zymoally-db:5432/zymoallydb",
  // FastAPI signs tokens with SECRET_KEY; JWT_SECRET is accepted as an alias.
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET (or SECRET_KEY) must be set in production");
    }
    return "change-me-same-as-fastapi";
  })(),
  INTRANET_API_URL: process.env.INTRANET_API_URL ?? "http://backend:8001",
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? "http://localhost:8080",
  // Cuenta de servicio en el backend Python (sin login humano) usada por el
  // sync de datos maestros — ver "Prerrequisito manual" al inicio del plan.
  SYNC_SERVICE_EMAIL: process.env.SYNC_SERVICE_EMAIL ?? "",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
} as const;

export type Env = typeof env;
