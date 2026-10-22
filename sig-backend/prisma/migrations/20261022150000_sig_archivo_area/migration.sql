CREATE TABLE "SigArchivoArea" (
    "id" SERIAL NOT NULL,
    "areaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "archivo" VARCHAR(500) NOT NULL,
    "nombreArchivo" VARCHAR(255) NOT NULL,
    "tipoMime" VARCHAR(100),
    "autorId" INTEGER NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigArchivoArea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SigArchivoArea_areaId_idx" ON "SigArchivoArea"("areaId");

ALTER TABLE "SigArchivoArea" ADD CONSTRAINT "SigArchivoArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "SigArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
