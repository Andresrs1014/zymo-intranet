from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class WorkTask(SQLModel, table=True):
    __tablename__ = "work_tasks"

    id: Optional[int] = Field(default=None, primary_key=True)

    scope: str = Field(default="desarrollo_innovacion", index=True, max_length=100, nullable=False)
    team_id: Optional[int] = Field(default=None, index=True)

    subido_por_id: int = Field(index=True, nullable=False)
    # Desnormalización intencional — snapshot del nombre al momento del registro (mismo patrón que oc.py)
    subido_por_nombre: str = Field(default="", max_length=200, nullable=False)

    fecha: date = Field(default_factory=date.today, index=True, nullable=False)
    hora_inicio: Optional[datetime] = Field(default=None)
    hora_cierre: Optional[datetime] = Field(default=None)
    tiempo_total_minutos: Optional[int] = Field(default=None)

    etiqueta: str = Field(default="tareas_diarias", index=True, max_length=80, nullable=False)
    plataforma: str = Field(default="transversal", index=True, max_length=80, nullable=False)

    titulo: str = Field(max_length=250, nullable=False)
    descripcion_tecnica: str = Field(nullable=False)

    estado: str = Field(default="en_progreso", index=True, max_length=50, nullable=False)
    prioridad: str = Field(default="media", index=True, max_length=10, nullable=False)

    asignado_a_id: Optional[int] = Field(default=None, index=True)
    asignado_a_nombre: Optional[str] = Field(default="", max_length=200, nullable=False)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
