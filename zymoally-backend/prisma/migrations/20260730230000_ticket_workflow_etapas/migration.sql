-- Flujo por etapas del ticket: supervisor asigna -> analista gestiona (con
-- evidencia obligatoria) -> gerencia valida y cierra. Columnas aditivas,
-- nullable/default vacio -- no rompe tickets ya existentes.

ALTER TABLE "ZymoPqrTicket" ADD COLUMN "originalAnalysts" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "originalAnalystEmails" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "readyForValidationAt" TIMESTAMP(3);
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "validatedBy" TEXT;
ALTER TABLE "ZymoPqrTicket" ADD COLUMN "validatedByEmail" TEXT;
