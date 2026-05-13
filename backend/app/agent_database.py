import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel, Session, create_engine

from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_agents_engine = None


def get_agents_engine():
    global _agents_engine
    if _agents_engine is None:
        if settings.agents_database_url.startswith("sqlite"):
            ensure_sqlite_parent_dir(settings.agents_database_url)
        _agents_engine = create_engine(
            settings.agents_database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.agents_database_url else {},
        )
    return _agents_engine


def get_agents_db():
    with Session(get_agents_engine()) as session:
        yield session


# ── Modelos ────────────────────────────────────────────────────────────────────

class AgentSession(SQLModel, table=True):
    __tablename__ = "agent_sessions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: int
    user_email: str
    agente: str  # "zymo_core" | "administrativo" | "documentos"
    inicio: datetime = Field(default_factory=datetime.utcnow)
    fin: Optional[datetime] = None
    resumen: Optional[str] = None
    tokens_usados: int = 0


class AgentAction(SQLModel, table=True):
    __tablename__ = "agent_actions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(index=True)
    tipo: str  # "respuesta" | "busqueda" | "sugerencia" | "reporte"
    input: str
    output: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    modelo_usado: str = ""
    tokens: int = 0


class AgentMemory(SQLModel, table=True):
    __tablename__ = "agent_memory"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_email: str = Field(index=True)
    clave: str
    valor: str  # JSON serializado
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AgentDocumento(SQLModel, table=True):
    __tablename__ = "agent_documentos"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    nombre: str
    ruta: str
    tipo: str  # "procedimiento" | "instructivo" | "politica"
    area: str  # "administrativo" | "sgc" | "general"
    indexado_at: datetime = Field(default_factory=datetime.utcnow)
    chunks_count: int = 0
    subido_por_id: int


class DevTarea(SQLModel, table=True):
    __tablename__ = "dev_tareas"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    titulo: str
    descripcion_tecnica: str
    descripcion_gerencial: Optional[str] = None
    impacto: Optional[str] = None
    tiempo_horas: Optional[float] = None
    fecha: date = Field(default_factory=date.today)
    estado: str = "en_progreso"  # "completada" | "en_progreso" | "bloqueada"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ZymoReporte(SQLModel, table=True):
    __tablename__ = "zymo_reportes"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    tipo: str  # "ronda_2h" | "diario" | "semanal" | "alerta"
    contenido: str  # JSON con el reporte
    destinatario: str  # "gerente" | "andrea" | "andres"
    leido: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── Creación de tablas ─────────────────────────────────────────────────────────

_AGENT_TABLES = {
    "agent_sessions",
    "agent_actions",
    "agent_memory",
    "agent_documentos",
    "dev_tareas",
    "zymo_reportes",
}


def create_agent_tables() -> None:
    # Importar modelos para registrarlos en SQLModel.metadata
    from app.agent_database import (  # noqa: F401
        AgentSession, AgentAction, AgentMemory,
        AgentDocumento, DevTarea, ZymoReporte,
    )
    tables = [
        SQLModel.metadata.tables[t]
        for t in _AGENT_TABLES
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_agents_engine(), tables=tables)
