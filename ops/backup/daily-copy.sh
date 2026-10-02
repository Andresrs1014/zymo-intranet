#!/bin/bash
# Copia diaria de las bases de datos y adjuntos a una carpeta del servidor FUERA de Docker.
# Un solo archivo por base: se SOBRESCRIBE cada día (más el anterior como .prev, ver abajo).
# Cron (hora Colombia 17:00 = 22:00 UTC):  0 22 * * * ~/apps/zymo-intranet/ops/backup/daily-copy.sh
#
# Qué copia:
#   - pg_*.sql.gz        pg_dumpall de TODO contenedor Postgres que esté corriendo (descubiertos, no hardcodeados)
#   - sqlite/*.db        SQLite del backend (API de backup de SQLite, consistente) + quick_check
#   - vol_*.tgz          volúmenes de adjuntos (uploads, backend_data sin los .db) del proyecto zymo-intranet
# Protección contra sobrescribir una copia buena con una mala: cada archivo nuevo se valida
# (gzip íntegro, dump completo, quick_check, y no menos de la mitad del tamaño del actual). Si falla,
# NO se reemplaza y queda el aviso en LAST_FAILURE. El archivo anterior se conserva como <archivo>.prev.
set -uo pipefail

DEST="${BACKUP_DAILY_DIR:-$HOME/zymo-backups/daily}"
PROJECT="${COMPOSE_PROJECT:-zymo-intranet}"
mkdir -p "$DEST/sqlite"
chmod 700 "$DEST"
exec 9>"$DEST/.lock"
flock -n 9 || { echo "ya hay una copia en curso"; exit 1; }
[ -f "$DEST/daily.log" ] && [ "$(stat -c %s "$DEST/daily.log")" -gt 1000000 ] && : > "$DEST/daily.log"
exec >>"$DEST/daily.log" 2>&1

FAILS=()
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
fail() { FAILS+=("$*"); log "FALLO: $*"; }

# promover <tmp> <final> <comprobar_tamano 0|1>: valida tamaño y reemplaza, guardando el anterior como .prev
promover() {
  local tmp="$1" final="$2" check="$3" nuevo viejo
  nuevo=$(stat -c %s "$tmp"); [ "$nuevo" -gt 0 ] || { fail "$final vacío"; rm -f "$tmp"; return 1; }
  if [ "$check" = 1 ] && [ -f "$final" ]; then
    viejo=$(stat -c %s "$final")
    if [ $((nuevo * 2)) -lt "$viejo" ]; then
      fail "$final: la copia nueva ($nuevo B) es menos de la mitad de la actual ($viejo B); NO se reemplazó"
      rm -f "$tmp"; return 1
    fi
  fi
  [ -f "$final" ] && mv -f "$final" "$final.prev"
  mv -f "$tmp" "$final"; chmod 600 "$final" 2>/dev/null || true
}

log "== inicio =="

# 1) Postgres: todos los contenedores postgres en ejecución
for c in $(docker ps --format '{{.Names}} {{.Image}}' | awk '$2 ~ /^postgres/ {print $1}'); do
  out="$DEST/pg_${c}.sql.gz"; tmp="$out.tmp"
  if timeout 30m docker exec "$c" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall --no-role-passwords -U "$POSTGRES_USER"' | gzip -c > "$tmp" \
     && gzip -t "$tmp" && zcat "$tmp" | tail -5 | grep -q "PostgreSQL database cluster dump complete"; then
    promover "$tmp" "$out" 1 && log "ok postgres $c ($(stat -c %s "$out") B)"
  else
    fail "postgres $c: el dump no terminó bien"; rm -f "$tmp"
  fi
done

# 2) SQLite del backend (OC, T&C, financiero, etc.) con la API de backup
B=$(docker ps --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=backend" --format '{{.Names}}' | head -1)
if [ -z "$B" ]; then
  fail "no encuentro el contenedor backend del proyecto $PROJECT (SQLite sin copiar)"
else
  tmpd="$DEST/sqlite/.tmp"; rm -rf "$tmpd"; mkdir -p "$tmpd"
  if timeout 10m docker exec -i "$B" python - <<'PY'
import glob, os, sqlite3
os.makedirs('/tmp/dbbk', exist_ok=True)
for f in glob.glob('/app/data/*.db'):
    d = '/tmp/dbbk/' + os.path.basename(f)
    s = sqlite3.connect('file:%s?mode=ro' % f, uri=True)
    t = sqlite3.connect(d)
    s.backup(t)
    ok = t.execute('pragma quick_check').fetchone()[0]
    t.close(); s.close()
    if ok != 'ok':
        raise SystemExit('quick_check fallo en ' + f)
PY
  then
    docker cp "$B:/tmp/dbbk/." "$tmpd/" && docker exec "$B" rm -rf /tmp/dbbk
    for f in "$tmpd"/*.db; do
      [ -f "$f" ] || continue
      promover "$f" "$DEST/sqlite/$(basename "$f")" 1 && log "ok sqlite $(basename "$f")"
    done
  else
    fail "sqlite del backend: backup o quick_check falló"
  fi
  rm -rf "$tmpd"
fi

# 3) Adjuntos: volúmenes uploads y backend_data (sin los .db, que van arriba)
for v in $(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" | grep -E '(uploads|backend_data)$' | grep -v pruebas); do
  out="$DEST/vol_${v}.tgz"; tmp="$out.tmp"
  # el contenedor corre como root: el archivo se entrega a nuestro usuario (chown) para poder rotarlo/borrarlo
  if timeout 30m docker run --rm -v "$v":/v:ro -v "$DEST":/out alpine sh -c \
       "tar czf '/out/$(basename "$tmp")' -C /v --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' . \
        && chown $(id -u):$(id -g) '/out/$(basename "$tmp")'" && gzip -t "$tmp"; then
    promover "$tmp" "$out" 0 && log "ok volumen $v ($(stat -c %s "$out") B)"
  else
    fail "volumen $v: tar falló"; rm -f "$tmp"
  fi
done

if [ ${#FAILS[@]} -eq 0 ]; then
  date -u +%FT%TZ > "$DEST/LAST_SUCCESS"; rm -f "$DEST/LAST_FAILURE"
  log "== OK =="; exit 0
fi
printf '%s\n' "$(date -u +%FT%TZ)" "${FAILS[@]}" > "$DEST/LAST_FAILURE"
log "== TERMINÓ CON ${#FAILS[@]} FALLO(S) =="; exit 1
