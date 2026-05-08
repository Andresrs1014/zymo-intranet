# backend/app/schemas/task_event.py
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class TaskEventParticipantRead(BaseModel):
    user_id: int
    user_nombre: str
    has_conflict: bool
    conflict_detail: Optional[str] = None


class TaskEventCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha: str                         # "YYYY-MM-DD"
    hora_inicio: str                   # "HH:MM"
    duracion_minutos: int = 60
    participant_ids: list[int]         # IDs de usuarios participantes


class TaskEventRead(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha: str
    hora_inicio: str
    duracion_minutos: int
    creado_por_id: int
    creado_por_nombre: str
    participants: list[TaskEventParticipantRead] = []

    class Config:
        from_attributes = True


class TaskActivityLogRead(BaseModel):
    id: int
    task_id: int
    user_id: int
    user_nombre: str
    accion: str
    detalle: Optional[str] = None
    fecha: str                        # ISO string

    class Config:
        from_attributes = True
