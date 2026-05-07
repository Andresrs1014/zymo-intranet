from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class UserTool(SQLModel, table=True):
    __tablename__ = "user_tools"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, nullable=False)
    tool_key: str = Field(index=True, max_length=100, nullable=False)
    scope: str = Field(default="global", index=True, max_length=100, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
