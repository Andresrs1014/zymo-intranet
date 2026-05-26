#!/usr/bin/env python3
"""
Migración Gestión de Tareas V1 (SQLite) → V2 (PostgreSQL).

Tablas migradas (en orden de FK):
  task_teams              → teams
  task_team_members       → team_members
  work_tasks              → tasks         (+ genera list_configs desde sus valores)
  task_activity_log       → activity_logs
  task_events             → events
  task_event_participants → event_participants

Comportamiento:
  - CONTROL DE ESTADO: tabla _migration_control registra running/completed/failed.
    Si completó → no hace nada. Si falló → sale con error (sin duplicar datos).
  - SEGURO: solo escribe en V2_DATABASE_URL (task-db). No toca ninguna otra BD.
  - Maneja N gestores con equipos separados (cada uno tiene su TaskTeam en V1).
  - Resetea sequences de PostgreSQL al finalizar para que nuevos inserts no colisionen.

Variables de entorno:
  V1_SQLITE_PATH   — ruta al intranet.db de V1 (default: /app/data/intranet.db)
  V2_DATABASE_URL  — DSN PostgreSQL de task-db (default: postgresql://task:task@task-db:5432/taskdb)
  DRY_RUN          — "true" para simular sin escribir nada
  FORCE_REMIGRATE  — "true" para limpiar datos parciales y re-ejecutar desde cero
"""

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

V1_SQLITE_PATH: str = os.getenv("V1_SQLITE_PATH", "/app/data/intranet.db")
V2_DATABASE_URL: str = os.getenv("V2_DATABASE_URL", "postgresql://task:task@task-db:5432/taskdb")
DRY_RUN: bool = os.getenv("DRY_RUN", "false").lower() == "true"
FORCE_REMIGRATE: bool = os.getenv("FORCE_REMIGRATE", "false").lower() == "true"

MIGRATION_NAME = "v1_to_v2"

ROLE_MAP: dict[str, str] = {
    "owner": "co_gestor",
    "co_gestor": "co_gestor",
    "member": "member",
}

ACTION_MAP: dict[str, str] = {
    "creacion": "creacion",
    "cambio_estado": "cambio_estado",
    "edicion": "edicion",
    "eliminacion": "eliminacion",
    "asignacion": "asignacion",
    "adjunto_subido": "adjunto_subido",
    "adjunto_eliminado": "adjunto_eliminado",
}

DEFAULT_COLORS: dict[str, str] = {
    "pendiente": "#6b7280",
    "en_progreso": "#3b82f6",
    "revision": "#f59e0b",
    "completada": "#10b981",
    "cancelada": "#ef4444",
    "baja": "#6b7280",
    "media": "#3b82f6",
    "alta": "#f59e0b",
    "critica": "#ef4444",
}

# ── Helpers ────────────────────────────────────────────────────────────────────


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def slugify(s: str) -> str:
    s = s.strip().lower()
    for src, dst in [("á","a"),("à","a"),("é","e"),("è","e"),("í","i"),
                     ("ì","i"),("ó","o"),("ò","o"),("ú","u"),("ù","u"),("ñ","n")]:
        s = s.replace(src, dst)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:60] or "sin_valor"


def coerce_priority(raw: str | None) -> str:
    valid = {"baja", "media", "alta", "critica"}
    return raw.lower() if raw and raw.lower() in valid else "media"


def coerce_action(raw: str | None) -> str:
    return ACTION_MAP.get(raw or "", "edicion")


def pg_connect() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(V2_DATABASE_URL)
    conn.autocommit = False
    return conn


def sqlite_connect() -> sqlite3.Connection:
    if not os.path.exists(V1_SQLITE_PATH):
        log.error("SQLite no encontrado: %s", V1_SQLITE_PATH)
        sys.exit(1)
    conn = sqlite3.connect(V1_SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(lite: sqlite3.Connection, name: str) -> bool:
    return bool(lite.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
    ).fetchone())


