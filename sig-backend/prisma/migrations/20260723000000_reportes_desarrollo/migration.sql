-- CreateTable
CREATE TABLE "SigReporteDesarrollo" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" VARCHAR(1000),
    "proyecto" TEXT NOT NULL,
    "contenidoMd" TEXT NOT NULL,
    "porcentajeAvance" INTEGER NOT NULL,
    "tiempoEstimadoHoras" DOUBLE PRECISION,
    "tiempoRealHoras" DOUBLE PRECISION,
    "fechaReporte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" INTEGER NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "archivoOriginal" VARCHAR(500),
    "nombreArchivo" VARCHAR(255),
    "tipoMime" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigReporteDesarrollo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigReporteDesarrollo_proyecto_idx" ON "SigReporteDesarrollo"("proyecto");

-- CreateIndex
CREATE INDEX "SigReporteDesarrollo_autorId_idx" ON "SigReporteDesarrollo"("autorId");

-- CreateIndex
CREATE INDEX "SigReporteDesarrollo_fechaReporte_idx" ON "SigReporteDesarrollo"("fechaReporte");
