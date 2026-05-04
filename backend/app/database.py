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


def create_db_and_tables() -> None:
    """Crea solo las tablas de la intranet en intranet.db."""
    from app.models.user import User
    from app.models.role import Role
    from app.models.area import Area
    from app.models.sede import Sede
    from app.models.draft import FormDraft
    from app.models.learned_synonym import LearnedSynonym      # ← agregar
    from app.models.extraction_review import ExtractionReview  # ← agregar

    intranet_table_names = {
        "user", "role", "area", "sede", "form_drafts",
        "learned_synonyms", "extraction_reviews",              # ← agregar
    }
    tables = [
        SQLModel.metadata.tables[t]
        for t in intranet_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_engine(), tables=tables)


def get_db():
    with Session(get_engine()) as session:
        yield session
