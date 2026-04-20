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
    from app.models.oc import SolicitudOC, CotizacionProveedor, OrdenCompra, Proveedor, OcConfig, HistorialEstado, PaqueteSolicitud  # noqa: F401

    oc_table_names = {"oc_solicitudes", "oc_cotizaciones", "oc_ordenes", "oc_proveedores", "oc_config", "oc_historial_estados", "oc_paquetes"}
    tables = [
        SQLModel.metadata.tables[t]
        for t in oc_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_oc_engine(), tables=tables)

    # Migración: índice único en consecutivo_os (seguro en bases existentes)
    from sqlalchemy import text
    with get_oc_engine().connect() as conn:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_oc_solicitudes_consecutivo_os "
            "ON oc_solicitudes (consecutivo_os)"
        ))
        conn.commit()

    print("[oc] Tablas OC verificadas en oc.db.")


def get_oc_db():
    with Session(get_oc_engine()) as session:
        yield session
