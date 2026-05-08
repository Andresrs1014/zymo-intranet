# backend/app/models/task_event_participant.py
from __future__ import annotations
from sqlmodel import SQLModel, Field
from typing import Optional


class TaskEventParticipant(SQLModel, table=True):
    __tablename__ = "task_event_participants"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(index=True)          # FK a task_events.id
    user_id: int = Field(index=True)           # FK a users.id
    user_nombre: str = Field(max_length=200)   # snapshot desnormalizado
    has_conflict: bool = Field(default=False)  # True si ya tiene evento en ese horario
    conflict_detail: Optional[str] = Field(default=None, max_length=300)  # "Choca con: <titulo> a las HH:MM"
