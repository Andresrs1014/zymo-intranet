#!/usr/bin/env python3
"""
Migración Gestión de Tareas V1 (SQLite) → V2 (PostgreSQL).

Tablas V1 (SQLite — backend/data/intranet.db):
  task_teams        → teams          (V2 PostgreSQL)
  task_team_members → team_members
  work_tasks        → tasks
  task_activity_log → activity_logs

NO migra eventos ni adjuntos (no existían en V1).
Los ListConfigs son auto-seeded por V2 al primer acceso.

Uso:
  python migrate-v1-to-v2.py

Variables de entorno requeridas:
  V1_SQLITE_PATH   — ruta absoluta al intranet.db de V1
                     (default: /app/data/intranet.db  en Docker,
                               ../../backend/data/intranet.db  en local)
  V2_DATABASE_URL  — PostgreSQL DSN del task-backend V2
                     (default: postgresql://task:task@localhost:5434/taskdb)
  DRY_RUN          — si es "true", imprime lo que haría sin escribir nada
"""

import json
import logging
import os
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

_here = os.path.dirname(os.path.abspath(__file__))

V1_SQLITE_PATH: str = os.getenv(
    "V1_SQLITE_PATH",
    os.path.join(_here, "..", "..", "backend", "data", "intranet.db"),
)
V2_DATABASE_URL: str = os.getenv(
    "V2_DATABASE_URL",
    "postgresql://task:task@localhost:5434/taskdb",
)
DRY_RUN: bool = os.getenv("DRY_RUN", "false").lower() == "true"

