#!/usr/bin/env python3
"""
Reset destructivo de datos transaccionales OC + Financiero (solo SQLite / QA).

Uso (desde el directorio backend/, con .env cargado):
  python scripts/reset_oc_financiero_qa.py --dry-run
  python scripts/reset_oc_financiero_qa.py --yes

En Docker (recomendado si .env usa rutas /app/data/...):
  docker compose exec backend python scripts/reset_oc_financiero_qa.py --dry-run

Si corres en Windows con el mismo .env que Docker, las rutas de adjuntos pueden apuntar mal;
usa: --data-root <carpeta donde están cotizaciones/oc_docs/proformas/facturas> (ej. ./data).

Crea un ZIP de respaldo de oc.db, financiero.db y carpetas de adjuntos antes de borrar,
salvo que pase --no-backup.

No modifica intranet.db (usuarios/permisos). No borra catálogos por defecto:
  oc_config, oc_proveedores, fin_tipos_gasto, fin_cuentas_contables
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

# Raíz del paquete backend (directorio que contiene app/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine.url import make_url  # noqa: E402
from sqlmodel import Session, create_engine  # noqa: E402

from app.config import settings  # noqa: E402


def _sqlite_file_path(url: str) -> Path:
    u = make_url(url)
    if u.drivername != "sqlite":
        raise SystemExit(
            "Este script solo admite SQLite (ambiente QA local/Docker). "
            f"Configuración actual: {u.drivername!r}. Tras migración a PostgreSQL, "
            "habrá que usar TRUNCATE/CASCADE o un procedimiento distinto."
        )
    db = u.database
    if not db or db == ":memory:":
        raise SystemExit("SQLite en memoria no está soportado.")
    p = Path(db)
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    return p


def _data_root(override: Path | None = None) -> Path:
    if override is not None:
        return override.resolve()
    facturas = Path(settings.facturas_dir).resolve()
    if facturas.name == "facturas":
        return facturas.parent
    return facturas.parent


def _filesystem_targets(data_root: Path) -> dict[str, Path]:
    return {
        "cotizaciones": data_root / "cotizaciones",
        "oc_docs": data_root / "oc_docs",
        "proformas": data_root / "proformas",
        "facturas": data_root / "facturas",
        "solicitudes_fotos": data_root / "solicitudes",
    }


def _count_oc(session: Session) -> dict[str, int]:
    out: dict[str, int] = {}
    for table in (
        "oc_historial_estados",
        "oc_ordenes",
        "oc_cotizaciones",
        "oc_solicitudes",
        "oc_paquetes",
        "oc_proveedores",
        "oc_config",
    ):
        try:
            n = session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            out[table] = int(n)
        except Exception as exc:
            err = str(exc).lower()
            out[table] = 0 if "no such table" in err else -1
    return out


def _count_fin(session: Session) -> dict[str, int]:
    out: dict[str, int] = {}
    for table in (
        "fin_validaciones",
        "fin_factura_cuentas",
        "fin_facturas",
        "fin_seguimiento_solicitud",
        "fin_cuentas_contables",
        "fin_tipos_gasto",
    ):
        try:
            n = session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            out[table] = int(n)
        except Exception as exc:
            err = str(exc).lower()
            out[table] = 0 if "no such table" in err else -1
    return out


def _dir_size_and_files(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    total = 0
    nfiles = 0
    for f in path.rglob("*"):
        if f.is_file():
            nfiles += 1
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return total, nfiles


def _add_path_to_zip(zf: zipfile.ZipFile, path: Path, arc_prefix: str) -> None:
    if path.is_file():
        zf.write(path, arcname=f"{arc_prefix}/{path.name}")
        return
    if not path.is_dir():
        return
    for f in path.rglob("*"):
        if f.is_file():
            rel = f.relative_to(path)
            zf.write(f, arcname=f"{arc_prefix}/{rel.as_posix()}")


def _create_backup_zip(zip_path: Path, data_root: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    oc_db = _sqlite_file_path(settings.oc_database_url)
    fin_db = _sqlite_file_path(settings.financiero_database_url)
    fs = _filesystem_targets(data_root)
    candidates = data_root / "field_candidates.json"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if oc_db.is_file():
            zf.write(oc_db, arcname=f"db/{oc_db.name}")
        if fin_db.is_file():
            zf.write(fin_db, arcname=f"db/{fin_db.name}")
        if candidates.is_file():
            zf.write(candidates, arcname=f"data/{candidates.name}")
        for key, dir_path in fs.items():
            if dir_path.exists():
                _add_path_to_zip(zf, dir_path, f"data/{key}")


def _clear_directory(dir_path: Path, dry_run: bool) -> None:
    if not dir_path.exists():
        return
    if dry_run:
        return
    import shutil

    shutil.rmtree(dir_path)
    dir_path.mkdir(parents=True, exist_ok=True)


def _run_oc_deletes(
    engine,
    *,
    include_paquetes: bool,
    include_proveedores: bool,
    include_oc_config: bool,
    dry_run: bool,
) -> None:
    stmts: list[str] = [
        "DELETE FROM oc_historial_estados",
        "DELETE FROM oc_ordenes",
        "DELETE FROM oc_cotizaciones",
        "DELETE FROM oc_solicitudes",
    ]
    if include_paquetes:
        stmts.append("DELETE FROM oc_paquetes")
    if include_proveedores:
        stmts.append("DELETE FROM oc_proveedores")
    if include_oc_config:
        stmts.append("DELETE FROM oc_config")

    if dry_run:
        return

    with Session(engine) as session:
        for sql in stmts:
            session.execute(text(sql))
        session.commit()


def _run_fin_deletes(engine, *, dry_run: bool) -> None:
    stmts = [
        "DELETE FROM fin_validaciones",
        "DELETE FROM fin_factura_cuentas",
        "DELETE FROM fin_facturas",
        "DELETE FROM fin_seguimiento_solicitud",
    ]
    if dry_run:
        return
    with Session(engine) as session:
        for sql in stmts:
            session.execute(text(sql))
        session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Vacía solicitudes OC, cotizaciones, órdenes, historial y módulo financiero (QA SQLite)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo muestra conteos y rutas; no borra nada.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        dest="confirm",
        help="Confirmación obligatoria para ejecutar el borrado.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="No genera ZIP de respaldo (no recomendado).",
    )
    parser.add_argument(
        "--backup-dir",
        type=Path,
        default=None,
        help="Directorio para el ZIP (default: <data-root>/backups).",
    )
    parser.add_argument(
        "--data-root",
        type=Path,
        default=None,
        dest="data_root",
        help=(
            "Carpeta base de adjuntos (cotizaciones, oc_docs, proformas, facturas, solicitudes). "
            "Por defecto se infiere de proformas_dir/facturas_dir. En Windows con .env de Docker suele "
            "requerirse algo como --data-root ./data alineado con oc.db."
        ),
    )
    parser.add_argument(
        "--include-paquetes",
        action="store_true",
        help="También borra oc_paquetes (plantillas guardadas).",
    )
    parser.add_argument(
        "--include-proveedores",
        action="store_true",
        help="También borra oc_proveedores.",
    )
    parser.add_argument(
        "--include-oc-config",
        action="store_true",
        help="También borra oc_config (SMTP/destinatarios en BD).",
    )
    parser.add_argument(
        "--reset-field-candidates",
        action="store_true",
        help="Elimina field_candidates.json del motor de extracción si existe.",
    )
    args = parser.parse_args()

    oc_path = _sqlite_file_path(settings.oc_database_url)
    fin_path = _sqlite_file_path(settings.financiero_database_url)
    dr = _data_root(args.data_root)
    fs_targets = _filesystem_targets(dr)

    connect_args = {"check_same_thread": False}
    oc_engine = create_engine(
        settings.oc_database_url,
        connect_args=connect_args if "sqlite" in settings.oc_database_url else {},
    )
    fin_engine = create_engine(
        settings.financiero_database_url,
        connect_args=connect_args if "sqlite" in settings.financiero_database_url else {},
    )

    print("=== Reset OC + Financiero (QA) ===")
    print(f"Directorio de trabajo: {Path.cwd()}")
    print(f"oc.db: {oc_path} (existe: {oc_path.is_file()})")
    print(f"financiero.db: {fin_path} (existe: {fin_path.is_file()})")
    print(f"Raíz de datos (adjuntos): {dr}")

    if (
        not args.data_root
        and oc_path.is_file()
        and dr.resolve() != oc_path.parent.resolve()
    ):
        print(
            "\n[aviso] La raíz de adjuntos no coincide con la carpeta de oc.db.",
            f"Si tus archivos viven junto a oc.db, considera: --data-root {oc_path.parent}",
        )

    with Session(oc_engine) as s:
        oc_counts = _count_oc(s)
    with Session(fin_engine) as s:
        fin_counts = _count_fin(s)

    print("\n--- Conteos OC ---")
    for k, v in sorted(oc_counts.items()):
        print(f"  {k}: {v}")
    print("\n--- Conteos Financiero ---")
    for k, v in sorted(fin_counts.items()):
        print(f"  {k}: {v}")

    print("\n--- Carpetas de adjuntos ---")
    for name, p in fs_targets.items():
        size, n = _dir_size_and_files(p)
        print(f"  {name}: {p} ({n} archivos, ~{size / 1024:.1f} KiB)")

    if args.dry_run:
        print("\n[dry-run] No se realizó ningún cambio.")
        return

    if not args.confirm:
        print(
            "\nAborted: añade --yes para ejecutar el borrado destructivo, "
            "o usa --dry-run para inspeccionar."
        )
        sys.exit(1)

    if not args.no_backup:
        backup_root = args.backup_dir if args.backup_dir else dr / "backups"
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        zip_path = backup_root / f"pre_reset_oc_fin_{ts}.zip"
        print(f"\nCreando respaldo: {zip_path}")
        _create_backup_zip(zip_path, dr)
        print("Respaldo listo.")
    else:
        print("\n[advertencia] --no-backup: no se creó ZIP.")

    print("\nBorrando tablas OC...")
    _run_oc_deletes(
        oc_engine,
        include_paquetes=args.include_paquetes,
        include_proveedores=args.include_proveedores,
        include_oc_config=args.include_oc_config,
        dry_run=False,
    )
    print("Borrando tablas Financiero (facturas/seguimiento/validaciones)...")
    _run_fin_deletes(fin_engine, dry_run=False)

    print("Vaciando carpetas de adjuntos...")
    for p in fs_targets.values():
        _clear_directory(p, dry_run=False)

    if args.reset_field_candidates:
        cand = dr / "field_candidates.json"
        if cand.is_file():
            cand.unlink()
            print(f"Eliminado {cand}")
        else:
            print(f"No existía {cand}")

    print("\nListo. Reinicia el backend si tenía conexiones abiertas a SQLite.")
    with Session(oc_engine) as s:
        oc_after = _count_oc(s)
    with Session(fin_engine) as s:
        fin_after = _count_fin(s)
    print("Conteos OC tras reset:", {k: oc_after[k] for k in ("oc_solicitudes", "oc_cotizaciones", "oc_ordenes", "oc_historial_estados")})
    print(
        "Conteos fin tras reset:",
        {k: fin_after[k] for k in ("fin_facturas", "fin_seguimiento_solicitud", "fin_validaciones")},
    )


if __name__ == "__main__":
    main()
