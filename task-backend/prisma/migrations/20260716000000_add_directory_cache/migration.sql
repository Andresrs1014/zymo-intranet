-- CreateEnum
CREATE TYPE "DirectoryCacheTipo" AS ENUM ('persona', 'area');

-- CreateTable
CREATE TABLE "directory_cache" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(32) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "tipo" "DirectoryCacheTipo" NOT NULL,
    "intranet_user_id" INTEGER,
    "synced_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "directory_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_cache_tipo_external_id_key" ON "directory_cache"("tipo", "external_id");

-- CreateIndex
CREATE INDEX "directory_cache_tipo_nombre_idx" ON "directory_cache"("tipo", "nombre");
