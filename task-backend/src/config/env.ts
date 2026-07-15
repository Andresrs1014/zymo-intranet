export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3002", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://task:taskpass@task-db:5432/taskdb",
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET (or SECRET_KEY) must be set in production")
    }
    return "change-me-same-as-fastapi"
  })(),
  INTRANET_API_URL: process.env.INTRANET_API_URL ?? "http://backend:8001",
  INTERNAL_KEY: process.env.INTERNAL_KEY ?? "task-internal-key-dev",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS ?? "10000", 10),
  ESCALATION_HOURS: parseInt(process.env.ESCALATION_HOURS ?? "48", 10),
  ESCALATION_START_HOUR: parseInt(process.env.ESCALATION_START_HOUR ?? "7", 10),
  ESCALATION_END_HOUR: parseInt(process.env.ESCALATION_END_HOUR ?? "19", 10),
  SYNC_SERVICE_EMAIL: process.env.SYNC_SERVICE_EMAIL ?? "",
} as const

export type Env = typeof env
