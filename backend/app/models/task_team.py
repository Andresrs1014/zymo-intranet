from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskTeam(SQLModel, table=True):
    __tablename__ = "task_teams"

    id: Optional[int] = Field(default=None, primary_key=True)
    scope: str = Field(index=True, max_length=100, nullable=False)
    name: str = Field(max_length=150, nullable=False)
    owner_user_id: Optional[int] = Field(default=None, index=True)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
