#!/bin/bash
# Limpieza de la caché de Docker del servidor (sin tocar contenedores, volúmenes ni imágenes en uso).
#
#   limpieza-docker.sh              -> SIMULACRO: solo muestra qué haría. No borra nada.
#   limpieza-docker.sh --ejecutar   -> borra de verdad, pero SOLO si pasan todas las protecciones:
#                                      · fuera del horario laboral (hora Colombia 19:00-05:59; UTC 00:00-10:59)
#                                      · carga baja, sin respaldos ni despliegues corriendo
#
# Por qué tantas protecciones: este equipo es un PC de escritorio sin UPS que se ha reiniciado en seco
# durante cargas de disco/CPU (ver MEMORY: servidor-reinicios). Se borra por etapas y con prioridad baja.
#
# Variables solo para pruebas: LIMPIEZA_FORZAR=1 (ignora el horario), LIMPIEZA_CARGA_MAX=1.5,
# LIMPIEZA_SOLO=etiqueta (solo borra imágenes con la etiqueta limpieza-prueba=1).

set -u
MODO=simulacro
[ "${1:-}" = "--ejecutar" ] && MODO=ejecutar
CARGA_MAX="${LIMPIEZA_CARGA_MAX:-1.5}"
LOG="$HOME/zymo-backups/limpieza-docker.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

echo "=== $(date -u '+%F %T') UTC · modo: $MODO ==="

carga() { awk '{print $1}' /proc/loadavg; }
carga_alta() { awk -v c="$(carga)" -v m="$CARGA_MAX" 'BEGIN{exit !(c+0 > m+0)}'; }
resumen() { docker system df 2>/dev/null | awk 'NR==1 || /Images|Build Cache/'; df -h / | awk 'NR==2{print "Disco libre: "$4" ("$5" usado)"}'; }

# --- Protecciones -----------------------------------------------------------------------------------
motivos=()
hora_utc=$((10#$(date -u +%H)))
if [ "$hora_utc" -ge 11 ] && [ "${LIMPIEZA_FORZAR:-}" != "1" ]; then
  motivos+=("estamos en horario laboral (${hora_utc}:xx UTC = $(( (hora_utc + 19) % 24 )):xx Colombia); solo se ejecuta entre las 19:00 y las 05:59 de Colombia")
fi
if carga_alta; then motivos+=("la carga del servidor es $(carga) (máximo permitido $CARGA_MAX)"); fi
if pgrep -f 'daily-copy.sh|backup-databases.sh' >/dev/null; then motivos+=("hay un respaldo corriendo"); fi
if pgrep -f 'docker compose (build|up)|deploy-intranet.sh' >/dev/null; then motivos+=("hay un despliegue o build corriendo"); fi

if [ "$MODO" = "simulacro" ]; then
  echo "[simulacro] No se borra nada. Estado actual:"
  resumen
  echo "[simulacro] Imágenes sin etiqueta (se borrarían): $(docker images -f dangling=true -q | wc -l)"
  if [ "${#motivos[@]}" -gt 0 ]; then
    echo "[simulacro] Con --ejecutar AHORA se negaría porque:"; printf '   - %s\n' "${motivos[@]}"
  else
    echo "[simulacro] Con --ejecutar ahora pasaría las protecciones."
  fi
  echo "[simulacro] Etapas reales: 1) imágenes sin etiqueta; 2) caché de build de más de 30 días; 3) de más de 14 días; 4) de más de 7 días. Se conserva la caché de la última semana."
  exit 0
fi

if [ "${#motivos[@]}" -gt 0 ]; then
  echo "NO SE EJECUTA:"; printf ' - %s\n' "${motivos[@]}"
  exit 3
fi

# --- Ejecución por etapas ------------------------------------------------------------------------------
echo "Antes:"; resumen
bajo() { nice -n 19 ionice -c3 "$@"; }

if [ "${LIMPIEZA_SOLO:-}" = "etiqueta" ]; then
  echo "[prueba] solo imágenes con la etiqueta limpieza-prueba=1"
  bajo docker image prune -f --filter 'label=limpieza-prueba=1'
  echo "Después:"; resumen
  exit 0
fi

echo "--- etapa 1: imágenes sin etiqueta ---"
bajo docker image prune -f | tail -1
for horas in 720 336 168; do
  sleep 30
  if carga_alta; then echo "Carga alta ($(carga)); se detiene aquí. Lo que falte queda para la próxima."; break; fi
  echo "--- caché de build de más de $((horas / 24)) días ---"
  bajo docker builder prune -f --filter "until=${horas}h" | tail -1
done
echo "Después:"; resumen
echo "=== listo $(date -u '+%T') UTC ==="
