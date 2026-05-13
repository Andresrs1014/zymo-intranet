from sqlmodel import SQLModel, Session, create_engine

from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_financiero_engine = None


def get_financiero_engine():
    global _financiero_engine
    if _financiero_engine is None:
        if settings.financiero_database_url.startswith("sqlite"):
            ensure_sqlite_parent_dir(settings.financiero_database_url)
        _financiero_engine = create_engine(
            settings.financiero_database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.financiero_database_url else {},
        )
    return _financiero_engine


def create_financiero_tables() -> None:
    """Crea las tablas del módulo Financiero en financiero.db."""
    from app.models.financiero import (  # noqa: F401
        FacturaProveedor, SeguimientoFinancieroSolicitud, ValidacionFactura,
        TipoGasto, CuentaContable, FacturaCuentaContable,
    )

    fin_table_names = {
        "fin_facturas", "fin_validaciones",
        "fin_tipos_gasto", "fin_cuentas_contables", "fin_factura_cuentas",
        "fin_seguimiento_solicitud",
    }
    tables = [
        SQLModel.metadata.tables[t]
        for t in fin_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_financiero_engine(), tables=tables)
    print("[financiero] Tablas Financiero verificadas en financiero.db.")


def get_financiero_db():
    with Session(get_financiero_engine()) as session:
        yield session
