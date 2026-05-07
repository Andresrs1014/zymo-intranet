from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class WorkTask(SQLModel, table=True):
    __tablename__ = "work_tasks"

    id: Optional[int] = Field(default=None, primary_key=True)

    scope: str = Field(default="desarrollo_innovacion", index=True, max_length=100)
    team_id: Optional[int] = Field(default=None, index=True)

    subido_por_id: int = Field(index=True, nullable=False)
    subido_por_nombre: str = Field(default="", max_length=200)

    fecha: date = Field(default_factory=date.today, index=True)
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None
    tiempo_total_minutos: Optional[int] = None

    etiqueta: str = Field(default="tareas_diarias", index=True, max_length=80)
    plataforma: str = Field(default="transversal", index=True, max_length=80)

    titulo: str = Field(max_length=250, nullable=False)
    descripcion_tecnica: str = Field(nullable=False)

    estado: str = Field(default="en_progreso", index=True, max_length=50)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
