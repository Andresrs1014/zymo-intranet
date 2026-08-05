-- Migration: create SigFormato, SigDocAnexo, SigAnalisisCompleto
-- Uses IF NOT EXISTS so it is safe to apply on a DB that already has these tables.

-- ── SigFormato (cuelga de un SigInstructivo) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigFormato" (
    "id"            SERIAL       NOT NULL,
    "instructivoId" INTEGER      NOT NULL,
    "nombre"        TEXT         NOT NULL,
    "archivo"       TEXT         NOT NULL,
    "nombreArchivo" TEXT         NOT NULL,
    "tipoMime"      TEXT,
    "autorId"       INTEGER      NOT NULL,
    "autorNombre"   TEXT         NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigFormato_pkey" PRIMARY KEY ("id")
);

-- ── SigDocAnexo (cuelga directo de SigProcedimiento) ───────────────────────────
CREATE TABLE IF NOT EXISTS "SigDocAnexo" (
    "id"              SERIAL       NOT NULL,
    "procedimientoId" INTEGER      NOT NULL,
    "nombre"          TEXT         NOT NULL,
    "archivo"         TEXT         NOT NULL,
    "nombreArchivo"   TEXT         NOT NULL,
    "tipoMime"        TEXT,
    "autorId"         INTEGER      NOT NULL,
    "autorNombre"     TEXT         NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigDocAnexo_pkey" PRIMARY KEY ("id")
);

-- ── SigAnalisisCompleto (rúbrica — hoy solo vía MCP) ───────────────────────────
CREATE TABLE IF NOT EXISTS "SigAnalisisCompleto" (
    "id"                  SERIAL       NOT NULL,
    "procedimientoId"     INTEGER      NOT NULL,
    "findings"            JSONB        NOT NULL DEFAULT '[]',
    "proposals"           JSONB        NOT NULL DEFAULT '[]',
    "markdownNormalizado" TEXT,
    "flujogramaMmd"       TEXT,
    "autorId"             INTEGER      NOT NULL,
    "autorNombre"         TEXT         NOT NULL,
    "tokensUsados"        INTEGER,
    "modeloUsado"         TEXT         NOT NULL DEFAULT 'claude-sonnet-4-6',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAnalisisCompleto_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "SigFormato_instructivoId_idx"        ON "SigFormato"("instructivoId");
CREATE INDEX IF NOT EXISTS "SigDocAnexo_procedimientoId_idx"     ON "SigDocAnexo"("procedimientoId");
CREATE INDEX IF NOT EXISTS "SigAnalisisCompleto_procedimientoId_idx" ON "SigAnalisisCompleto"("procedimientoId");

-- ── Foreign keys (guarded to not fail if constraint already exists) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigFormato_instructivoId_fkey'
  ) THEN
    ALTER TABLE "SigFormato"
      ADD CONSTRAINT "SigFormato_instructivoId_fkey"
      FOREIGN KEY ("instructivoId") REFERENCES "SigInstructivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigDocAnexo_procedimientoId_fkey'
  ) THEN
    ALTER TABLE "SigDocAnexo"
      ADD CONSTRAINT "SigDocAnexo_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigAnalisisCompleto_procedimientoId_fkey'
  ) THEN
    ALTER TABLE "SigAnalisisCompleto"
      ADD CONSTRAINT "SigAnalisisCompleto_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
