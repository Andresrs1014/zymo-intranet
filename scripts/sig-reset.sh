#!/usr/bin/env bash
# ============================================================
# ZYMO SIG — Ejecuta el reset desde el host via Docker Compose
# Uso: bash scripts/sig-reset.sh
# Debe correrse desde la raíz del proyecto (donde está docker-compose.yml)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/sig-reset.sql"

echo "⚠️  ATENCIÓN: Esto borrará TODOS los datos del SIG (áreas, procedimientos,"
echo "   commits, instructivos y todos los análisis de IA)."
echo ""
read -r -p "¿Confirmar reset? Escribe 'si' para continuar: " confirm

if [[ "$confirm" != "si" ]]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "→ Ejecutando reset en sig-db..."
docker compose exec -T sig-db \
  psql -U "${SIG_DB_USER:-sig}" -d "${SIG_DB_NAME:-sigdb}" \
  < "$SQL_FILE"

echo ""
echo "✓ Reset completado. La base de datos del SIG está vacía con IDs desde 1."
