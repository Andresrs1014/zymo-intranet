-- AlterTable SigAnalisisCargos: add comparaciones and cargos_sin_manual columns
ALTER TABLE "SigAnalisisCargos" ADD COLUMN IF NOT EXISTS "comparaciones" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "SigAnalisisCargos" ADD COLUMN IF NOT EXISTS "cargos_sin_manual" JSONB NOT NULL DEFAULT '[]';
