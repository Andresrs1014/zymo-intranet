-- Protocolo (casa en un procedimiento) y citas entre documentos, incluso rotas. Portado del PR #17 (sin la columna de archivos pendientes).

-- CreateTable
CREATE TABLE "SigProtocolo" (
    "id" SERIAL NOT NULL,
    "procedimientoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "contenido" TEXT NOT NULL,
    "contenidoOriginal" TEXT,
    "versionDoc" TEXT NOT NULL DEFAULT '1.0',
    "archivoOriginal" VARCHAR(500),
    "nombreArchivo" VARCHAR(255),
    "tipoMime" VARCHAR(100),
    "autorId" INTEGER NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigProtocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigReferencia" (
    "id" SERIAL NOT NULL,
    "procedimientoId" INTEGER NOT NULL,
    "origenTipo" VARCHAR(20) NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoTipo" VARCHAR(20) NOT NULL,
    "destinoCodigo" VARCHAR(80) NOT NULL,
    "destinoId" INTEGER,
    "estado" VARCHAR(20) NOT NULL,
    "nota" TEXT,
    "frase" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigReferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigProtocolo_procedimientoId_idx" ON "SigProtocolo"("procedimientoId");

-- CreateIndex
CREATE INDEX "SigProtocolo_codigo_idx" ON "SigProtocolo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "SigProtocolo_procedimientoId_codigo_key" ON "SigProtocolo"("procedimientoId", "codigo");

-- CreateIndex
CREATE INDEX "SigReferencia_procedimientoId_idx" ON "SigReferencia"("procedimientoId");

-- CreateIndex
CREATE UNIQUE INDEX "SigReferencia_origenTipo_origenId_destinoTipo_destinoCodigo_key" ON "SigReferencia"("origenTipo", "origenId", "destinoTipo", "destinoCodigo");

-- AddForeignKey
ALTER TABLE "SigProtocolo" ADD CONSTRAINT "SigProtocolo_procedimientoId_fkey" FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigReferencia" ADD CONSTRAINT "SigReferencia_procedimientoId_fkey" FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

