#!/bin/bash
# Vigilante de respaldos: si el diario o el semanal fallan o se atrasan, deja ~/zymo-backups/ALERTA_RESPALDOS.txt
# (se muestra al entrar por SSH) y la quita cuando todo vuelve a estar bien. Existe porque el respaldo del
# 2026-09-27 falló en silencio y nadie se enteró.
# Cron (22:30 UTC, 30 min después de la copia diaria):  30 22 * * * ~/apps/zymo-intranet/ops/backup/check-backups.sh
R="$HOME/zymo-backups"; ALERTA="$R/ALERTA_RESPALDOS.txt"; msgs=()

horas() { [ -f "$1" ] && echo $(( ($(date +%s) - $(stat -c %Y "$1")) / 3600 )) || echo 99999; }

# revisar <nombre> <carpeta> <horas máximas sin éxito>
revisar() {
  local n="$1" d="$2" max="$3" h
  h=$(horas "$d/LAST_SUCCESS")
  [ "$h" -le "$max" ] || msgs+=("Respaldo $n: último éxito hace $h h (máximo $max h)")
  if [ -f "$d/LAST_FAILURE" ] && [ "$d/LAST_FAILURE" -nt "$d/LAST_SUCCESS" ]; then
    msgs+=("Respaldo $n: falló la última vez ($(head -c 200 "$d/LAST_FAILURE" | tr '\n' ' '))")
  fi
}
revisar diario  "$R/daily"  30
revisar semanal "$R/weekly" 200

if [ ${#msgs[@]} -gt 0 ]; then
  { echo "!!! ALERTA DE RESPALDOS $(date -u +%FT%TZ) !!!"; printf ' - %s\n' "${msgs[@]}"; } > "$ALERTA"
else
  rm -f "$ALERTA"
fi
