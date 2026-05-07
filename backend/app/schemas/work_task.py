from datetime import date, datetime

from pydantic import BaseModel


class WorkTaskCreate(BaseModel):
    titulo: str
    descripcion_tecnica: str
    etiqueta: str = "tareas_diarias"
    plataforma: str = "transversal"
    estado: str = "en_progreso"
    fecha: date | None = None
    hora_inicio: datetime | None = None
    hora_cierre: datetime | None = None


class WorkTaskUpdate(BaseModel):
    titulo: str | None = None
    descripcion_tecnica: str | None = None
    etiqueta: str | None = None
    plataforma: str | None = None
    estado: str | None = None
    fecha: date | None = None
    hora_inicio: datetime | None = None
    hora_cierre: datetime | None = None


class WorkTaskRead(BaseModel):
    id: int
    scope: str
    team_id: int | None
    subido_por_id: int
    subido_por_nombre: str
    fecha: date
    hora_inicio: datetime | None
    hora_cierre: datetime | None
    tiempo_total_minutos: int | None
    etiqueta: str
    plataforma: str
    titulo: str
    descripcion_tecnica: str
    estado: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
