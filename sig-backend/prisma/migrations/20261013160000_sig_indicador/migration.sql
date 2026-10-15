-- Indicadores (hoja de vida) por área del SIG.

CREATE TABLE "SigIndicador" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "objetivo" TEXT,
    "formula" TEXT,
    "meta" TEXT,
    "frecuencia" TEXT,
    "fuente" TEXT,
    "tipo" TEXT,
    "tendencia" TEXT,
    "plazo" TEXT,
    "procesoResponsable" TEXT,
    "versionDoc" TEXT,
    "fechaDoc" TEXT,
    "resultados" JSONB NOT NULL DEFAULT '[]',
    "archivo" VARCHAR(500) NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "tipoMime" VARCHAR(100),
    "hoja" TEXT,
    "autorId" INTEGER NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigIndicador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SigIndicador_areaId_idx" ON "SigIndicador"("areaId");
CREATE INDEX "SigIndicador_nombre_idx" ON "SigIndicador"("nombre");

ALTER TABLE "SigIndicador" ADD CONSTRAINT "SigIndicador_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "SigArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
