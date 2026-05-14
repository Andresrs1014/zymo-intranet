from pydantic import BaseModel, field_validator
import re


class TaskListConfigCreate(BaseModel):
    list_type: str
    value: str
    label: str

    @field_validator("list_type")
    @classmethod
    def validate_list_type(cls, v: str) -> str:
        allowed = {"estado", "etiqueta", "plataforma", "prioridad_agenda"}
        if v not in allowed:
            raise ValueError(f"list_type must be one of: {', '.join(allowed)}")
        return v

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9_]+$", v):
            raise ValueError("value must be lowercase letters, numbers and underscores only")
        if len(v) < 2:
            raise ValueError("value must be at least 2 characters")
        return v


class TaskListConfigUpdate(BaseModel):
    label: str | None = None
    is_active: bool | None = None


class TaskEstadoEspecialPayload(BaseModel):
    tipo: str | None = None   # "final" | "cancelado" | None (clears)


class TaskListConfigRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    list_type: str
    value: str
    label: str
    is_active: bool
    is_final: bool = False
    is_canceled: bool = False
