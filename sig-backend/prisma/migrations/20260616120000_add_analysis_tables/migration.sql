-- Migration: create SigAnalisisCoherencia, SigAnalisisMejoras, SigAnalisisProcVsInst
-- Uses IF NOT EXISTS so it is safe to apply on a DB that already has these tables.

-- ── SigAnalisisCoherencia ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigAnalisisCoherencia" (
    "id"                   SERIAL         NOT NULL,
    "procedimientoId"      INTEGER        NOT NULL,
    "coherente"            BOOLEAN        NOT NULL,
    "puntaje"              DOUBLE PRECISION,
    "resumen"              TEXT           NOT NULL,
    "issues"               JSONB          NOT NULL DEFAULT '[]',
    "flujogramaConsistente" BOOLEAN,
    "flujogramaDiff"       TEXT,
    "autorId"              INTEGER        NOT NULL,
    "autorNombre"          TEXT           NOT NULL,
    "tokensUsados"         INTEGER,
    "modeloUsado"          TEXT           NOT NULL DEFAULT 'claude-sonnet-4-6',
    "createdAt"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAnalisisCoherencia_pkey" PRIMARY KEY ("id")
);

-- ── SigAnalisisMejoras ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigAnalisisMejoras" (
    "id"               SERIAL       NOT NULL,
    "procedimientoId"  INTEGER      NOT NULL,
    "findings"         JSONB        NOT NULL DEFAULT '[]',
    "proposals"        JSONB        NOT NULL DEFAULT '[]',
    "markdownMejorado" TEXT,
    "resumen"          TEXT         NOT NULL,
    "autorId"          INTEGER      NOT NULL,
    "autorNombre"      TEXT         NOT NULL,
    "tokensUsados"     INTEGER,
    "modeloUsado"      TEXT         NOT NULL DEFAULT 'claude-sonnet-4-6',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAnalisisMejoras_pkey" PRIMARY KEY ("id")
);

-- ── SigAnalisisProcVsInst ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigAnalisisProcVsInst" (
    "id"               SERIAL       NOT NULL,
    "procedimientoId"  INTEGER      NOT NULL,
    "instructivoIds"   JSONB        NOT NULL DEFAULT '[]',
    "coherente"        BOOLEAN      NOT NULL,
    "resumen"          TEXT         NOT NULL,
    "conflictos"       JSONB        NOT NULL DEFAULT '[]',
    "autorId"          INTEGER      NOT NULL,
    "autorNombre"      TEXT         NOT NULL,
    "tokensUsados"     INTEGER,
    "modeloUsado"      TEXT         NOT NULL DEFAULT 'claude-sonnet-4-6',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAnalisisProcVsInst_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "SigAnalisisCoherencia_procedimientoId_idx"  ON "SigAnalisisCoherencia"("procedimientoId");
CREATE INDEX IF NOT EXISTS "SigAnalisisCoherencia_createdAt_idx"         ON "SigAnalisisCoherencia"("createdAt");
CREATE INDEX IF NOT EXISTS "SigAnalisisMejoras_procedimientoId_idx"      ON "SigAnalisisMejoras"("procedimientoId");
CREATE INDEX IF NOT EXISTS "SigAnalisisMejoras_createdAt_idx"            ON "SigAnalisisMejoras"("createdAt");
CREATE INDEX IF NOT EXISTS "SigAnalisisProcVsInst_procedimientoId_idx"   ON "SigAnalisisProcVsInst"("procedimientoId");

-- ── Foreign keys (guarded to not fail if constraint already exists) ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigAnalisisCoherencia_procedimientoId_fkey'
  ) THEN
    ALTER TABLE "SigAnalisisCoherencia"
      ADD CONSTRAINT "SigAnalisisCoherencia_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigAnalisisMejoras_procedimientoId_fkey'
  ) THEN
    ALTER TABLE "SigAnalisisMejoras"
      ADD CONSTRAINT "SigAnalisisMejoras_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigAnalisisProcVsInst_procedimientoId_fkey'
  ) THEN
    ALTER TABLE "SigAnalisisProcVsInst"
      ADD CONSTRAINT "SigAnalisisProcVsInst_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
