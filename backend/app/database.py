from sqlmodel import SQLModel, create_engine, Session
from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        # Crear directorio data/ si no existe (para SQLite)
        if settings.database_url.startswith("sqlite"):
            ensure_sqlite_parent_dir(settings.database_url)
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
    from app.models.learned_synonym import LearnedSynonym
    from app.models.extraction_review import ExtractionReview
    from app.models.user_tool import UserTool
    from app.models.task_team import TaskTeam
    from app.models.task_team_member import TaskTeamMember
    from app.models.work_task import WorkTask
    from app.models.task_event import TaskEvent  # noqa: F401
    from app.models.task_event_participant import TaskEventParticipant  # noqa: F401
    from app.models.task_activity_log import TaskActivityLog  # noqa: F401
    from app.models.task_list_config import TaskListConfig  # noqa: F401

    intranet_table_names = {
        "user", "role", "area", "sede", "form_drafts",
        "learned_synonyms", "extraction_reviews",
        "user_tools", "task_teams", "task_team_members", "work_tasks",
        "task_events", "task_event_participants", "task_activity_log",
        "task_list_configs",
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