def col_names(lite: sqlite3.Connection, table: str) -> set[str]:
    return {c[1] for c in lite.execute(f"PRAGMA table_info({table})").fetchall()}


# ── Migration control table ────────────────────────────────────────────────────


def ensure_migration_table(pg: psycopg2.extensions.connection) -> None:
    """Crea la tabla de control si no existe. Un commit propio para que persista."""
    cur = pg.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS _migration_control (
            migration_name TEXT        PRIMARY KEY,
            status         TEXT        NOT NULL DEFAULT 'running',
            started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at   TIMESTAMPTZ,
            error_msg      TEXT,
            teams_count    INT,
            tasks_count    INT,
            events_count   INT
        )
    """)
    pg.commit()


def get_migration_record(pg: psycopg2.extensions.connection) -> dict | None:
    """Devuelve el registro de control o None si nunca corrió."""
    cur = pg.cursor()
    cur.execute(
        "SELECT status, started_at, completed_at, error_msg "
        "FROM _migration_control WHERE migration_name = %s",
        (MIGRATION_NAME,),
    )
    row = cur.fetchone()
    if row is None:
        return None
    return {"status": row[0], "started_at": row[1], "completed_at": row[2], "error_msg": row[3]}


def set_migration_running(pg: psycopg2.extensions.connection) -> None:
    cur = pg.cursor()
    cur.execute(
        """
        INSERT INTO _migration_control (migration_name, status, started_at)
        VALUES (%s, 'running', NOW())
        ON CONFLICT (migration_name) DO UPDATE
            SET status = 'running', started_at = NOW(),
                error_msg = NULL, completed_at = NULL
        """,
        (MIGRATION_NAME,),
    )
    pg.commit()


def set_migration_completed(
    pg: psycopg2.extensions.connection,
    teams: int,
    tasks: int,
    events: int,
) -> None:
    cur = pg.cursor()
    cur.execute(
        """
        UPDATE _migration_control
        SET status = 'completed', completed_at = NOW(),
            teams_count = %s, tasks_count = %s, events_count = %s
        WHERE migration_name = %s
        """,
        (teams, tasks, events, MIGRATION_NAME),
    )
    pg.commit()


def set_migration_failed(pg: psycopg2.extensions.connection, error: str) -> None:
    """Registra el fallo. Usa su propio commit para no depender del estado de la TX."""
    try:
        pg.rollback()  # asegura que podemos escribir
        cur = pg.cursor()
        cur.execute(
            "UPDATE _migration_control SET status = 'failed', error_msg = %s "
            "WHERE migration_name = %s",
            (error[:1000], MIGRATION_NAME),
        )
        pg.commit()
    except Exception as exc:
        log.warning("No se pudo registrar fallo en _migration_control: %s", exc)


def purge_migrated_data(pg: psycopg2.extensions.connection) -> None:
    """
    Elimina todos los datos de las tablas migradas en orden FK inverso.
    Solo se llama con FORCE_REMIGRATE=true después de un fallo previo.
    """
    tables = [
        "event_participants",
        "activity_logs",
        "events",
        "tasks",
        "list_configs",
        "team_members",
        "teams",
    ]
    cur = pg.cursor()
    for tbl in tables:
        cur.execute(f"DELETE FROM {tbl}")
        log.info("  purge %-25s → %d filas eliminadas", tbl, cur.rowcount)
    pg.commit()
    log.info("Purge completado — tablas limpias para re-migración")


# ── Migration steps ────────────────────────────────────────────────────────────


def load_user_names(lite: sqlite3.Connection) -> dict[int, str]:
    names: dict[int, str] = {}
    for tbl in ("users", "user"):
        if table_exists(lite, tbl):
            try:
                for r in lite.execute(f"SELECT id, full_name, email FROM {tbl}").fetchall():
                    names[r["id"]] = r["full_name"] or r["email"] or f"Usuario {r['id']}"
                break
            except Exception:
                pass
    return names


def migrate_teams(lite: sqlite3.Connection, pg: psycopg2.extensions.connection) -> dict[int, int]:
    """task_teams → teams. Retorna {v1_id: v2_id}."""
    if not table_exists(lite, "task_teams"):
        log.warning("Tabla task_teams no encontrada — omitiendo teams")
        return {}

    rows = lite.execute(
        "SELECT id, name, owner_user_id, is_active, created_at, updated_at "
        "FROM task_teams ORDER BY id"
    ).fetchall()
    log.info("Teams V1: %d", len(rows))

    id_map: dict[int, int] = {}
    cur = pg.cursor()

    for r in rows:
        if DRY_RUN:
            log.info("  [DRY] team %d — %s (owner=%d)", r["id"], r["name"], r["owner_user_id"])
            id_map[r["id"]] = r["id"]
            continue

        cur.execute(
            """
            INSERT INTO teams (name, owner_user_id, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            (r["name"], r["owner_user_id"], bool(r["is_active"]),
             r["created_at"] or utcnow(), r["updated_at"] or utcnow()),
        )
        row = cur.fetchone()
        if row:
            new_id = row[0]
        else:
            cur.execute(
                "SELECT id FROM teams WHERE name = %s AND owner_user_id = %s",
                (r["name"], r["owner_user_id"]),
            )
            ex = cur.fetchone()
            if not ex:
                log.warning("  team %d no insertado ni encontrado, omitido", r["id"])
                continue
            new_id = ex[0]
            log.info("  team %d ya existe → v2.id=%d (%s)", r["id"], new_id, r["name"])

        id_map[r["id"]] = new_id
        log.info("  team %d → %d  (%s, owner=%d)", r["id"], new_id, r["name"], r["owner_user_id"])

    return id_map


