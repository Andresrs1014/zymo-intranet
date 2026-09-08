-- Migration: SigAnalisisAuditoria, SigHallazgo, SigConsulta
-- Sistema multiagente analista del SIG (MCP-001). Ver rubrica_sig.md.
-- IF NOT EXISTS / guardas para que sea seguro re-aplicar.

-- ── SigAnalisisAuditoria ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigAnalisisAuditoria" (
    "id"                  SERIAL       NOT NULL,
    "procedimientoId"     INTEGER      NOT NULL,
    "commitId"            INTEGER,
    "veredicto"           TEXT         NOT NULL,
    "veredictoPorFuncion" JSONB        NOT NULL DEFAULT '{}',
    "conteo"              JSONB        NOT NULL DEFAULT '{}',
    "resumenEjecutivo"    TEXT         NOT NULL,
    "reporteMarkdown"     TEXT         NOT NULL,
    "normas"              JSONB        NOT NULL DEFAULT '[]',
    "alcanceArchivos"     JSONB        NOT NULL DEFAULT '[]',
    "autorId"             INTEGER      NOT NULL,
    "autorNombre"         TEXT         NOT NULL,
    "operadorId"          INTEGER,
    "operadorNombre"      TEXT,
    "validadoPorId"       INTEGER,
    "validadoNombre"      TEXT,
    "validadoEn"          TIMESTAMP(3),
    "modelosUsados"       JSONB        NOT NULL DEFAULT '[]',
    "tokensUsados"        INTEGER,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAnalisisAuditoria_pkey" PRIMARY KEY ("id")
);

-- ── SigHallazgo ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigHallazgo" (
    "id"              SERIAL       NOT NULL,
    "procedimientoId" INTEGER      NOT NULL,
    "auditoriaId"     INTEGER      NOT NULL,
    "commitId"        INTEGER,
    "funcion"         TEXT         NOT NULL,
    "nivel"           INTEGER      NOT NULL,
    "clasificacion"   TEXT         NOT NULL,
    "fragmento"       TEXT         NOT NULL,
    "archivo"         TEXT,
    "descripcion"     TEXT         NOT NULL,
    "demostracion"    JSONB        NOT NULL DEFAULT '{}',
    "palabra"         JSONB,
    "impacto"         TEXT,
    "dedupeKey"       TEXT         NOT NULL,
    "estado"          TEXT         NOT NULL DEFAULT 'ABIERTO',
    "motivoCierre"    TEXT,
    "evidenciaCierre" TEXT,
    "sustituyeA"      INTEGER,
    "cerradoPorId"    INTEGER,
    "cerradoNombre"   TEXT,
    "cerradoEn"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigHallazgo_pkey" PRIMARY KEY ("id")
);

-- ── SigConsulta ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SigConsulta" (
    "id"                SERIAL       NOT NULL,
    "procedimientoId"   INTEGER      NOT NULL,
    "auditoriaId"       INTEGER      NOT NULL,
    "tipo"              TEXT         NOT NULL,
    "funcion"           TEXT         NOT NULL,
    "fragmento"         TEXT,
    "documentoEsperado" TEXT,
    "motivo"            TEXT,
    "preguntas"         JSONB        NOT NULL DEFAULT '[]',
    "estado"            TEXT         NOT NULL DEFAULT 'ABIERTA',
    "respuestaUsuario"  TEXT,
    "resolucion"        TEXT,
    "resueltoPorId"     INTEGER,
    "resueltoNombre"    TEXT,
    "resueltoEn"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigConsulta_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "SigAnalisisAuditoria_procedimientoId_idx" ON "SigAnalisisAuditoria"("procedimientoId");
CREATE INDEX IF NOT EXISTS "SigAnalisisAuditoria_commitId_idx"        ON "SigAnalisisAuditoria"("commitId");
CREATE INDEX IF NOT EXISTS "SigAnalisisAuditoria_createdAt_idx"       ON "SigAnalisisAuditoria"("createdAt");
CREATE INDEX IF NOT EXISTS "SigHallazgo_procedimientoId_estado_idx"   ON "SigHallazgo"("procedimientoId", "estado");
CREATE INDEX IF NOT EXISTS "SigHallazgo_auditoriaId_idx"              ON "SigHallazgo"("auditoriaId");
CREATE INDEX IF NOT EXISTS "SigHallazgo_dedupeKey_idx"                ON "SigHallazgo"("dedupeKey");
CREATE INDEX IF NOT EXISTS "SigConsulta_procedimientoId_estado_idx"   ON "SigConsulta"("procedimientoId", "estado");
CREATE INDEX IF NOT EXISTS "SigConsulta_auditoriaId_idx"              ON "SigConsulta"("auditoriaId");

-- ── Foreign keys (guardadas para no fallar si ya existen) ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigAnalisisAuditoria_procedimientoId_fkey') THEN
    ALTER TABLE "SigAnalisisAuditoria" ADD CONSTRAINT "SigAnalisisAuditoria_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigAnalisisAuditoria_commitId_fkey') THEN
    ALTER TABLE "SigAnalisisAuditoria" ADD CONSTRAINT "SigAnalisisAuditoria_commitId_fkey"
      FOREIGN KEY ("commitId") REFERENCES "SigCommit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigHallazgo_procedimientoId_fkey') THEN
    ALTER TABLE "SigHallazgo" ADD CONSTRAINT "SigHallazgo_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigHallazgo_auditoriaId_fkey') THEN
    ALTER TABLE "SigHallazgo" ADD CONSTRAINT "SigHallazgo_auditoriaId_fkey"
      FOREIGN KEY ("auditoriaId") REFERENCES "SigAnalisisAuditoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigHallazgo_commitId_fkey') THEN
    ALTER TABLE "SigHallazgo" ADD CONSTRAINT "SigHallazgo_commitId_fkey"
      FOREIGN KEY ("commitId") REFERENCES "SigCommit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigConsulta_procedimientoId_fkey') THEN
    ALTER TABLE "SigConsulta" ADD CONSTRAINT "SigConsulta_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SigConsulta_auditoriaId_fkey') THEN
    ALTER TABLE "SigConsulta" ADD CONSTRAINT "SigConsulta_auditoriaId_fkey"
      FOREIGN KEY ("auditoriaId") REFERENCES "SigAnalisisAuditoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
