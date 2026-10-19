#!/bin/bash
# Caja negra del servidor: cada 2 s anota carga, memoria, temperaturas, frecuencia de CPU y los procesos que más CPU usan,
# y fuerza la escritura a disco. Si el equipo se reinicia en seco (sin dejar nada en el journal), la última línea del archivo
# del día muestra cómo estaba justo antes.  Se queda corriendo; arranca solo con @reboot (crontab del usuario).
#
#   Archivos: ~/zymo-backups/caja-negra/AAAA-MM-DD.log (UTC), se borran a los 14 días.
#   Leer el final del día:   tail -n 30 ~/zymo-backups/caja-negra/$(date -u +%F).log
#   Columnas: hora UTC · carga 1/5/15 min · MB libres · temperaturas (°C, una por zona térmica) · MHz medio · builds de docker · 2 procesos top

D="$HOME/zymo-backups/caja-negra"
mkdir -p "$D"
exec 9>"$D/.lock"
flock -n 9 || exit 0   # una sola instancia

limpiar() { find "$D" -name '*.log' -mtime +14 -delete 2>/dev/null; }
limpiar
dia_limpieza=$(date -u +%F)

while true; do
  hoy=$(date -u +%F)
  if [ "$hoy" != "$dia_limpieza" ]; then limpiar; dia_limpieza=$hoy; fi
  f="$D/$hoy.log"
  temps=""
  for z in /sys/class/thermal/thermal_zone*/temp; do temps="$temps$(( $(cat "$z" 2>/dev/null || echo 0) / 1000 ))/"; done
  {
    printf '%s load=%s mem_libre=%sMB temp=%s mhz=%s builds=%s top=%s\n' \
      "$(date -u +%T)" \
      "$(cut -d' ' -f1-3 /proc/loadavg)" \
      "$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)" \
      "${temps%/}" \
      "$(awk -F: '/cpu MHz/{s+=$2;n++} END{if(n)printf "%d", s/n}' /proc/cpuinfo)" \
      "$(pgrep -fc 'docker.*(build|buildx)|buildkit' 2>/dev/null)" \
      "$(ps -eo comm=,pcpu= --sort=-pcpu | head -2 | awk '{printf "%s:%s ", $1, $2}')"
  } >> "$f"
  sync -d "$f" 2>/dev/null || sync
  sleep 2
done
