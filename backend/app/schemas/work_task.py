from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class WorkTaskCreate(BaseModel):
    titulo: str
    descripcion_tecnica: str
    etiqueta: Optional[str] = None
    plataforma: Optional[str] = None
    estado: Optional[str] = None
    prioridad: str = "media"
    team_id: int | None = None
    fecha: date | None = None
    hora_inicio: datetime | None = None
    hora_cierre: datetime | None = None


class WorkTaskUpdate(BaseModel):
    titulo: str | None = None
    descripcion_tecnica: str | None = None
    etiqueta: str | None = None
    plataforma: str | None = None
    estado: str | None = None
    prioridad: str | None = None
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
    prioridad: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Paginación ---

class PaginatedTaskFilters(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=10, ge=1, le=100)
    search: Optional[str] = None
    responsable_id: Optional[int] = None
    estado: Optional[str] = None
    etiqueta: Optional[str] = None
    plataforma: Optional[str] = None
    fecha_exacta: Optional[str] = None
    fecha_desde: Optional[str] = None
    fecha_hasta: Optional[str] = None


class PaginatedMeta(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    limit: int


class PaginatedTasksResponse(BaseModel):
    data: list[WorkTaskRead]
    meta: PaginatedMeta
