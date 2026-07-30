-- Plan de trabajo tiene una esencia distinta a Subproyecto: es una herramienta
-- táctica rápida, no una iniciativa con caso de negocio. No pertenece a un
-- Proyecto principal ni carga ROI. Reutilizamos la misma tabla (como hacía el
-- prototipo original) en vez de una tabla paralela, distinguiendo por "tipo".

-- AlterTable: proyectoId vuelve a ser opcional (solo Subproyecto real lo exige,
-- validado en el service/router, no en el schema)
ALTER TABLE "HelixSubproyecto" ALTER COLUMN "proyectoId" DROP NOT NULL;

-- AlterTable: discriminador de tipo
ALTER TABLE "HelixSubproyecto" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'Subproyecto';