def migrate_members(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
    user_names: dict[int, str],
) -> None:
    """task_team_members → team_members."""
    if not table_exists(lite, "task_team_members"):
        log.warning("Tabla task_team_members no encontrada — omitiendo members")
        return

    rows = lite.execute(
        "SELECT id, team_id, user_id, role, is_active, created_at, updated_at "
        "FROM task_team_members ORDER BY id"
    ).fetchall()
    log.info("Members V1: %d", len(rows))

    cur = pg.cursor()
    ok = skipped = 0

    for r in rows:
        v2_team = team_id_map.get(r["team_id"])
        if v2_team is None:
            skipped += 1
            continue

        v2_role = ROLE_MAP.get(r["role"] or "member", "member")
        nombre = user_names.get(r["user_id"], f"Usuario {r['user_id']}")

        if DRY_RUN:
            log.info("  [DRY] member user=%d team=%d role=%s", r["user_id"], v2_team, v2_role)
            ok += 1
            continue

        try:
            cur.execute(
                """
                INSERT INTO team_members
                    (team_id, user_id, user_nombre, role, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (team_id, user_id) DO NOTHING
                """,
                (v2_team, r["user_id"], nombre, v2_role, bool(r["is_active"]),
                 r["created_at"] or utcnow(), r["updated_at"] or utcnow()),
            )
            ok += 1
        except Exception as exc:
            log.warning("  member user=%d: %s", r["user_id"], exc)
            skipped += 1

    log.info("Members: %d ok, %d omitidos", ok, skipped)


