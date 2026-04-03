import os
from sqlmodel import SQLModel, create_engine, Session

from app.config import settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        # Crear directorio data/ si no existe (para SQLite)
        if settings.database_url.startswith("sqlite"):
            db_path = settings.database_url.replace("sqlite:///", "")
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        _engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
        )
    return _engine


def create_db_and_tables():
    SQLModel.metadata.create_all(get_engine())


def get_db():
    with Session(get_engine()) as session:
        yield session
