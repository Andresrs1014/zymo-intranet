from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskTeam(SQLModel, table=True):
    __tablename__ = "task_teams"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(index=True, nullable=False)
    name: str = Field(max_length=150, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
