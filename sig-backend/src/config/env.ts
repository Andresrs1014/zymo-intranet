export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3003", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://sig:sigpass@sig-db:5432/sigdb",
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET (o SECRET_KEY) debe estar definido en producción")
    }
    return "change-me-same-as-fastapi"
  })(),
  INTRANET_API_URL: process.env.INTRANET_API_URL ?? "http://backend:8001",
  INTERNAL_KEY: process.env.INTERNAL_KEY ?? "task-internal-key-dev",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  // Email para notificaciones de aprobación
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? "587", 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM ?? "sig@zymointranet.com",
} as const

export type Env = typeof env
