#!/bin/sh
set -e

echo "==> [task-backend] Aplicando schema (prisma db push)..."
npx prisma db push --accept-data-loss

V1_SQLITE="${V1_SQLITE_PATH:-/app/data/intranet.db}"

if [ -f "$V1_SQLITE" ]; then
  echo "==> [task-backend] SQLite V1 encontrado en $V1_SQLITE"
  echo "==> [task-backend] Ejecutando migración V1 → V2 (idempotente)..."
  python3 /app/scripts/migrate-v1-to-v2.py
else
  echo "==> [task-backend] No hay SQLite en $V1_SQLITE — omitiendo migración."
fi

echo "==> [task-backend] Iniciando servidor..."
exec node dist/app.js
