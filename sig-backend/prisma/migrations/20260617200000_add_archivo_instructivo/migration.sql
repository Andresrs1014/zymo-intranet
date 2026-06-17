-- AddColumn: archivo original adjunto a instructivos

ALTER TABLE "SigInstructivo"
  ADD COLUMN IF NOT EXISTS "archivoOriginal" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "nombreArchivo"   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "tipoMime"        VARCHAR(100);
