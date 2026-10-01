-- Rúbrica §6.2: la auditoría guarda alcance, criterios, comprensión y seguimiento;
-- el hallazgo guarda criterio/condición/riesgo/causa/KPI; la consulta guarda datos de KPI.
-- Solo agrega columnas (nullable o con default): no toca filas existentes.
ALTER TABLE "SigAnalisisAuditoria"
  ADD COLUMN "alcance" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "criterios" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "comprensionProceso" TEXT,
  ADD COLUMN "supuestos" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "recomendaciones" TEXT,
  ADD COLUMN "seguimiento" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "SigHallazgo"
  ADD COLUMN "tipoDocumento" TEXT,
  ADD COLUMN "criterio" TEXT,
  ADD COLUMN "condicion" TEXT,
  ADD COLUMN "kpi" JSONB,
  ADD COLUMN "riesgo" JSONB,
  ADD COLUMN "causa" JSONB;

ALTER TABLE "SigConsulta"
  ADD COLUMN "datos" JSONB;
