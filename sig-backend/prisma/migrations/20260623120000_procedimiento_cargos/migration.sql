-- Cargos T&C asignados explícitamente a cada procedimiento SIG
CREATE TABLE "SigProcedimientoCargo" (
    "id" SERIAL NOT NULL,
    "procedimientoId" INTEGER NOT NULL,
    "cargoId" INTEGER NOT NULL,
    "cargoNombre" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigProcedimientoCargo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SigProcedimientoCargo_procedimientoId_cargoId_key"
    ON "SigProcedimientoCargo"("procedimientoId", "cargoId");

CREATE INDEX "SigProcedimientoCargo_procedimientoId_idx"
    ON "SigProcedimientoCargo"("procedimientoId");

CREATE INDEX "SigProcedimientoCargo_cargoId_idx"
    ON "SigProcedimientoCargo"("cargoId");

ALTER TABLE "SigProcedimientoCargo"
    ADD CONSTRAINT "SigProcedimientoCargo_procedimientoId_fkey"
    FOREIGN KEY ("procedimientoId") REFERENCES "SigProcedimiento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
