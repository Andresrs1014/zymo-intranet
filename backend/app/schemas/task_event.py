# backend/app/schemas/task_event.py
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional


class TaskEventParticipantRead(BaseModel):
    user_id: int
    user_nombre: str
    has_conflict: bool
    conflict_detail: Optional[str] = None


class TaskEventCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    plataforma: Optional[str] = None
    prioridad: Optional[str] = None
    modalidad: Optional[str] = None    # "presencial" | "virtual"
    sede: Optional[str] = None
    fecha: str                         # "YYYY-MM-DD"
    hora_inicio: str                   # "HH:MM"
    duracion_minutos: int = Field(default=60, ge=5, le=1440)
    participant_ids: list[int] = Field(min_length=1)

    @field_validator("fecha")
    @classmethod
    def validate_fecha(cls, v: str) -> str:
        if not re.match(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("fecha must be YYYY-MM-DD")
        return v

    @field_validator("hora_inicio")
    @classmethod
    def validate_hora_inicio(cls, v: str) -> str:
        if not re.match(r"\d{2}:\d{2}", v):
            raise ValueError("hora_inicio must be HH:MM")
        return v


class TaskEventParticipantsUpdate(BaseModel):
    add_ids: list[int] = Field(default_factory=list)
    remove_ids: list[int] = Field(default_factory=list)


class TaskEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descripcion: Optional[str] = None
    plataforma: Optional[str] = None
    prioridad: Optional[str] = None
    modalidad: Optional[str] = None
    sede: Optional[str] = None
    fecha: str
    hora_inicio: str
    duracion_minutos: int
    creado_por_id: int
    creado_por_nombre: str
    participants: list[TaskEventParticipantRead] = []


class TaskActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    user_nombre: str
    accion: str
    detalle: Optional[str] = None
    fecha: str                        # ISO string
