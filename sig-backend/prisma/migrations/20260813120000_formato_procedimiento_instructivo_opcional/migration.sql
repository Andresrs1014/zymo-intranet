-- Migration: SigFormato pasa a colgar directo de SigProcedimiento;
-- instructivoId se vuelve opcional (el formato puede o no asociarse a un instructivo).
-- Guardada con IF NOT EXISTS / DO blocks para poder aplicarse sobre una BD que
-- todavía tenga el esquema viejo (instructivoId NOT NULL, sin procedimientoId).

-- ── 1. Nueva columna procedimientoId, primero nullable para poder backfillear ──
ALTER TABLE "SigFormato" ADD COLUMN IF NOT EXISTS "procedimientoId" INTEGER;

-- ── 2. Backfill: todo SigFormato existente cuelga de un instructivo con procedimientoId conocido ──
UPDATE "SigFormato" f
SET "procedimientoId" = i."procedimientoId"
FROM "SigInstructivo" i
WHERE f."instructivoId" = i."id" AND f."procedimientoId" IS NULL;

-- ── 3. Ya con todo backfilleado, procedimientoId pasa a ser obligatorio ────────
ALTER TABLE "SigFormato" ALTER COLUMN "procedimientoId" SET NOT NULL;

-- ── 4. instructivoId deja de ser obligatorio ────────────────────────────────────
ALTER TABLE "SigFormato" ALTER COLUMN "instructivoId" DROP NOT NULL;

-- ── 5. FK de instructivoId: de CASCADE a SET NULL (borrar el instructivo ya no debe borrar el formato) ──
ALTER TABLE "SigFormato" DROP CONSTRAINT IF EXISTS "SigFormato_instructivoId_fkey";
ALTER TABLE "SigFormato"
  ADD CONSTRAINT "SigFormato_instructivoId_fkey"
  FOREIGN KEY ("instructivoId") REFERENCES "SigInstructivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. FK + índice de procedimientoId ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SigFormato_procedimientoId_fkey'
  ) THEN
    ALTER TABLE "SigFormato"
      ADD CONSTRAINT "SigFormato_procedimientoId_fkey"
      FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SigFormato_procedimientoId_idx" ON "SigFormato"("procedimientoId");
