from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskListConfig(SQLModel, table=True):
    __tablename__ = "task_list_configs"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(index=True, nullable=False)
    list_type: str = Field(index=True, max_length=50, nullable=False)
    value: str = Field(max_length=100, nullable=False)
    label: str = Field(max_length=150, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    is_final: bool = Field(default=False, nullable=False)
    is_canceled: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
