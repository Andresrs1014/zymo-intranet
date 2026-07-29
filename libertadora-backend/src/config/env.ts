export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3006", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://libertadora:libertadorapass@libertadora-db:5432/libertadoradb",
  // Secreto propio de esta app -- ya NO es el mismo que usa la intranet
  // (app 100% separada, decisión del usuario 2026-07-28). Solo firma/valida
  // las sesiones de LibertadoraUser, nada más lo necesita.
  JWT_SECRET: process.env.JWT_SECRET ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    return "change-me-dev-only";
  })(),
  CORS_ORIGIN: process.env.CORS_ORIGIN,
} as const;

export type Env = typeof env;
