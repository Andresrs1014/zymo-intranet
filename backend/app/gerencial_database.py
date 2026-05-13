"""
Base de datos del módulo gerencial — PostgreSQL.

Es el piloto de migración del sistema a PostgreSQL. Contiene:
- gerencial_tareas: tareas de Andrés/Andrea con descripción gerencial generada por ZYMO
- gerencial_ordenes: órdenes directas del gerente a áreas

══════════════════════════════════════════════════════════════════
MIGRACIÓN A POSTGRESQL — APLICA A TODOS LOS SCHEMAS DEL SISTEMA
══════════════════════════════════════════════════════════════════

Cuando se migre este módulo a PostgreSQL, el mismo proceso aplica
para TODOS los schemas. Orden recomendado:

  1. gerencial  → GERENCIAL_DATABASE_URL   (este archivo — piloto)
  2. agents     → AGENTS_DATABASE_URL      (agent_database.py)
  3. oc         → OC_DATABASE_URL          (oc_database.py)
  4. intranet   → DATABASE_URL             (database.py)

Proceso por schema:
  1. Levantar contenedor PostgreSQL (ver docker-compose.yml)
  2. Cambiar la variable de entorno del schema en .env
  3. Reiniciar el servicio backend — las tablas se crean solas en lifespan
  4. Migrar datos históricos si aplica (script separado)

No se requieren cambios en el código — solo en las variables de entorno.
══════════════════════════════════════════════════════════════════
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel, Session, create_engine

from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_gerencial_engine = None


def get_gerencial_engine():
    global _gerencial_engine
    if _gerencial_engine is None:
        url = settings.gerencial_database_url
        connect_args = {}
        if "sqlite" in url.lower():
            ensure_sqlite_parent_dir(url)
            connect_args = {"check_same_thread": False}
        _gerencial_engine = create_engine(url, connect_args=connect_args)
    return _gerencial_engine


def get_gerencial_db():
    with Session(get_gerencial_engine()) as session:
        yield session


# ── Modelos ────────────────────────────────────────────────────────────────────

class GerencialTarea(SQLModel, table=True):
    __tablename__ = "gerencial_tareas"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    # Quién y cuándo
    subido_por_id: int
    subido_por_nombre: str = ""
    fecha: date = Field(default_factory=date.today)

    # Tiempo de ejecución
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None
    tiempo_total_minutos: Optional[int] = None  # calculado

    # Clasificación
    etiqueta: str = "tareas_diarias"
    # Valores: desarrollos / actualizaciones / auditorias / implementacion_okr / tareas_diarias
    plataforma: str = "transversal"
    # Valores: logimat1 / logimat2 / imccargo / imcdeposito / transversal

    # Contenido
    titulo: str
    descripcion_tecnica: str
    descripcion_gerencial: Optional[str] = None   # ZYMO la genera
    impacto: Optional[str] = None                  # ZYMO lo evalúa

    # Estado
    estado: str = "en_progreso"
    # Valores: completada / en_progreso / bloqueada

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GerencialOrden(SQLModel, table=True):
    __tablename__ = "gerencial_ordenes"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    # Quién la crea
    creada_por_id: int
    creada_por_nombre: str = ""

    # Destinatario
    destinatario_id: int
    destinatario_nombre: str = ""
    destinatario_area: str = ""

    # Contenido
    titulo: str
    descripcion: Optional[str] = None

    # Estado
    estado: str = "pendiente"
    # Valores: pendiente / en_progreso / completada

    notificacion_enviada: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ── Creación de tablas ─────────────────────────────────────────────────────────

_GERENCIAL_TABLES = {"gerencial_tareas", "gerencial_ordenes"}


def create_gerencial_tables() -> None:
    from app.gerencial_database import GerencialTarea, GerencialOrden  # noqa: F401
    tables = [
        SQLModel.metadata.tables[t]
        for t in _GERENCIAL_TABLES
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_gerencial_engine(), tables=tables)
