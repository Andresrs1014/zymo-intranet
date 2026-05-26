#!/usr/bin/env python3
"""
Migración Gestión de Tareas V1 (SQLite) → V2 (PostgreSQL).

Tablas V1 (SQLite — backend/data/intranet.db):
  task_teams        → teams
  task_team_members → team_members
  work_tasks        → tasks
  task_activity_log → activity_logs

Estrategia para listas (etiqueta, plataforma, estado):
  - Recopila todos los valores únicos de V1 por equipo
  - Los inserta como list_configs en V2 (upsert)
  - Las tareas quedan con valores válidos garantizados

Uso:
  python migrate-v1-to-v2.py

Variables de entorno:
  V1_SQLITE_PATH   — ruta al intranet.db de V1
                     (default: /app/data/intranet.db)
  V2_DATABASE_URL  — PostgreSQL DSN del task-backend V2
                     (default: postgresql://task:task@task-db:5432/taskdb)
  DRY_RUN          — "true" para simular sin escribir nada

Notas de seguridad:
  - Solo escribe en la base task-db (V2_DATABASE_URL)
  - No toca ninguna otra BD (ni la principal de la intranet)
  - Es idempotente: usa ON CONFLICT DO NOTHING en todos los inserts
  - En caso de error hace ROLLBACK completo
"""

import json
import logging
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("migrate-v1-to-v2")

# ── Config ─────────────────────────────────────────────────────────────────────

V1_SQLITE_PATH: str = os.getenv(
    "V1_SQLITE_PATH",
    "/app/data/intranet.db",
)
V2_DATABASE_URL: str = os.getenv(
    "V2_DATABASE_URL",
    "postgresql://task:task@task-db:5432/taskdb",
)
DRY_RUN: bool = os.getenv("DRY_RUN", "false").lower() == "true"

# Mapeo de roles V1 → V2
ROLE_MAP: dict[str, str] = {
    "owner": "co_gestor",
    "co_gestor": "co_gestor",
    "member": "member",
}

# Mapeo de acciones del log V1 → V2
ACTION_MAP: dict[str, str] = {
    "creacion": "creacion",
    "cambio_estado": "cambio_estado",
    "edicion": "edicion",
    "eliminacion": "eliminacion",
    "asignacion": "asignacion",
}

# Colores por defecto para list_configs generados desde V1
DEFAULT_COLORS: dict[str, str] = {
    # estados comunes
    "pendiente": "#6b7280",
    "en_progreso": "#3b82f6",
    "revision": "#f59e0b",
    "completada": "#10b981",
    "cancelada": "#ef4444",
    # prioridades
    "baja": "#6b7280",
    "media": "#3b82f6",
    "alta": "#f59e0b",
    "critica": "#ef4444",
}


