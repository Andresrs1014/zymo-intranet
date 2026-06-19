from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


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


class OrigenMantenimiento(str, Enum):
    intranet               = "intranet"
    qr                     = "qr"
    whatsapp               = "whatsapp"
    telefonico_retroactivo = "telefonico_retroactivo"


class PrioridadMantenimiento(str, Enum):
    baja    = "baja"
    media   = "media"
    alta    = "alta"
    urgente = "urgente"


class SolicitudMantenimiento(SQLModel, table=True):
    __tablename__ = "mnt_solicitudes"

    id:          Optional[int] = Field(default=None, primary_key=True)
    consecutivo: str = Field(max_length=30, unique=True)

    titulo:      str = Field(max_length=300)
    descripcion: str

    tipo_mantenimiento: str = Field(max_length=100)
    clasificacion:      str = Field(max_length=20)
    modalidad:          str = Field(max_length=20)

    fecha_proxima_mantenimiento: Optional[date] = Field(default=None)

    estado:           str = Field(default=EstadoMantenimiento.solicitud, max_length=30)
    fecha_programada: Optional[datetime] = Field(default=None)
    notas_evaluacion: Optional[str] = Field(default=None)

    solicitante_id: int
    asignado_id:    Optional[int] = Field(default=None)
    empresa_nombre: Optional[str] = Field(default=None, max_length=100)

    # ── Campos Fase 1 ─────────────────────────────────────────────────────────
    origen:         str = Field(default=OrigenMantenimiento.intranet, max_length=30)
    prioridad:      str = Field(default=PrioridadMantenimiento.media, max_length=20)
    monto_estimado: Optional[Decimal] = Field(default=None)
    monto_real:     Optional[Decimal] = Field(default=None)
    evidencia_url:  Optional[str] = Field(default=None, max_length=500)
    activo_qr_id:   Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TipoMantenimientoConfig(SQLModel, table=True):
    __tablename__ = "mnt_tipos_config"

    id:     Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, unique=True)
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


class MntAprobacion(SQLModel, table=True):
    """Aprobaciones requeridas para mantenimientos con monto > $2.000.000."""
    __tablename__ = "mnt_aprobaciones"

    id:               Optional[int] = Field(default=None, primary_key=True)
    solicitud_id:     int = Field(index=True)
    aprobador_id:     int
    aprobador_nombre: str = Field(max_length=200)
    rol_aprobador:    str = Field(max_length=50)
    aprobado:         bool = Field(default=True)
    nota:             Optional[str] = Field(default=None)
    fecha:            datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MntActivoQR(SQLModel, table=True):
    """Activos físicos con código QR para reporte rápido de novedades."""
    __tablename__ = "mnt_activos_qr"

    id:          Optional[int] = Field(default=None, primary_key=True)
    nombre:      str = Field(max_length=200)
    ubicacion:   str = Field(max_length=300)
    descripcion: Optional[str] = Field(default=None)
    activo:      bool = Field(default=True)
    qr_token:    str = Field(max_length=64, unique=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
