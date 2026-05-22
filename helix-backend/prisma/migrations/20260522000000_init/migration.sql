-- CreateTable
CREATE TABLE "HelixSubproyecto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "objetivo" TEXT,
    "cliente" TEXT,
    "inversionEst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retornoEsp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelixSubproyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixActividad" (
    "id" SERIAL NOT NULL,
    "subproyectoId" INTEGER NOT NULL,
    "responsableId" INTEGER NOT NULL,
    "responsableNombre" TEXT NOT NULL,
    "responsableInitials" TEXT NOT NULL,
    "responsableColor" TEXT NOT NULL DEFAULT '#5461c8',
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Backlog',
    "prioridad" TEXT NOT NULL DEFAULT 'Media',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "avance" INTEGER NOT NULL DEFAULT 0,
    "puntos" INTEGER NOT NULL DEFAULT 3,
    "costoInversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoOptimizacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoEjecucion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "dependenciaId" INTEGER,
    "completadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelixActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixComentario" (
    "id" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelixComentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixEvidencia" (
    "id" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoArchivo" TEXT NOT NULL,
    "tamanio" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelixEvidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixEncuesta" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "satisfaccion" INTEGER NOT NULL,
    "facilidad" INTEGER NOT NULL,
    "utilidad" INTEGER NOT NULL,
    "nps" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelixEncuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixAlerta" (
    "id" SERIAL NOT NULL,
    "subproyectoId" INTEGER,
    "cambio" TEXT NOT NULL,
    "actividadId" INTEGER,
    "actividadNombre" TEXT,
    "destinatarios" JSONB NOT NULL,
    "canal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelixAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelixAIConversacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "mensajes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelixAIConversacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HelixActividad" ADD CONSTRAINT "HelixActividad_subproyectoId_fkey" FOREIGN KEY ("subproyectoId") REFERENCES "HelixSubproyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelixActividad" ADD CONSTRAINT "HelixActividad_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "HelixActividad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelixComentario" ADD CONSTRAINT "HelixComentario_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "HelixActividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelixEvidencia" ADD CONSTRAINT "HelixEvidencia_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "HelixActividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelixAlerta" ADD CONSTRAINT "HelixAlerta_subproyectoId_fkey" FOREIGN KEY ("subproyectoId") REFERENCES "HelixSubproyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