# ── Helpers ────────────────────────────────────────────────────────────────────


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def slugify(s: str) -> str:
    """Convierte texto libre V1 a value slug para list_configs."""
    s = s.strip().lower()
    s = re.sub(r"[áà]", "a", s)
    s = re.sub(r"[éè]", "e", s)
    s = re.sub(r"[íì]", "i", s)
    s = re.sub(r"[óò]", "o", s)
    s = re.sub(r"[úù]", "u", s)
    s = re.sub(r"ñ", "n", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = s.strip("_")
    return s[:60] or "sin_valor"


def coerce_priority(raw: str | None) -> str:
    valid = {"baja", "media", "alta", "critica"}
    if raw and raw.lower() in valid:
        return raw.lower()
    return "media"


def coerce_action(raw: str | None) -> str:
    return ACTION_MAP.get(raw or "", "edicion")


def pg_connect() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(V2_DATABASE_URL)
    conn.autocommit = False
    return conn


def sqlite_connect() -> sqlite3.Connection:
    if not os.path.exists(V1_SQLITE_PATH):
        log.error("Archivo SQLite no encontrado: %s", V1_SQLITE_PATH)
        sys.exit(1)
    conn = sqlite3.connect(V1_SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def check_v1_tables(lite: sqlite3.Connection) -> None:
    """Verifica que las tablas V1 esperadas existan."""
    tables = {r[0] for r in lite.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    required = {"task_teams", "task_team_members", "work_tasks"}
    missing = required - tables
    if missing:
        log.error("Tablas V1 no encontradas en el SQLite: %s", missing)
        log.error("Tablas disponibles: %s", tables)
        sys.exit(1)
    log.info("Tablas V1 verificadas: %s", required)


# ── Migration steps ────────────────────────────────────────────────────────────


def migrate_teams(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
) -> dict[int, int]:
    """Migra task_teams → teams. Devuelve {v1_id: v2_id}."""
    rows = lite.execute(
        "SELECT id, name, owner_user_id, is_active, created_at, updated_at "
        "FROM task_teams ORDER BY id"
    ).fetchall()
    log.info("Teams V1 encontrados: %d", len(rows))

    id_map: dict[int, int] = {}
    cur = pg.cursor()

    for r in rows:
        if DRY_RUN:
            log.info("  [DRY] team id=%d name=%s", r["id"], r["name"])
            id_map[r["id"]] = r["id"]
            continue

        # Idempotente: si ya existe un team con el mismo nombre y owner no duplica
        cur.execute(
            """
            INSERT INTO teams (name, owner_user_id, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            (
                r["name"],
                r["owner_user_id"],
                bool(r["is_active"]),
                r["created_at"] or utcnow(),
                r["updated_at"] or utcnow(),
            ),
        )
        row = cur.fetchone()
        if row:
            new_id = row[0]
            log.info("  team %d → %d  (%s)", r["id"], new_id, r["name"])
        else:
            # Ya existía — buscar el id actual
            cur.execute(
                "SELECT id FROM teams WHERE name = %s AND owner_user_id = %s",
                (r["name"], r["owner_user_id"]),
            )
            existing = cur.fetchone()
            if existing:
                new_id = existing[0]
                log.info("  team %d ya existe → %d  (%s)", r["id"], new_id, r["name"])
            else:
                log.warning("  team %d no se pudo insertar ni encontrar, omitido", r["id"])
                continue

        id_map[r["id"]] = new_id

    return id_map


def migrate_members(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> None:
    """Migra task_team_members → team_members."""
    # Intentar obtener user_nombre del SQLite (tabla users de la intranet)
    user_names: dict[int, str] = {}
    try:
        for r in lite.execute("SELECT id, full_name, email FROM users").fetchall():
            user_names[r["id"]] = r["full_name"] or r["email"] or f"Usuario {r['id']}"
    except Exception:
        log.warning("  No se pudo leer tabla 'users' del SQLite para nombres")

    rows = lite.execute(
        "SELECT id, team_id, user_id, role, is_active, created_at, updated_at "
        "FROM task_team_members ORDER BY id"
    ).fetchall()
    log.info("Members V1 encontrados: %d", len(rows))

    cur = pg.cursor()
    skipped = 0

    for r in rows:
        v2_team_id = team_id_map.get(r["team_id"])
        if v2_team_id is None:
            log.warning("  member %d: team_id=%d sin mapping, omitido", r["id"], r["team_id"])
            skipped += 1
            continue

        v2_role = ROLE_MAP.get(r["role"] or "member", "member")
        user_nombre = user_names.get(r["user_id"], f"Usuario {r['user_id']}")

        if DRY_RUN:
            log.info("  [DRY] member user=%d team=%d role=%s", r["user_id"], v2_team_id, v2_role)
            continue

        try:
            cur.execute(
                """
                INSERT INTO team_members
                    (team_id, user_id, user_nombre, role, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                (
                    v2_team_id,
                    r["user_id"],
                    user_nombre,
                    v2_role,
                    bool(r["is_active"]),
                    r["created_at"] or utcnow(),
                    r["updated_at"] or utcnow(),
                ),
            )
        except Exception as exc:
            log.warning("  member user=%d team=%d error: %s", r["user_id"], v2_team_id, exc)
            skipped += 1

    log.info("Members migrados (omitidos: %d)", skipped)


def seed_list_configs_from_v1(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> None:
    """
    Extrae todos los valores únicos de etiqueta/plataforma/estado/prioridad
    de work_tasks en V1 y los inserta como list_configs en V2.
    Esto garantiza que las tareas migradas tengan valores válidos.
    """
    log.info("Seeding list_configs desde valores V1...")

    # Recopilar valores únicos por (team_id, list_type)
    collected: dict[tuple[int, str], set[str]] = {}

    rows = lite.execute(
        "SELECT team_id, etiqueta, plataforma, estado, prioridad FROM work_tasks"
    ).fetchall()

    for r in rows:
        v2_team_id = team_id_map.get(r["team_id"])
        if v2_team_id is None:
            continue
        for col, list_type in [
            ("etiqueta", "etiqueta"),
            ("plataforma", "plataforma"),
            ("estado", "estado"),
            ("prioridad", "prioridad"),
        ]:
            val = r[col]
            if val:
                key = (v2_team_id, list_type)
                if key not in collected:
                    collected[key] = set()
                collected[key].add(val.strip())

    if DRY_RUN:
        for (team_id, lt), vals in sorted(collected.items()):
            log.info("  [DRY] list_configs team=%d type=%s valores=%s", team_id, lt, vals)
        return

    cur = pg.cursor()
    inserted = 0

    for (v2_team_id, list_type), raw_values in collected.items():
        for i, raw_val in enumerate(sorted(raw_values)):
            slug = slugify(raw_val) if list_type != "prioridad" else coerce_priority(raw_val)
            label = raw_val
            color = DEFAULT_COLORS.get(slug)

            # Flags especiales para estado
            is_final = slug in ("completada", "cerrada", "finalizada", "done")
            is_canceled = slug in ("cancelada", "cancelado", "canceled")
            is_initial = slug in ("pendiente", "nuevo", "abierto", "open")

            try:
                cur.execute(
                    """
                    INSERT INTO list_configs
                        (team_id, list_type, value, label, color, sort_order,
                         is_active, is_final, is_canceled, is_initial_assignment,
                         created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, true, %s, %s, %s, now(), now())
                    ON CONFLICT (team_id, list_type, value) DO NOTHING
                    """,
                    (
                        v2_team_id,
                        list_type,
                        slug,
                        label,
                        color,
                        i,
                        is_final,
                        is_canceled,
                        is_initial,
                    ),
                )
                if cur.rowcount > 0:
                    inserted += 1
            except Exception as exc:
                log.warning(
                    "  list_config team=%d type=%s value=%s error: %s",
                    v2_team_id, list_type, slug, exc,
                )

    log.info("List configs insertados: %d", inserted)


def migrate_tasks(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> dict[int, int]:
    """Migra work_tasks → tasks. Devuelve {v1_task_id: v2_task_id}."""
    # Detectar columnas disponibles en V1 (el schema puede variar)
    cols_info = lite.execute("PRAGMA table_info(work_tasks)").fetchall()
    col_names = {c[1] for c in cols_info}
    log.info("Columnas en work_tasks V1: %s", sorted(col_names))

    has_modalidad = "modalidad" in col_names

    rows = lite.execute(
        f"""
        SELECT id, team_id, subido_por_id, subido_por_nombre,
               asignado_a_id, asignado_a_nombre,
               titulo, descripcion_tecnica,
               etiqueta, plataforma, estado, prioridad,
               fecha, hora_inicio, hora_cierre, tiempo_total_minutos,
               {'modalidad,' if has_modalidad else ''}
               aceptacion, created_at, updated_at
        FROM work_tasks
        ORDER BY id
        """
    ).fetchall()
    log.info("Tasks V1 encontrados: %d", len(rows))

    id_map: dict[int, int] = {}
    cur = pg.cursor()
    skipped = 0

    for r in rows:
        v2_team_id = team_id_map.get(r["team_id"]) if r["team_id"] else None
        if v2_team_id is None:
            log.warning("  task %d sin team válido, omitido", r["id"])
            skipped += 1
            continue

        # Normalizar valores a slugs consistentes con list_configs
        v2_etiqueta = slugify(r["etiqueta"] or "sin_etiqueta")
        v2_plataforma = slugify(r["plataforma"] or "transversal")
        v2_estado = slugify(r["estado"] or "pendiente")
        v2_prioridad = coerce_priority(r["prioridad"])

        v2_aceptacion = (
            r["aceptacion"]
            if r["aceptacion"] in ("pendiente", "aceptada", "rechazada")
            else "pendiente"
        )

        modalidad_val = None
        if has_modalidad:
            modalidad_val = r["modalidad"] if r["modalidad"] else None

        if DRY_RUN:
            log.info("  [DRY] task %d: %s", r["id"], r["titulo"][:60])
            id_map[r["id"]] = r["id"]
            continue

        try:
            cur.execute(
                """
                INSERT INTO tasks (
                    team_id, subido_por_id, subido_por_nombre,
                    asignado_a_id, asignado_a_nombre,
                    titulo, descripcion_tecnica,
                    etiqueta, plataforma, estado, prioridad,
                    fecha, hora_inicio, hora_cierre, tiempo_total_minutos,
                    modalidad, aceptacion,
                    version, created_at, updated_at
                ) VALUES (
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    1, %s, %s
                )
                RETURNING id
                """,
                (
                    v2_team_id,
                    r["subido_por_id"],
                    r["subido_por_nombre"] or f"Usuario {r['subido_por_id']}",
                    r["asignado_a_id"],
                    r["asignado_a_nombre"] or None,
                    r["titulo"],
                    r["descripcion_tecnica"] or None,
                    v2_etiqueta,
                    v2_plataforma,
                    v2_estado,
                    v2_prioridad,
                    r["fecha"],
                    r["hora_inicio"],
                    r["hora_cierre"],
                    r["tiempo_total_minutos"],
                    modalidad_val,
                    v2_aceptacion,
                    r["created_at"] or utcnow(),
                    r["updated_at"] or utcnow(),
                ),
            )
            new_id: int = cur.fetchone()[0]
            id_map[r["id"]] = new_id
        except Exception as exc:
            log.warning("  task %d (%s) error: %s", r["id"], r["titulo"][:40], exc)
            skipped += 1

    log.info("Tasks migradas: %d  (omitidas: %d)", len(id_map), skipped)
    return id_map


def migrate_activity_log(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    task_id_map: dict[int, int],
) -> None:
    """Migra task_activity_log → activity_logs."""
    # Verificar si la tabla existe
    tables = {r[0] for r in lite.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    if "task_activity_log" not in tables:
        log.info("Tabla task_activity_log no encontrada en V1 — omitiendo")
        return

    rows = lite.execute(
        "SELECT id, task_id, user_id, user_nombre, accion, detalle, fecha "
        "FROM task_activity_log ORDER BY id"
    ).fetchall()
    log.info("ActivityLog V1 encontrados: %d", len(rows))

    cur = pg.cursor()
    skipped = 0

    for r in rows:
        v2_task_id = task_id_map.get(r["task_id"])
        if v2_task_id is None:
            skipped += 1
            continue

        v2_action = coerce_action(r["accion"])

        if DRY_RUN:
            log.info("  [DRY] log task=%d action=%s", v2_task_id, v2_action)
            continue

        try:
            cur.execute(
                """
                INSERT INTO activity_logs
                    (task_id, user_id, user_nombre, accion, detalle, campos, fecha)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    v2_task_id,
                    r["user_id"],
                    r["user_nombre"] or f"Usuario {r['user_id']}",
                    v2_action,
                    r["detalle"],
                    None,  # campos JSON no existía en V1
                    r["fecha"] or utcnow(),
                ),
            )
        except Exception as exc:
            log.warning("  log task_id=%d error: %s", r["task_id"], exc)
            skipped += 1

    log.info("ActivityLog migrado (omitidos: %d)", skipped)


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    log.info("=" * 60)
    log.info("Migración Gestión de Tareas V1 → V2")
    log.info("SQLite : %s", V1_SQLITE_PATH)
    host_info = V2_DATABASE_URL.split("@")[-1] if "@" in V2_DATABASE_URL else V2_DATABASE_URL
    log.info("Postgres: %s", host_info)
    if DRY_RUN:
        log.info("*** MODO DRY RUN — no se escribirá nada en PostgreSQL ***")
    log.info("=" * 60)

    lite = sqlite_connect()
    log.info("SQLite conectado OK")
    check_v1_tables(lite)

    if DRY_RUN:
        pg = None  # type: ignore[assignment]
    else:
        pg = pg_connect()
        log.info("PostgreSQL conectado OK  →  %s", host_info)
        # Confirmar que NO es la BD principal de la intranet
        cur = pg.cursor()
        cur.execute("SELECT current_database()")
        db_name = cur.fetchone()[0]
        log.info("Base de datos conectada: %s", db_name)
        if db_name not in ("taskdb", "task"):
            log.error(
                "La BD '%s' no parece ser la task-db de V2. "
                "Verifica V2_DATABASE_URL antes de continuar.",
                db_name,
            )
            sys.exit(1)

    try:
        log.info("\n[1/5] Migrando teams...")
        team_id_map = migrate_teams(lite, pg)

        log.info("\n[2/5] Migrando members...")
        migrate_members(lite, pg, team_id_map)

        log.info("\n[3/5] Seeding list_configs desde valores V1...")
        seed_list_configs_from_v1(lite, pg, team_id_map)

        log.info("\n[4/5] Migrando tasks...")
        task_id_map = migrate_tasks(lite, pg, team_id_map)

        log.info("\n[5/5] Migrando activity_log...")
        migrate_activity_log(lite, pg, task_id_map)

        if not DRY_RUN:
            pg.commit()
            log.info("\n✅  Migración completada — COMMIT ejecutado")
        else:
            log.info("\n✅  Dry run completado — sin cambios en PostgreSQL")

        log.info("\n--- Resumen ---")
        log.info("Teams   migrados : %d", len(team_id_map))
        log.info("Tasks   migradas : %d", len(task_id_map))

    except Exception as exc:
        log.error("ERROR FATAL: %s", exc, exc_info=True)
        if not DRY_RUN and pg:
            pg.rollback()
            log.info("ROLLBACK ejecutado — PostgreSQL sin cambios")
        sys.exit(1)

    finally:
        lite.close()
        if not DRY_RUN and pg:
            pg.close()


if __name__ == "__main__":
    main()
