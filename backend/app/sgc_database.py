import os

from sqlmodel import SQLModel, Session, create_engine

from app.config import settings

_sgc_engine = None


def get_sgc_engine():
    global _sgc_engine
    if _sgc_engine is None:
        if settings.sgc_database_url.startswith("sqlite"):
            db_path = settings.sgc_database_url.replace("sqlite:///", "")
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        _sgc_engine = create_engine(
            settings.sgc_database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.sgc_database_url else {},
        )
    return _sgc_engine


def create_sgc_tables() -> None:
    """Crea las tablas del módulo SGC en sgc.db."""
    from app.models.sgc import ProveedorSGC  # noqa: F401

    sgc_table_names = {"sgc_proveedores"}
    tables = [
        SQLModel.metadata.tables[t]
        for t in sgc_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_sgc_engine(), tables=tables)
    print("[sgc] Tablas SGC verificadas en sgc.db.")


def get_sgc_db():
    with Session(get_sgc_engine()) as session:
        yield session
