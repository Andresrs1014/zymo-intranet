-- CreateTable
CREATE TABLE "SigAnalisisCargos" (
    "id" SERIAL NOT NULL,
    "procedimientoId" INTEGER NOT NULL,
    "cargos" JSONB NOT NULL DEFAULT '[]',
    "resumen" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "tokensUsados" INTEGER,
    "modeloUsado" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigAnalisisCargos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigAnalisisCargos_procedimientoId_idx" ON "SigAnalisisCargos"("procedimientoId");

-- CreateIndex
CREATE INDEX "SigAnalisisCargos_createdAt_idx" ON "SigAnalisisCargos"("createdAt");

-- AddForeignKey
ALTER TABLE "SigAnalisisCargos" ADD CONSTRAINT "SigAnalisisCargos_procedimientoId_fkey" FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
