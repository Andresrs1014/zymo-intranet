from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskAttachment(SQLModel, table=True):
    __tablename__ = "task_attachments"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(index=True, nullable=False)

    filename: str = Field(max_length=255, nullable=False)
    file_path: str = Field(max_length=500, nullable=False)
    mime_type: str = Field(max_length=100, nullable=False)
    size_bytes: int = Field(nullable=False)

    uploaded_by_id: int = Field(index=True, nullable=False)
    uploaded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )