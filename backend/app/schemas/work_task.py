from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorkTaskCreate(BaseModel):
    titulo: str
    descripcion_tecnica: str
    etiqueta: str = "tareas_diarias"
    plataforma: str = "transversal"
    estado: str = "en_progreso"
    fecha: Optional[str] = None
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None


class WorkTaskUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion_tecnica: Optional[str] = None
    etiqueta: Optional[str] = None
    plataforma: Optional[str] = None
    estado: Optional[str] = None
    fecha: Optional[str] = None
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None


class WorkTaskRead(BaseModel):
    id: int
    scope: str
    team_id: int | None
    subido_por_id: int
    subido_por_nombre: str
    fecha: str
    hora_inicio: str | None
    hora_cierre: str | None
    tiempo_total_minutos: int | None
    etiqueta: str
    plataforma: str
    titulo: str
    descripcion_tecnica: str
    estado: str
    created_at: str
    updated_at: str
