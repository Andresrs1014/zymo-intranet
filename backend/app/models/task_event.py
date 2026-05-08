# backend/app/models/task_event.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    scope: str = Field(max_length=100, index=True)          # "desarrollo_innovacion"
    team_id: Optional[int] = Field(default=None)             # FK a task_teams.id
    titulo: str = Field(max_length=250)
    descripcion: Optional[str] = Field(default=None)
    fecha: str = Field(index=True)                           # "YYYY-MM-DD" — sin timezone
    hora_inicio: str = Field(max_length=5)                   # "HH:MM"
    duracion_minutos: int = Field(default=60)
    creado_por_id: int = Field(index=True)
    creado_por_nombre: str = Field(max_length=200)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
