-- Backfill: URLs de evidencia guardadas antes del fix de nginx/prefijo (2026-07-29).
-- El bug: se guardaban como /uploads/<archivo>, ruta que nginx enruta a
-- helix-backend (no a zymoally-backend), así que el archivo nunca se encontraba.
-- Correr una sola vez en la BD de zymoally-db, en el servidor.

UPDATE "ZymoPqrEvidence"
SET url = '/zymoally-uploads/' || substring(url from '/uploads/(.*)$')
WHERE url LIKE '/uploads/%';

-- Verificación rápida: no debe quedar ninguna fila con el prefijo viejo.
-- SELECT count(*) FROM "ZymoPqrEvidence" WHERE url LIKE '/uploads/%';
