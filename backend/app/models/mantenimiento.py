import logging
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel

log = logging.getLogger(__name__)


class EstadoMantenimiento(str, Enum):
    solicitud  = "solicitud"
    evaluacion = "evaluacion"
    programado = "programado"
    ejecucion  = "ejecucion"
    completado = "completado"
    cerrado    = "cerrado"
    cancelado  = "cancelado"


class ClasificacionMantenimiento(str, Enum):
    preventivo = "preventivo"
    correctivo = "correctivo"


class ModalidadMantenimiento(str, Enum):
    interno = "interno"
    externo = "externo"


class SolicitudMantenimiento(SQLModel, table=True):
    __tablename__ = "mnt_solicitudes"

    id:          Optional[int] = Field(default=None, primary_key=True)
    consecutivo: str = Field(max_length=30, unique=True)

    titulo:      str = Field(max_length=300)
    descripcion: str

    # Tipo configurable (nombre del tipo, referencia al nombre en mnt_tipos_config)
    tipo_mantenimiento: str = Field(max_length=100)

    clasificacion: str = Field(max_length=20)   # ClasificacionMantenimiento
    modalidad:     str = Field(max_length=20)   # ModalidadMantenimiento

    # Solo cuando clasificacion = "preventivo"
    fecha_proxima_mantenimiento: Optional[date] = Field(default=None)

    estado:           str = Field(default=EstadoMantenimiento.solicitud, max_length=30)
    fecha_programada: Optional[datetime] = Field(default=None)
    notas_evaluacion: Optional[str] = Field(default=None)

    # IDs de usuarios (tabla principal app.db — se resuelven via JOIN en la capa de respuesta)
    solicitante_id: int
    asignado_id:    Optional[int] = Field(default=None)

    # empresa_id para multi-tenant
    empresa_nombre: Optional[str] = Field(default=None, max_length=100)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TipoMantenimientoConfig(SQLModel, table=True):
    __tablename__ = "mnt_tipos_config"

    id:     Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100)
    activo: bool = Field(default=True)
    orden:  int = Field(default=0)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HistorialMantenimiento(SQLModel, table=True):
    __tablename__ = "mnt_historial"

    id:              Optional[int] = Field(default=None, primary_key=True)
    solicitud_id:    int = Field(index=True)
    estado_anterior: Optional[str] = Field(default=None, max_length=30)
    estado_nuevo:    str = Field(max_length=30)
    nota:            Optional[str] = Field(default=None)
    usuario_id:      int
    usuario_nombre:  str = Field(max_length=200)
    fecha:           datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
