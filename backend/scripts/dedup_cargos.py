"""
Migración: cargos globales — deduplicar ptc_cargo y eliminar NOT NULL en empresa_id.

Ejecutar UNA vez dentro del contenedor ANTES de desplegar el nuevo código:

    docker compose exec backend python scripts/dedup_cargos.py --db /app/data/personal.db
    # revisar el output, luego:
    docker compose exec backend python scripts/dedup_cargos.py --db /app/data/personal.db --yes

ADVERTENCIA: Hacer backup de la BD antes si hay datos en producción.
"""
import argparse
import sqlite3
from collections import defaultdict


def run(db_path: str, dry_run: bool) -> None:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row

    rows = con.execute("SELECT id, nombre FROM ptc_cargo ORDER BY nombre").fetchall()
    print(f"Cargos actuales: {len(rows)}")

    # Agrupar por nombre normalizado
    groups: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        groups[r["nombre"].strip().lower()].append(r["id"])

    duplicates = {k: sorted(v) for k, v in groups.items() if len(v) > 1}

    if duplicates:
        print(f"\nDuplicados encontrados ({len(duplicates)}):")
        for nombre, ids in duplicates.items():
            print(f"  '{nombre}': ids {ids} → conservar {ids[0]}, eliminar {ids[1:]}")
    else:
        print("Sin duplicados.")

    # Contar personas afectadas
    total_remap = 0
    for ids in duplicates.values():
        for old_id in ids[1:]:
            count = con.execute(
                "SELECT COUNT(*) FROM ptc_persona WHERE cargo_id = ?", (old_id,)
            ).fetchone()[0]
            total_remap += count

    print(f"\nPersonas a re-asignar: {total_remap}")

    if dry_run:
        print("\n[DRY RUN] Pasa --yes para aplicar los cambios.")
        con.close()
        return

    # ── Fase 1: reasignar personas y eliminar duplicados ─────────────────────────
    for ids in duplicates.values():
        keep_id = ids[0]
        for old_id in ids[1:]:
            con.execute(
                "UPDATE ptc_persona SET cargo_id = ? WHERE cargo_id = ?",
                (keep_id, old_id),
            )
            con.execute("DELETE FROM ptc_cargo WHERE id = ?", (old_id,))
    con.commit()
    print("Fase 1 completada: duplicados eliminados y personas re-asignadas.")

    # ── Fase 2: recrear tabla sin NOT NULL en empresa_id ────────────────────────
    # executescript hace COMMIT implícito antes de ejecutar — seguro tras commit anterior
    con.executescript("""
        DROP TABLE IF EXISTS ptc_cargo_new;

        CREATE TABLE ptc_cargo_new (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER,
            area_id    INTEGER,
            nombre     TEXT NOT NULL
        );

        INSERT INTO ptc_cargo_new (id, empresa_id, area_id, nombre)
            SELECT id, NULL, area_id, nombre FROM ptc_cargo;

        DROP TABLE ptc_cargo;

        ALTER TABLE ptc_cargo_new RENAME TO ptc_cargo;
    """)

    final_count = con.execute("SELECT COUNT(*) FROM ptc_cargo").fetchone()[0]
    print(f"Fase 2 completada: tabla reconstruida. Cargos finales: {final_count}")
    con.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migración de cargos a modelo global.")
    parser.add_argument("--db", default="/app/data/personal.db", help="Ruta al archivo SQLite")
    parser.add_argument("--yes", action="store_true", help="Aplicar cambios (sin esta flag = dry-run)")
    args = parser.parse_args()
    run(args.db, dry_run=not args.yes)
