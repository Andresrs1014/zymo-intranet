import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class EstadoFactura(str, Enum):
    pendiente = "pendiente"
    validada = "validada"
    con_diferencias = "con_diferencias"


class FacturaProveedor(SQLModel, table=True):
    """Factura de venta subida por contabilidad para una OC entregada."""
    __tablename__ = "fin_facturas"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Referencias a oc.db (sin FK constraint — DBs separadas)
    solicitud_id: uuid.UUID = Field(index=True)
    cotizacion_id: uuid.UUID = Field(index=True)
    orden_id: Optional[uuid.UUID] = Field(default=None)

    # Datos extraídos / ingresados de la factura
    numero_factura: Optional[str] = Field(default=None, max_length=100)
    valor_factura: Optional[float] = Field(default=None)
    fecha_factura: Optional[date] = Field(default=None)
    nit_proveedor: Optional[str] = Field(default=None, max_length=50)
    nombre_proveedor: Optional[str] = Field(default=None, max_length=200)

    # Campos de gestión contable
    fecha_recibida_factura: Optional[date] = Field(default=None)
    aval_compra: Optional[str] = Field(default=None, max_length=200)
    fecha_confirmada_entrega: Optional[date] = Field(default=None)

    # Valor de referencia copiado de la OC al momento de crear
    valor_aprobado_oc: Optional[float] = Field(default=None)

    # Archivo PDF de la factura
    pdf_path: Optional[str] = Field(default=None)
    extraccion_automatica: bool = Field(default=False)

    # Estado de validación
    estado: str = Field(default=EstadoFactura.pendiente, max_length=30)
    observaciones: Optional[str] = Field(default=None)

    # Usuario que registró (referencia a intranet.db user.id)
    registrado_por_id: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ValidacionFactura(SQLModel, table=True):
    """Resultado campo a campo de la validación de una factura vs su OC.
    Alimenta el motor de reconocimiento — Fase 2."""
    __tablename__ = "fin_validaciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    factura_id: uuid.UUID = Field(foreign_key="fin_facturas.id", index=True)

    campo: str = Field(max_length=100)          # ej: "valor_aprobado", "nit_proveedor"
    valor_esperado: Optional[str] = Field(default=None)   # de la OC
    valor_encontrado: Optional[str] = Field(default=None)  # del PDF extraído
    cumple: bool = Field(default=False)
    observacion: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
