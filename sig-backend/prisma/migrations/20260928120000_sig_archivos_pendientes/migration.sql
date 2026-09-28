-- CreateTable
CREATE TABLE "SigArchivoPendiente" (
    "id" SERIAL NOT NULL,
    "archivoOriginal" VARCHAR(500) NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "tipoMime" VARCHAR(100),
    "tamanoBytes" INTEGER NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "origen" VARCHAR(20) NOT NULL DEFAULT 'intranet',
    "subidoPorId" INTEGER,
    "subidoPorNombre" TEXT NOT NULL,
    "asignado" BOOLEAN NOT NULL DEFAULT false,
    "asignadoEn" TIMESTAMP(3),
    "asignadoTipo" VARCHAR(20),
    "commitId" INTEGER,
    "instructivoId" INTEGER,
    "formatoId" INTEGER,
    "docAnexoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigArchivoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigArchivoPendiente_categoria_asignado_idx" ON "SigArchivoPendiente"("categoria", "asignado");

-- CreateIndex
CREATE INDEX "SigArchivoPendiente_createdAt_idx" ON "SigArchivoPendiente"("createdAt");
