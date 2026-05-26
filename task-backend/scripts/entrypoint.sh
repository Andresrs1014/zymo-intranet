#!/bin/sh
set -e

echo "==> [task-backend] Aplicando schema (prisma db push)..."
npx prisma db push --accept-data-loss

echo "==> [task-backend] Iniciando servidor..."
exec node dist/app.js
