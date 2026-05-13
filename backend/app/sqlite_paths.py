"""
Rutas SQLite: crear directorio padre de forma segura antes de create_engine.

Evita FileNotFoundError cuando dirname(db_path) es cadena vacía o '.' incorrecto
con rutas relativas (p. ej. sqlite:///./data/intranet.db).
"""
import os


def ensure_sqlite_parent_dir(database_url: str) -> None:
    if not database_url or "sqlite" not in database_url.lower():
        return
    # Quitar sqlite:/// — con sqlite:////ruta/absoluta el resto empieza por /
    stripped = database_url.replace("sqlite:///", "", 1)
    if not stripped:
        return
    parent = os.path.dirname(os.path.abspath(stripped))
    if parent:
        os.makedirs(parent, exist_ok=True)
