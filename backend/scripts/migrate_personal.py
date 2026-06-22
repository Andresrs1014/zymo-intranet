#!/usr/bin/env python3
"""
Migración inicial de personas desde el export JS del Directorio ZYMO.

Corre DENTRO del contenedor Docker donde vive el SQLite:

  # 1. Copiar el archivo JS al contenedor
  docker cp "C:/Proyectos a indexar/Directorio/Data_Personal_ZYMO_2026-06-17 (1).js" zymo-intranet-backend-1:/tmp/zymo_data.js

  # 2. Dry-run (ver qué haría, sin escribir)
  docker compose exec backend python scripts/migrate_personal.py

  # 3. Aplicar
  docker compose exec backend python scripts/migrate_personal.py --yes

Opciones:
  --src  <ruta>   Ruta al archivo JS (default: /tmp/zymo_data.js)
  --db   <ruta>   Ruta al SQLite (default: /app/data/personal.db)
  --yes           Aplicar cambios (sin --yes = dry-run)
"""

import json
import re
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path

_DEFAULT_SRC = Path("/tmp/zymo_data.js")
_DEFAULT_DB = Path("/app/data/personal.db")


def _arg(flag: str, default: str | None = None) -> str | None:
    for i, a in enumerate(sys.argv[:-1]):
        if a == flag:
            return sys.argv[i + 1]
    return default


def _parse_js(path: Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8")
    raw = re.sub(r"^/\*.*?\*/\s*", "", raw, flags=re.DOTALL)
    raw = re.sub(r"^window\.\w+\s*=\s*", "", raw.strip())
    raw = re.sub(r";\s*window\..*$", "", raw, flags=re.DOTALL).strip()
    return json.loads(raw)["people"]


def _parse_date(value: str) -> str | None:
    """Parse DD/M/YYYY or DD/MM/YYYY → YYYY-MM-DD, or None."""
    s = (value or "").strip()
    if not s:
        return None
    # Try ISO first
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    # Try DD/M/YYYY or D/MM/YYYY
    try:
        parts = s.split("/")
        if len(parts) == 3:
            return date(int(parts[2]), int(parts[1]), int(parts[0])).isoformat()
    except (ValueError, IndexError):
        pass
    return None


def migrate(src: Path, db_path: Path, dry_run: bool) -> None:
    if not src.exists():
        sys.exit(
            f"Archivo no encontrado: {src}\n"
            "Cópialo al contenedor con:\n"
            '  docker cp "C:/Proyectos a indexar/Directorio/Data_Personal_ZYMO_2026-06-17 (1).js" '
            "zymo-intranet-backend-1:/tmp/zymo_data.js"
        )
    if not db_path.exists():
        sys.exit(
            f"Base de datos no encontrada: {db_path}\n"
            "Asegúrate de que el backend haya iniciado al menos una vez (crea las tablas)."
        )

    people = _parse_js(src)
    print(f"Leyendo {len(people)} personas desde {src.name}")

    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # Cargar empresas (legacy_id → id, codigo)
    empresas = {row["legacy_id"]: row for row in cur.execute("SELECT * FROM ptc_empresa").fetchall()}
    if not empresas:
        con.close()
        sys.exit("ptc_empresa está vacía. Inicia el backend una vez para seedear las empresas.")
    print(f"Empresas: {[f'{k}={row[\"codigo\"]}' for k, row in sorted(empresas.items())]}")

    # Cargar cargos existentes
    cargo_cache: dict[tuple[int, str], int] = {
        (row["empresa_id"], row["nombre"].lower()): row["id"]
        for row in cur.execute("SELECT id, empresa_id, nombre FROM ptc_cargo").fetchall()
    }

    now = datetime.utcnow().isoformat()
    created = 0
    skipped = 0
    errors: list[str] = []

    for p in people:
        legacy_id = str(p["id"])

        # Skip duplicados
        row = cur.execute("SELECT id FROM ptc_persona WHERE legacy_id = ?", (legacy_id,)).fetchone()
        if row:
            skipped += 1
            continue

        company_legacy = p.get("companyId")
        empresa = empresas.get(company_legacy)
        if not empresa:
            errors.append(f"{p['name']}: companyId={company_legacy} desconocido")
            skipped += 1
            continue

        empresa_id = empresa["id"]

        # Cargo (autocreate por empresa)
        cargo_id = None
        role_raw = (p.get("role") or "").strip()
        if role_raw:
            key = (empresa_id, role_raw.lower())
            if key not in cargo_cache:
                if not dry_run:
                    cur.execute(
                        "INSERT INTO ptc_cargo (empresa_id, area_id, nombre) VALUES (?, NULL, ?)",
                        (empresa_id, role_raw),
                    )
                    cargo_cache[key] = cur.lastrowid
            cargo_id = cargo_cache.get(key)

        initials = (p.get("initials") or "").strip() or "".join(
            w[0].upper() for w in p["name"].split()[:2] if w
        )

        if not dry_run:
            cur.execute(
                """INSERT INTO ptc_persona
                   (legacy_id, nombre, initials, documento,
                    empresa_id, area_id, cargo_id,
                    genero, rh, email, email_corporativo, telefono, telefono_corporativo, foto_url,
                    tipo_contrato, fecha_ingreso, antiguedad_label,
                    estado, tipo_salida, fecha_salida,
                    idp_active, idp_eligible,
                    user_id, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    legacy_id,
                    p["name"].strip(),
                    initials,
                    str(p.get("document") or "").strip(),
                    empresa_id,
                    None,  # area_id — todas vacías en el export
                    cargo_id,
                    (p.get("gender") or "").strip(),
                    (p.get("rh") or "").strip(),
                    (p.get("email") or "").strip(),
                    (p.get("corporateEmail") or "").strip(),
                    str(p.get("phone") or "").strip(),
                    "",  # telefono_corporativo — no está en el export
                    "",  # foto_url
                    (p.get("contract") or "Término indefinido").strip(),
                    _parse_date(p.get("joined") or ""),
                    "",  # antiguedad_label
                    (p.get("status") or "Activo").strip(),
                    (p.get("exitType") or "").strip(),
                    _parse_date(p.get("exitDate") or ""),
                    1 if p.get("idpActive") else 0,
                    1 if p.get("idpEligible", True) else 0,
                    None,  # user_id
                    now,
                    now,
                ),
            )
        created += 1

    if not dry_run:
        con.commit()
    con.close()

    mode = "DRY-RUN" if dry_run else "MIGRADO"
    print(f"\n[{mode}] Creadas: {created} | Saltadas: {skipped}")
    if errors:
        print(f"Errores ({len(errors)}):")
        for e in errors:
            print(f"  {e}")
    if dry_run:
        print("\nEjecuta con --yes para aplicar los cambios.")


if __name__ == "__main__":
    src = Path(_arg("--src") or _DEFAULT_SRC)
    db_path = Path(_arg("--db") or _DEFAULT_DB)
    dry_run = "--yes" not in sys.argv
    migrate(src, db_path, dry_run)
