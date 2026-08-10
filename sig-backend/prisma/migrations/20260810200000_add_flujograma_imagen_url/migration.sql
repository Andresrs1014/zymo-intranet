-- Migration: add SigCommit.flujogramaImagenUrl
-- Guarded with IF NOT EXISTS so it is safe to re-apply.

ALTER TABLE "SigCommit" ADD COLUMN IF NOT EXISTS "flujogramaImagenUrl" VARCHAR(255);
