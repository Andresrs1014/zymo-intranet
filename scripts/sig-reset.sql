-- ============================================================
-- ZYMO SIG — Reset completo de la base de datos
-- Borra todos los datos y reinicia los IDs desde 1.
-- No toca el historial de migraciones de Prisma.
-- ============================================================

BEGIN;

-- Tablas hijas primero (o CASCADE se encarga, pero lo hacemos explícito)
TRUNCATE TABLE
  "SigAnalisisCoherencia",
  "SigAnalisisMejoras",
  "SigAnalisisCargos",
  "SigAnalisisProcVsInst",
  "SigCommit",
  "SigInstructivo",
  "SigProcedimiento",
  "SigArea"
RESTART IDENTITY CASCADE;

COMMIT;

-- Verificación
SELECT
  'SigArea'                 AS tabla, COUNT(*) AS filas FROM "SigArea"
UNION ALL SELECT 'SigProcedimiento',  COUNT(*) FROM "SigProcedimiento"
UNION ALL SELECT 'SigCommit',         COUNT(*) FROM "SigCommit"
UNION ALL SELECT 'SigInstructivo',    COUNT(*) FROM "SigInstructivo"
UNION ALL SELECT 'SigAnalisisCoherencia', COUNT(*) FROM "SigAnalisisCoherencia"
UNION ALL SELECT 'SigAnalisisMejoras',    COUNT(*) FROM "SigAnalisisMejoras"
UNION ALL SELECT 'SigAnalisisCargos',     COUNT(*) FROM "SigAnalisisCargos"
UNION ALL SELECT 'SigAnalisisProcVsInst', COUNT(*) FROM "SigAnalisisProcVsInst";
