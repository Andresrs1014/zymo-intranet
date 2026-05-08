# backend/app/models/task_activity_log.py
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class TaskActivityLog(SQLModel, table=True):
    __tablename__ = "task_activity_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(index=True, nullable=False)           # FK a work_tasks.id
    user_id: int = Field(nullable=False)
    user_nombre: str = Field(max_length=200, nullable=False)
    accion: str = Field(max_length=50, nullable=False)         # "creacion", "cambio_estado", "edicion"
    detalle: Optional[str] = Field(default=None, max_length=400)
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
