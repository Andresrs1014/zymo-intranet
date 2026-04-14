import os

from sqlmodel import SQLModel, Session, create_engine

from app.config import settings

_oc_engine = None


def get_oc_engine():
    global _oc_engine
    if _oc_engine is None:
        if settings.oc_database_url.startswith("sqlite"):
            db_path = settings.oc_database_url.replace("sqlite:///", "")
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        _oc_engine = create_engine(
            settings.oc_database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.oc_database_url else {},
        )
    return _oc_engine


def create_oc_tables() -> None:
    """Crea solo las tablas del módulo OC en oc.db."""
    # Importar modelos para registrarlos en SQLModel.metadata
    from app.models.oc import SolicitudOC, CotizacionProveedor, OrdenCompra, Proveedor, OcConfig  # noqa: F401

    oc_table_names = {"oc_solicitudes", "oc_cotizaciones", "oc_ordenes", "oc_proveedores", "oc_config"}
    tables = [
        SQLModel.metadata.tables[t]
        for t in oc_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_oc_engine(), tables=tables)
    print("[oc] Tablas OC verificadas en oc.db.")


def get_oc_db():
    with Session(get_oc_engine()) as session:
        yield session
