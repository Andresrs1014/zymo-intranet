"""
Migra intranet.db (SQLite) → zymo-db (PostgreSQL).
Idempotente: ON CONFLICT DO NOTHING — seguro correrlo varias veces.

Uso dentro del contenedor:
    docker exec zymo-intranet-backend-1 python /app/scripts/migrate_intranet.py
"""
import json
import os
import sqlite3
import sys

sys.path.insert(0, "/app")

from sqlalchemy import Boolean, create_engine, text
from sqlmodel import SQLModel

# ── Modelos — registro en SQLModel.metadata ────────────────────────────────────
from app.models.area import Area
from app.models.draft import FormDraft
from app.models.extraction_review import ExtractionReview
from app.models.learned_synonym import LearnedSynonym
from app.models.role import Role
from app.models.sede import Sede
from app.models.user import User
from app.models.user_tool import UserTool

SQLITE_PATH = "/app/data/intranet.db"
TABLES = [
    "area",
    "sede",
    "role",
    "user",
    "user_tools",
    "form_drafts",
    "learned_synonyms",
    "extraction_reviews",
]

# ── JSON columns que SQLite guarda como texto ──────────────────────────────────
JSON_COLUMNS = {
    "role": {"app_permissions"},
    "form_drafts": {"contexto", "payload", "archivos"},
}


def get_bool_columns(table_name: str) -> set:
    if table_name not in SQLModel.metadata.tables:
        return set()
    tbl = SQLModel.metadata.tables[table_name]
    return {col.name for col in tbl.columns if isinstance(col.type, Boolean)}


def parse_value(table: str, col: str, val, bool_cols: set):
    if val is None:
        return val
    if col in bool_cols and isinstance(val, int):
        return bool(val)
    if table in JSON_COLUMNS and col in JSON_COLUMNS[table]:
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return val
    return val


def migrate():
    pg_url = os.environ.get("ZYMO_DATABASE_URL", "")
    if not pg_url:
        print("ERROR: ZYMO_DATABASE_URL no está configurada en el contenedor.")
        sys.exit(1)

    # asyncpg no sirve para operaciones síncronas — usar psycopg2
    pg_url = pg_url.replace("+asyncpg", "")

    print(f"Conectando a PostgreSQL: {pg_url.split('@')[-1]}")
    pg_engine = create_engine(pg_url)

    print("Creando tablas en zymo-db...")
    intranet_tables = [
        SQLModel.metadata.tables[t]
        for t in TABLES
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(pg_engine, tables=intranet_tables)
    print("Tablas listas.\n")

    sqlite_con = sqlite3.connect(SQLITE_PATH)
    sqlite_con.row_factory = sqlite3.Row

    total_inserted = 0

    with pg_engine.begin() as pg_con:
        for table in TABLES:
            try:
                rows = sqlite_con.execute(f'SELECT * FROM "{table}"').fetchall()
            except Exception as e:
                print(f"  {table}: no encontrada en SQLite ({e})")
                continue

            if not rows:
                print(f"  {table}: vacía — skip")
                continue

            cols = list(rows[0].keys())
            bool_cols = get_bool_columns(table)
            inserted = skipped = 0

            for row in rows:
                d = {col: parse_value(table, col, row[col], bool_cols) for col in cols}
                cols_sql = ", ".join(f'"{c}"' for c in cols)
                vals_sql = ", ".join(f":{c}" for c in cols)
                stmt = text(
                    f'INSERT INTO "{table}" ({cols_sql}) VALUES ({vals_sql}) '
                    f"ON CONFLICT DO NOTHING"
                )
                result = pg_con.execute(stmt, d)
                if result.rowcount > 0:
                    inserted += 1
                else:
                    skipped += 1

            print(f"  {table}: {inserted} insertadas, {skipped} ya existían")
            total_inserted += inserted

    sqlite_con.close()
    print(f"\n✅ Migración completada — {total_inserted} filas totales migradas a zymo-db.")


if __name__ == "__main__":
    migrate()