def seed_list_configs(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> None:
    """
    Genera list_configs en V2 a partir de los valores únicos de work_tasks en V1.
    Garantiza que etiqueta/plataforma/estado/prioridad tengan entrada válida por equipo.
    """
    if not table_exists(lite, "work_tasks"):
        return

    collected: dict[tuple[int, str], set[str]] = {}
    for r in lite.execute("SELECT team_id, etiqueta, plataforma, estado, prioridad FROM work_tasks").fetchall():
        v2_team = team_id_map.get(r["team_id"])
        if v2_team is None:
            continue
        for col, lt in [("etiqueta","etiqueta"), ("plataforma","plataforma"),
                        ("estado","estado"), ("prioridad","prioridad")]:
            val = r[col]
            if val:
                key = (v2_team, lt)
                collected.setdefault(key, set()).add(val.strip())

    if DRY_RUN:
        for (tid, lt), vals in sorted(collected.items()):
            log.info("  [DRY] list_configs team=%d type=%s → %s", tid, lt, vals)
        return

    cur = pg.cursor()
    inserted = 0
    for (v2_team, lt), raw_vals in collected.items():
        for i, raw in enumerate(sorted(raw_vals)):
            slug = coerce_priority(raw) if lt == "prioridad" else slugify(raw)
            color = DEFAULT_COLORS.get(slug)
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
                    (v2_team, lt, slug, raw, color, i, is_final, is_canceled, is_initial),
                )
                if cur.rowcount > 0:
                    inserted += 1
            except Exception as exc:
                log.warning("  list_config team=%d %s=%s: %s", v2_team, lt, slug, exc)

    log.info("List configs insertados: %d", inserted)


