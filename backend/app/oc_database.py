import logging

from sqlmodel import SQLModel, Session, create_engine

from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

log = logging.getLogger(__name__)

_oc_engine = None


def get_oc_engine():
    global _oc_engine
    if _oc_engine is None:
        if settings.oc_database_url.startswith("sqlite"):
            ensure_sqlite_parent_dir(settings.oc_database_url)
        _oc_engine = create_engine(
            settings.oc_database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.oc_database_url else {},
        )
    return _oc_engine


def create_oc_tables() -> None:
    """Crea solo las tablas del módulo OC en oc.db."""
    # Importar modelos para registrarlos en SQLModel.metadata
    from app.models.oc import SolicitudOC, CotizacionProveedor, OrdenCompra, Proveedor, OcConfig, HistorialEstado, PaqueteSolicitud  # noqa: F401
    from app.models.mantenimiento import SolicitudMantenimiento, TipoMantenimientoConfig, HistorialMantenimiento  # noqa: F401

    oc_table_names = {
        "oc_solicitudes", "oc_cotizaciones", "oc_ordenes", "oc_proveedores",
        "oc_config", "oc_historial_estados", "oc_paquetes",
        "mnt_solicitudes", "mnt_tipos_config", "mnt_historial",
    }
    tables = [
        SQLModel.metadata.tables[t]
        for t in oc_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_oc_engine(), tables=tables)

    from sqlalchemy import text
    with get_oc_engine().connect() as conn:
        # Migración: índice único en consecutivo_os (seguro en bases existentes)
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_oc_solicitudes_consecutivo_os "
            "ON oc_solicitudes (consecutivo_os)"
        ))

        # Migración: fotos del producto subidas desde la intranet
        try:
            conn.execute(text("ALTER TABLE oc_solicitudes ADD COLUMN fotos_producto JSON"))
        except Exception:
            pass  # columna ya existe

        # Migración: valor aprobado original (trazabilidad de correcciones directivas)
        try:
            conn.execute(text("ALTER TABLE oc_cotizaciones ADD COLUMN valor_aprobado_original FLOAT"))
        except Exception:
            pass  # columna ya existe

        # Migración: columnas de trazabilidad de reprocesos en historial
        for col_def in [
            "ALTER TABLE oc_historial_estados ADD COLUMN es_reproceso BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE oc_historial_estados ADD COLUMN tipo_accion VARCHAR(50)",
        ]:
            try:
                conn.execute(text(col_def))
            except Exception:
                pass  # columna ya existe — ignorar

        # Índices de rendimiento en oc_historial_estados
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_historial_es_reproceso "
            "ON oc_historial_estados(es_reproceso, fecha DESC)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_historial_tipo_accion "
            "ON oc_historial_estados(tipo_accion)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_historial_solicitud_fecha "
            "ON oc_historial_estados(solicitud_id, fecha ASC)"
        ))

        # Mantenimiento — vínculo desde OC hacia solicitud de mantenimiento
        try:
            conn.execute(text("ALTER TABLE oc_solicitudes ADD COLUMN mantenimiento_id INTEGER"))
            log.info("[oc_db] Columna oc_solicitudes.mantenimiento_id agregada.")
        except Exception:
            pass  # columna ya existe

        # Índice de rendimiento para mantenimiento_id
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_oc_solicitudes_mantenimiento_id "
            "ON oc_solicitudes(mantenimiento_id)"
        ))

        conn.commit()

    log.info("[oc] Tablas OC verificadas en oc.db.")


def get_oc_db():
    with Session(get_oc_engine()) as session:
        yield session
