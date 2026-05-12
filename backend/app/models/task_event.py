# backend/app/models/task_event.py
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    scope: str = Field(max_length=100, index=True, nullable=False)
    team_id: Optional[int] = Field(default=None)
    titulo: str = Field(max_length=250, nullable=False)
    descripcion: Optional[str] = Field(default=None)
    plataforma: Optional[str] = Field(default=None, max_length=50)
    fecha: date = Field(index=True, nullable=False)
    hora_inicio: str = Field(max_length=5, nullable=False)           # "HH:MM"
    duracion_minutos: int = Field(default=60, nullable=False)
    creado_por_id: int = Field(index=True, nullable=False)
    creado_por_nombre: str = Field(max_length=200, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
