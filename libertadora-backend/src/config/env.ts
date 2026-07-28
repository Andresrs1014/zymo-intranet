export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3006", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://libertadora:libertadorapass@libertadora-db:5432/libertadoradb",
  // FastAPI signs tokens with SECRET_KEY; JWT_SECRET is accepted as an alias.
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET (or SECRET_KEY) must be set in production");
    }
    return "change-me-same-as-fastapi";
  })(),
  SIG_BACKEND_URL: process.env.SIG_BACKEND_URL ?? "http://sig-backend:3003",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
} as const;

export type Env = typeof env;
