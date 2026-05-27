-- Backfill tiempo_total_minutos for tasks that have hora_inicio and hora_cierre
-- but missing the calculated value.
-- Safe to run multiple times (only updates where tiempo_total_minutos IS NULL).

UPDATE "Task"
SET tiempo_total_minutos = ROUND(
  EXTRACT(EPOCH FROM (hora_cierre - hora_inicio)) / 60
)::INT
WHERE hora_inicio IS NOT NULL
  AND hora_cierre IS NOT NULL
  AND hora_cierre > hora_inicio
  AND tiempo_total_minutos IS NULL;
