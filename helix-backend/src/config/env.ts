export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://helix:helixpass@helix-db:5432/helixdb",
  JWT_SECRET: process.env.JWT_SECRET ?? "change-me-same-as-fastapi",
  INTRANET_API_URL: process.env.INTRANET_API_URL ?? "http://backend:8001",
  INTERNAL_KEY: process.env.INTERNAL_KEY ?? (() => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("INTERNAL_KEY must be set in production");
    }
    return "helix-internal-key-dev";
  })(),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
} as const;

export type Env = typeof env;
