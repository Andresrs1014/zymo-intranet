import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class EstadoOC(str, Enum):
    nueva = "nueva"
    en_cotizacion = "en_cotizacion"
    pendiente_aprobacion = "pendiente_aprobacion"
    aprobada = "aprobada"
    rechazada = "rechazada"
    oc_enviada = "oc_enviada"
    entregada = "entregada"
    cerrada = "cerrada"


class SolicitudOC(SQLModel, table=True):
    __tablename__ = "oc_solicitudes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Datos que vienen de SharePoint/Forms via webhook de PA
    consecutivo_os: str = Field(max_length=50)
    descripcion: str
    categoria: Optional[str] = Field(default=None, max_length=100)
    grupo_articulos: Optional[str] = Field(default=None, max_length=100)
    cantidad: int
    nivel_prioridad: str = Field(default="Media", max_length=20)
    solicitante_nombre: str = Field(max_length=200)
    solicitante_email: Optional[str] = Field(default=None, max_length=200)
    area_solicitante: Optional[str] = Field(default=None, max_length=100)
    sede: Optional[str] = Field(default=None, max_length=100)
    cliente: Optional[str] = Field(default=None, max_length=200)
    condicion: Optional[str] = Field(default=None, max_length=200)
    observaciones_solicitante: Optional[str] = Field(default=None)
    placa_ficha: Optional[str] = Field(default=None, max_length=100)
    fecha_proximo_mantenimiento: Optional[date] = Field(default=None)

    # Gestión interna
    estado: str = Field(default=EstadoOC.nueva, max_length=30)
    # Referencia al user.id de intranet.db — sin FK constraint (DBs separadas)
    auxiliar_id: Optional[int] = Field(default=None)

    # Evidencia del solicitante (URL a OneDrive/SharePoint, enviada por PA)
    evidencia_url: Optional[str] = Field(default=None)

    # Campos de gestión de compras
    plataforma: Optional[str] = Field(default=None, max_length=100)
    numero_remision: Optional[str] = Field(default=None, max_length=100)
    observaciones_compras: Optional[str] = Field(default=None)
    fecha_estimada_entrega: Optional[date] = Field(default=None)
    fecha_confirmada_entrega: Optional[date] = Field(default=None)
    numero_factura: Optional[str] = Field(default=None, max_length=100)
    aval_compra: Optional[str] = Field(default=None, max_length=200)
    observacion_contabilidad: Optional[str] = Field(default=None)
    fecha_recibida_factura: Optional[date] = Field(default=None)

    # Fechas del proceso
    fecha_solicitud: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_cotizacion: Optional[datetime] = Field(default=None)
    fecha_aprobacion: Optional[datetime] = Field(default=None)
    fecha_envio_oc: Optional[datetime] = Field(default=None)
    fecha_recibido: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CotizacionProveedor(SQLModel, table=True):
    __tablename__ = "oc_cotizaciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="oc_solicitudes.id")

    # Datos del proveedor y cotización
    proveedor_nombre: str = Field(max_length=200)
    proveedor_email: Optional[str] = Field(default=None, max_length=200)
    numero_cotizacion_proveedor: Optional[str] = Field(default=None, max_length=100)
    valor_unitario: float
    valor_total: float
    fecha_vigencia: Optional[date] = Field(default=None)
    observaciones: Optional[str] = Field(default=None)

    # PDF adjunto
    pdf_path: Optional[str] = Field(default=None)
    extraccion_automatica: bool = Field(default=False)

    # Aprobación
    aprobada: Optional[bool] = Field(default=None)
    valor_aprobado: Optional[float] = Field(default=None)
    # Referencia al user.id de intranet.db — sin FK constraint (DBs separadas)
    aprobado_por_id: Optional[int] = Field(default=None)
    observaciones_aprobacion: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrdenCompra(SQLModel, table=True):
    __tablename__ = "oc_ordenes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    solicitud_id: uuid.UUID = Field(foreign_key="oc_solicitudes.id")
    cotizacion_id: uuid.UUID = Field(foreign_key="oc_cotizaciones.id")

    numero_oc: str = Field(max_length=50)
    pdf_path: Optional[str] = Field(default=None)

    enviada_proveedor: bool = Field(default=False)
    enviada_coordinador: bool = Field(default=False)
    email_proveedor: Optional[str] = Field(default=None, max_length=200)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Proveedor(SQLModel, table=True):
    __tablename__ = "oc_proveedores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre: str = Field(max_length=200, sa_column_kwargs={"unique": True})
    email: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=50)
    nit: Optional[str] = Field(default=None, max_length=50)
    categoria: Optional[str] = Field(default=None, max_length=100)
    activo: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