def migrate_tasks(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> dict[int, int]:
    """work_tasks → tasks. Retorna {v1_id: v2_id}."""
    if not table_exists(lite, "work_tasks"):
        log.warning("Tabla work_tasks no encontrada — omitiendo tasks")
        return {}

    cols = col_names(lite, "work_tasks")
    has_modalidad = "modalidad" in cols

    rows = lite.execute(
        f"""
        SELECT id, team_id, subido_por_id, subido_por_nombre,
               asignado_a_id, asignado_a_nombre,
               titulo, descripcion_tecnica,
               etiqueta, plataforma, estado, prioridad,
               fecha, hora_inicio, hora_cierre, tiempo_total_minutos,
               {'modalidad,' if has_modalidad else ''}
               aceptacion, created_at, updated_at
        FROM work_tasks ORDER BY id
        """
    ).fetchall()
    log.info("Tasks V1: %d", len(rows))

    id_map: dict[int, int] = {}
    cur = pg.cursor()
    ok = skipped = 0

    for r in rows:
        v2_team = team_id_map.get(r["team_id"]) if r["team_id"] else None
        if v2_team is None:
            skipped += 1
            continue

        v2_etiqueta = slugify(r["etiqueta"] or "sin_etiqueta")
        v2_plataforma = slugify(r["plataforma"] or "transversal")
        v2_estado = slugify(r["estado"] or "pendiente")
        v2_prioridad = coerce_priority(r["prioridad"])
        v2_aceptacion = (
            r["aceptacion"] if r["aceptacion"] in ("pendiente", "aceptada", "rechazada")
            else "pendiente"
        )
        modalidad = r["modalidad"] if has_modalidad and r["modalidad"] else None

        if DRY_RUN:
            log.info("  [DRY] task %d: %s", r["id"], r["titulo"][:60])
            id_map[r["id"]] = r["id"]
            ok += 1
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
                    modalidad, aceptacion, version, created_at, updated_at
                ) VALUES (
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, 1, %s, %s
                )
                RETURNING id
                """,
                (
                    v2_team, r["subido_por_id"],
                    r["subido_por_nombre"] or f"Usuario {r['subido_por_id']}",
                    r["asignado_a_id"], r["asignado_a_nombre"] or None,
                    r["titulo"], r["descripcion_tecnica"] or None,
                    v2_etiqueta, v2_plataforma, v2_estado, v2_prioridad,
                    r["fecha"], r["hora_inicio"], r["hora_cierre"],
                    r["tiempo_total_minutos"],
                    modalidad, v2_aceptacion,
                    r["created_at"] or utcnow(), r["updated_at"] or utcnow(),
                ),
            )
            new_id: int = cur.fetchone()[0]
            id_map[r["id"]] = new_id
            ok += 1
        except Exception as exc:
            log.warning("  task %d (%s): %s", r["id"], r["titulo"][:40], exc)
            skipped += 1

    log.info("Tasks: %d ok, %d omitidas", ok, skipped)
    return id_map


def migrate_activity_log(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    task_id_map: dict[int, int],
) -> None:
    """task_activity_log → activity_logs."""
    if not table_exists(lite, "task_activity_log"):
        log.info("Tabla task_activity_log no encontrada — omitiendo")
        return

    rows = lite.execute(
        "SELECT id, task_id, user_id, user_nombre, accion, detalle, fecha "
        "FROM task_activity_log ORDER BY id"
    ).fetchall()
    log.info("ActivityLog V1: %d", len(rows))

    cur = pg.cursor()
    ok = skipped = 0

    for r in rows:
        v2_task = task_id_map.get(r["task_id"])
        if v2_task is None:
            skipped += 1
            continue

        if DRY_RUN:
            ok += 1
            continue

        try:
            cur.execute(
                """
                INSERT INTO activity_logs
                    (task_id, user_id, user_nombre, accion, detalle, campos, fecha)
                VALUES (%s, %s, %s, %s, %s, NULL, %s)
                """,
                (v2_task, r["user_id"],
                 r["user_nombre"] or f"Usuario {r['user_id']}",
                 coerce_action(r["accion"]),
                 r["detalle"], r["fecha"] or utcnow()),
            )
            ok += 1
        except Exception as exc:
            log.warning("  log task_id=%d: %s", r["task_id"], exc)
            skipped += 1

    log.info("ActivityLog: %d ok, %d omitidos", ok, skipped)


def migrate_events(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    team_id_map: dict[int, int],
) -> dict[int, int]:
    """task_events → events. Retorna {v1_event_id: v2_event_id}."""
    for tbl in ("task_events", "task_event"):
        if table_exists(lite, tbl):
            events_table = tbl
            break
    else:
        log.info("Tabla task_events no encontrada — omitiendo eventos")
        return {}

    cols = col_names(lite, events_table)
    has_modalidad = "modalidad" in cols
    has_sede = "sede" in cols
    has_descripcion = "descripcion" in cols

    rows = lite.execute(
        f"""
        SELECT id, team_id, owner_user_id,
               titulo,
               {'descripcion,' if has_descripcion else ''}
               plataforma, prioridad,
               {'modalidad,' if has_modalidad else ''}
               {'sede,' if has_sede else ''}
               fecha, hora_inicio, duracion_minutos,
               creado_por_id, creado_por_nombre,
               created_at, updated_at
        FROM {events_table} ORDER BY id
        """
    ).fetchall()
    log.info("Events V1: %d", len(rows))

    id_map: dict[int, int] = {}
    cur = pg.cursor()
    ok = skipped = 0

    for r in rows:
        v2_team = team_id_map.get(r["team_id"]) if r["team_id"] else None
        if v2_team is None:
            skipped += 1
            continue

        hora_str = str(r["hora_inicio"] or "09:00")[:5]

        if DRY_RUN:
            log.info("  [DRY] event %d: %s", r["id"], r["titulo"][:50])
            id_map[r["id"]] = r["id"]
            ok += 1
            continue

        try:
            cur.execute(
                """
                INSERT INTO events (
                    team_id, owner_user_id, titulo, descripcion,
                    plataforma, prioridad, modalidad, sede,
                    fecha, hora_inicio, duracion_minutos,
                    creado_por_id, creado_por_nombre,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s
                )
                RETURNING id
                """,
                (
                    v2_team,
                    r["owner_user_id"],
                    r["titulo"],
                    r["descripcion"] if has_descripcion else None,
                    r["plataforma"] or None,
                    r["prioridad"] or None,
                    r["modalidad"] if has_modalidad else None,
                    r["sede"] if has_sede else None,
                    r["fecha"],
                    hora_str,
                    r["duracion_minutos"] or 60,
                    r["creado_por_id"],
                    r["creado_por_nombre"] or f"Usuario {r['creado_por_id']}",
                    r["created_at"] or utcnow(),
                    r["updated_at"] or utcnow(),
                ),
            )
            new_id: int = cur.fetchone()[0]
            id_map[r["id"]] = new_id
            ok += 1
        except Exception as exc:
            log.warning("  event %d (%s): %s", r["id"], r["titulo"][:40], exc)
            skipped += 1

    log.info("Events: %d ok, %d omitidos", ok, skipped)
    return id_map


def migrate_event_participants(
    lite: sqlite3.Connection,
    pg: psycopg2.extensions.connection,
    event_id_map: dict[int, int],
) -> None:
    """task_event_participants → event_participants."""
    for tbl in ("task_event_participants", "task_event_participant"):
        if table_exists(lite, tbl):
            part_table = tbl
            break
    else:
        log.info("Tabla task_event_participants no encontrada — omitiendo participantes")
        return

    cols = col_names(lite, part_table)
    has_confirmado = "confirmado" in cols

    rows = lite.execute(
        f"""
        SELECT id, event_id, user_id, user_nombre,
               has_conflict, conflict_detail
               {',' + 'confirmado' if has_confirmado else ''}
        FROM {part_table} ORDER BY id
        """
    ).fetchall()
    log.info("EventParticipants V1: %d", len(rows))

    cur = pg.cursor()
    ok = skipped = 0

    for r in rows:
        v2_event = event_id_map.get(r["event_id"])
        if v2_event is None:
            skipped += 1
            continue

        if DRY_RUN:
            ok += 1
            continue

        try:
            cur.execute(
                """
                INSERT INTO event_participants
                    (event_id, user_id, user_nombre, has_conflict, conflict_detail, confirmado)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (event_id, user_id) DO NOTHING
                """,
                (
                    v2_event,
                    r["user_id"],
                    r["user_nombre"] or f"Usuario {r['user_id']}",
                    bool(r["has_conflict"]) if r["has_conflict"] is not None else False,
                    r["conflict_detail"] or None,
                    bool(r["confirmado"]) if has_confirmado and r["confirmado"] is not None else False,
                ),
            )
            ok += 1
        except Exception as exc:
            log.warning("  participant event_id=%d user=%d: %s", r["event_id"], r["user_id"], exc)
            skipped += 1

    log.info("EventParticipants: %d ok, %d omitidos", ok, skipped)


def reset_sequences(pg: psycopg2.extensions.connection) -> None:
    """
    Resetea las sequences de autoincrement de todas las tablas migradas.
    Garantiza que el próximo insert no colisione con IDs existentes.
    """
    tables = [
        "teams", "team_members", "list_configs",
        "tasks", "activity_logs", "events", "event_participants",
    ]
    cur = pg.cursor()
    for tbl in tables:
        try:
            cur.execute(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{tbl}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {tbl}), 1)
                )
                """
            )
            log.info("  sequence %-25s → reseteada", tbl)
        except Exception as exc:
            log.warning("  sequence %s: %s", tbl, exc)


