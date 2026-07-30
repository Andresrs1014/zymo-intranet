-- CreateTable
CREATE TABLE "HelixProyecto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelixProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixDependencia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Interna',
    "responsableArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelixDependencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixSubactividad" (
    "id" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "responsableId" INTEGER,
    "responsableNombre" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Planificado',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelixSubactividad_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HelixSubactividad" ADD CONSTRAINT "HelixSubactividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "HelixActividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: HelixSubproyecto gets a real parent Proyecto (previously nonexistent)
ALTER TABLE "HelixSubproyecto" ADD COLUMN "proyectoId" INTEGER;

-- Backfill: create a placeholder project for any subproyecto that already exists,
-- since "Proyecto principal" did not exist as an entity before this migration.
INSERT INTO "HelixProyecto" ("nombre", "createdAt", "updatedAt")
SELECT 'Sin proyecto asignado', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "HelixSubproyecto" WHERE "proyectoId" IS NULL);

UPDATE "HelixSubproyecto"
SET "proyectoId" = (SELECT "id" FROM "HelixProyecto" WHERE "nombre" = 'Sin proyecto asignado' ORDER BY "id" DESC LIMIT 1)
WHERE "proyectoId" IS NULL;

ALTER TABLE "HelixSubproyecto" ALTER COLUMN "proyectoId" SET NOT NULL;
ALTER TABLE "HelixSubproyecto" ADD CONSTRAINT "HelixSubproyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "HelixProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: HelixActividad gets numeroActividad, and its dependenciaId now points
-- to the new HelixDependencia catalog instead of another HelixActividad (self-relation retired).
ALTER TABLE "HelixActividad" ADD COLUMN "numeroActividad" TEXT;

ALTER TABLE "HelixActividad" DROP CONSTRAINT "HelixActividad_dependenciaId_fkey";

-- Any existing dependenciaId values pointed at other actividades — that relation no
-- longer exists, so they must be cleared before re-pointing the FK at HelixDependencia.
UPDATE "HelixActividad" SET "dependenciaId" = NULL WHERE "dependenciaId" IS NOT NULL;

ALTER TABLE "HelixActividad" ADD CONSTRAINT "HelixActividad_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "HelixDependencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