# Mapeo de roles V1 → V2
ROLE_MAP: dict[str, str] = {
    "owner": "co_gestor",    # V1 "owner" → V2 co_gestor (owner en V2 es el team.owner_user_id)
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

# Valores de prioridad válidos en V2
VALID_PRIORITY = {"baja", "media", "alta", "critica"}

# ── Helpers ────────────────────────────────────────────────────────────────────


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def coerce_priority(raw: str | None) -> str:
    if raw and raw.lower() in VALID_PRIORITY:
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


# ── Migration steps ────────────────────────────────────────────────────────────


def migrate_teams(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
) -> dict[int, int]:
    """
    Migra task_teams → teams.
    Devuelve mapping {v1_team_id: v2_team_id}.
    """
    cur_lite = lite.execute(
        "SELECT id, name, owner_user_id, is_active, created_at, updated_at FROM task_teams ORDER BY id"
    )
    rows = cur_lite.fetchall()
    log.info("Teams V1 encontrados: %d", len(rows))

    id_map: dict[int, int] = {}
    cur_pg = pg.cursor()

    for r in rows:
        if DRY_RUN:
            log.info("  [DRY] team id=%d name=%s", r["id"], r["name"])
            id_map[r["id"]] = r["id"]  # placeholder
            continue

        cur_pg.execute(
            """
            INSERT INTO teams (name, owner_user_id, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
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
        new_id: int = cur_pg.fetchone()[0]
        id_map[r["id"]] = new_id
        log.info("  team %d → %d  (%s)", r["id"], new_id, r["name"])

    return id_map


def migrate_members(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> None:
    """Migra task_team_members → team_members."""
    cur_lite = lite.execute(
        "SELECT id, team_id, user_id, role, is_active, created_at, updated_at FROM task_team_members ORDER BY id"
    )
    rows = cur_lite.fetchall()
    log.info("Members V1 encontrados: %d", len(rows))

    cur_pg = pg.cursor()
    skipped = 0

    for r in rows:
        v2_team_id = team_id_map.get(r["team_id"])
        if v2_team_id is None:
            log.warning("  member %d: team_id=%d no encontrado en mapping, omitido", r["id"], r["team_id"])
            skipped += 1
            continue

        v2_role = ROLE_MAP.get(r["role"] or "member", "member")

        if DRY_RUN:
            log.info("  [DRY] member user=%d team=%d role=%s", r["user_id"], v2_team_id, v2_role)
            continue

        try:
            cur_pg.execute(
                """
                INSERT INTO team_members (team_id, user_id, role, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                (
                    v2_team_id,
                    r["user_id"],
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


def migrate_tasks(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> dict[int, int]:
    """
    Migra work_tasks → tasks.
    Devuelve mapping {v1_task_id: v2_task_id}.
    """
    cur_lite = lite.execute(
        """
        SELECT id, team_id, subido_por_id, subido_por_nombre,
               asignado_a_id, asignado_a_nombre,
               titulo, descripcion_tecnica,
               etiqueta, plataforma, estado, prioridad,
               fecha, hora_inicio, hora_cierre, tiempo_total_minutos,
               duracion_estimada_minutos, aceptacion,
               created_at, updated_at
        FROM work_tasks
        ORDER BY id
        """
    )
    rows = cur_lite.fetchall()
    log.info("Tasks V1 encontrados: %d", len(rows))

    id_map: dict[int, int] = {}
    cur_pg = pg.cursor()
    skipped = 0

    for r in rows:
        v2_team_id = team_id_map.get(r["team_id"]) if r["team_id"] else None
        if v2_team_id is None:
            # Tasks sin team en V1 van a un team por defecto no asignado — se omiten
            log.warning("  task %d sin team válido, omitido", r["id"])
            skipped += 1
            continue

        v2_priority = coerce_priority(r["prioridad"])

        # V1 aceptacion puede ser NULL → mapear a "pendiente"
        v2_aceptacion = r["aceptacion"] if r["aceptacion"] in ("pendiente", "aceptada", "rechazada") else "pendiente"

        if DRY_RUN:
            log.info("  [DRY] task %d %s", r["id"], r["titulo"][:50])
            id_map[r["id"]] = r["id"]
            continue

        try:
            cur_pg.execute(
                """
                INSERT INTO tasks (
                    team_id, subido_por_id, subido_por_nombre,
                    asignado_a_id, asignado_a_nombre,
                    titulo, descripcion_tecnica,
                    etiqueta, plataforma, estado, prioridad,
                    fecha, hora_inicio, hora_cierre, tiempo_total_minutos,
                    tiempo_estimado_minutos, aceptacion,
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
                    r["subido_por_nombre"] or "",
                    r["asignado_a_id"],
                    r["asignado_a_nombre"] or None,
                    r["titulo"],
                    r["descripcion_tecnica"] or None,
                    r["etiqueta"] or "sin_etiqueta",
                    r["plataforma"] or "transversal",
                    r["estado"] or "pendiente",
                    v2_priority,
                    r["fecha"],
                    r["hora_inicio"],
                    r["hora_cierre"],
                    r["tiempo_total_minutos"],
                    r["duracion_estimada_minutos"],
                    v2_aceptacion,
                    r["created_at"] or utcnow(),
                    r["updated_at"] or utcnow(),
                ),
            )
            new_id: int = cur_pg.fetchone()[0]
            id_map[r["id"]] = new_id
        except Exception as exc:
            log.warning("  task %d error: %s", r["id"], exc)
            skipped += 1

    log.info("Tasks migradas (omitidas: %d)", skipped)
    return id_map


def migrate_activity_log(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    task_id_map: dict[int, int],
) -> None:
    """Migra task_activity_log → activity_logs."""
    cur_lite = lite.execute(
        """
        SELECT id, task_id, user_id, user_nombre, accion, detalle, fecha
        FROM task_activity_log
        ORDER BY id
        """
    )
    rows = cur_lite.fetchall()
    log.info("ActivityLog V1 encontrados: %d", len(rows))

    cur_pg = pg.cursor()
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
            cur_pg.execute(
                """
                INSERT INTO activity_logs (task_id, user_id, user_nombre, accion, detalle, campos, fecha)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    v2_task_id,
                    r["user_id"],
                    r["user_nombre"] or "",
                    v2_action,
                    r["detalle"],
                    None,   # campos JSON — V1 no lo tenía
                    r["fecha"] or utcnow(),
                ),
            )
        except Exception as exc:
            log.warning("  log task=%d error: %s", r["task_id"], exc)
            skipped += 1

    log.info("ActivityLog migrado (omitidos: %d)", skipped)


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    log.info("=" * 60)
    log.info("Migración Gestión de Tareas V1 → V2")
    log.info("SQLite: %s", V1_SQLITE_PATH)
    log.info("PostgreSQL: %s", V2_DATABASE_URL.split("@")[-1])  # sin credenciales
    if DRY_RUN:
        log.info("MODO DRY RUN — no se escribirá nada en PostgreSQL")
    log.info("=" * 60)

    lite = sqlite_connect()
    log.info("SQLite conectado OK")

    if DRY_RUN:
        pg = None  # type: ignore[assignment]
    else:
        pg = pg_connect()
        log.info("PostgreSQL conectado OK")

    try:
        # 1 — Teams
        log.info("\n[1/4] Migrando teams...")
        team_id_map = migrate_teams(lite, pg)

        # 2 — Members
        log.info("\n[2/4] Migrando members...")
        migrate_members(lite, pg, team_id_map)

        # 3 — Tasks
        log.info("\n[3/4] Migrando tasks...")
        task_id_map = migrate_tasks(lite, pg, team_id_map)

        # 4 — Activity log
        log.info("\n[4/4] Migrando activity_log...")
        migrate_activity_log(lite, pg, task_id_map)

        if not DRY_RUN:
            pg.commit()
            log.info("\n✅  Migración completada y confirmada (COMMIT)")
        else:
            log.info("\n✅  Dry run completado — sin cambios en base de datos")

        # Summary
        log.info("\n--- Resumen ---")
        log.info("Teams   migrados: %d", len(team_id_map))
        log.info("Tasks   migradas: %d", len(task_id_map))

    except Exception as exc:
        log.error("ERROR FATAL: %s", exc, exc_info=True)
        if not DRY_RUN and pg:
            pg.rollback()
            log.info("ROLLBACK ejecutado — base de datos sin cambios")
        sys.exit(1)
    finally:
        lite.close()
        if not DRY_RUN and pg:
            pg.close()


if __name__ == "__main__":
    main()
