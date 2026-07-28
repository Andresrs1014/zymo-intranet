-- CreateTable
CREATE TABLE "LibertadoraProspecto" (
    "id" SERIAL NOT NULL,
    "empresa" TEXT NOT NULL,
    "producto" TEXT NOT NULL DEFAULT 'PORTAFOLIO',
    "gestion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_PROCESO',
    "monto" INTEGER NOT NULL DEFAULT 0,
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "accion" TEXT,
    "fecha" TEXT,
    "trimestre" TEXT,
    "tipo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibertadoraProspecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibertadoraCita" (
    "id" SERIAL NOT NULL,
    "cliente" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "hora" TEXT NOT NULL DEFAULT '09:00',
    "modalidad" TEXT NOT NULL DEFAULT 'Presencial',
    "producto" TEXT NOT NULL DEFAULT 'PORTAFOLIO',
    "estado" TEXT NOT NULL DEFAULT 'pending',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibertadoraCita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibertadoraMeta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "metaMensual" INTEGER,
    "metaAnual" INTEGER,
    "metaCierres" INTEGER,
    "metaCitas" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibertadoraMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibertadoraPartnerUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "LibertadoraPartnerUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibertadoraPartnerUser_email_key" ON "LibertadoraPartnerUser"("email");