# ── Main ───────────────────────────────────────────────────────────────────────


def main() -> None:
    log.info("=" * 60)
    log.info("Migración Gestión de Tareas V1 → V2")
    log.info("SQLite  : %s", V1_SQLITE_PATH)
    host_info = V2_DATABASE_URL.split("@")[-1] if "@" in V2_DATABASE_URL else V2_DATABASE_URL
    log.info("Postgres: %s", host_info)
    if DRY_RUN:
        log.info("*** DRY RUN — no se escribirá nada ***")
    if FORCE_REMIGRATE:
        log.warning("*** FORCE_REMIGRATE=true — se limpiarán los datos migrados previamente ***")
    log.info("=" * 60)

    lite = sqlite_connect()
    log.info("SQLite conectado OK")

    if DRY_RUN:
        pg = None  # type: ignore[assignment]
    else:
        pg = pg_connect()
        cur = pg.cursor()
        cur.execute("SELECT current_database()")
        db_name = cur.fetchone()[0]
        log.info("PostgreSQL conectado — BD: %s", db_name)

        if db_name not in ("taskdb", "task"):
            log.error(
                "BD '%s' no parece ser la task-db de V2. Verifica V2_DATABASE_URL.", db_name
            )
            sys.exit(1)

        # ── Control de estado ──────────────────────────────────────────────────
        ensure_migration_table(pg)
        record = get_migration_record(pg)

        if record:
            if record["status"] == "completed":
                log.info(
                    "✅  Migración ya completada el %s — sin cambios.",
                    record["completed_at"],
                )
                pg.close()
                lite.close()
                return

            if record["status"] in ("running", "failed") and not FORCE_REMIGRATE:
                log.error(
                    "⚠️  La migración previa quedó en estado '%s' (iniciada: %s).\n"
                    "   Detalle: %s\n"
                    "   Los datos pueden estar parcialmente migrados.\n"
                    "   Para reintentar desde cero: establece FORCE_REMIGRATE=true\n"
                    "   (esto limpiará las tablas teams/tasks/events y re-migrará todo)",
                    record["status"],
                    record["started_at"],
                    record["error_msg"] or "sin detalle",
                )
                pg.close()
                lite.close()
                sys.exit(1)

            if FORCE_REMIGRATE:
                log.warning("Limpiando datos parciales antes de re-migrar...")
                purge_migrated_data(pg)

        set_migration_running(pg)
        log.info("Estado de migración registrado como 'running'")

    # Cargar nombres de usuarios desde SQLite para desnormalización
    user_names = load_user_names(lite)
    log.info("Nombres de usuarios cargados: %d", len(user_names))

    team_id_map: dict[int, int] = {}
    task_id_map: dict[int, int] = {}
    event_id_map: dict[int, int] = {}

    try:
        log.info("\n[1/7] Migrando teams...")
        team_id_map = migrate_teams(lite, pg)

        log.info("\n[2/7] Migrando members...")
        migrate_members(lite, pg, team_id_map, user_names)

        log.info("\n[3/7] Seeding list_configs desde valores V1...")
        seed_list_configs(lite, pg, team_id_map)

        log.info("\n[4/7] Migrando tasks...")
        task_id_map = migrate_tasks(lite, pg, team_id_map)

        log.info("\n[5/7] Migrando activity_log...")
        migrate_activity_log(lite, pg, task_id_map)

        log.info("\n[6/7] Migrando events...")
        event_id_map = migrate_events(lite, pg, team_id_map)

        log.info("\n[7/7] Migrando event_participants...")
        migrate_event_participants(lite, pg, event_id_map)

        if not DRY_RUN:
            log.info("\nReseteando sequences de PostgreSQL...")
            reset_sequences(pg)
            pg.commit()
            set_migration_completed(pg, len(team_id_map), len(task_id_map), len(event_id_map))
            log.info("\n✅  Migración completada — COMMIT OK")
        else:
            log.info("\n✅  Dry run OK — sin cambios en PostgreSQL")

        log.info("\n--- Resumen ---")
        log.info("Teams   migrados : %d", len(team_id_map))
        log.info("Tasks   migradas : %d", len(task_id_map))
        log.info("Events  migrados : %d", len(event_id_map))

    except Exception as exc:
        log.error("ERROR FATAL: %s", exc, exc_info=True)
        if not DRY_RUN and pg:
            set_migration_failed(pg, str(exc))
            log.info("Estado registrado como 'failed' — PostgreSQL sin datos corruptos")
        sys.exit(1)

    finally:
        lite.close()
        if not DRY_RUN and pg:
            pg.close()


if __name__ == "__main__":
    main()
