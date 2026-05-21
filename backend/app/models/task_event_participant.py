# backend/app/models/task_event_participant.py
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskEventParticipant(SQLModel, table=True):
    __tablename__ = "task_event_participants"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(index=True, nullable=False, foreign_key="task_events.id")
    user_id: int = Field(index=True, nullable=False)
    user_nombre: str = Field(max_length=200, nullable=False)
    has_conflict: bool = Field(default=False, nullable=False)
    conflict_detail: Optional[str] = Field(default=None, max_length=300)
    confirmacion: Optional[str] = Field(default="pendiente", max_length=20)
