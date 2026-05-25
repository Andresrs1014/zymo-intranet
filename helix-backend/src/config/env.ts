export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://helix:helixpass@helix-db:5432/helixdb",
  // FastAPI signs tokens with SECRET_KEY; JWT_SECRET is accepted as an alias.
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.SECRET_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET (or SECRET_KEY) must be set in production");
    }
    return "change-me-same-as-fastapi";
  })(),
  INTRANET_API_URL: process.env.INTRANET_API_URL ?? "http://backend:8001",
  INTERNAL_KEY: process.env.INTERNAL_KEY ?? "helix-internal-key-dev",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
} as const;

export type Env = typeof env;
