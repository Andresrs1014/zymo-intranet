from sqlmodel import SQLModel, create_engine, Session
from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        url = settings.zymo_database_url or settings.database_url
        if url.startswith("sqlite"):
            ensure_sqlite_parent_dir(url)
        _engine = create_engine(
            url,
            connect_args={"check_same_thread": False} if "sqlite" in url else {},
        )
    return _engine


def create_db_and_tables() -> None:
    """Crea solo las tablas de la intranet en intranet.db."""
    from app.models.user import User
    from app.models.role import Role
    from app.models.area import Area
    from app.models.sede import Sede
    from app.models.draft import FormDraft
    from app.models.learned_synonym import LearnedSynonym
    from app.models.extraction_review import ExtractionReview
    from app.models.user_tool import UserTool

    intranet_table_names = {
        "user", "role", "area", "sede", "form_drafts",
        "learned_synonyms", "extraction_reviews",
        "user_tools",
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
