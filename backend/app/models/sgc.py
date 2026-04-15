import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ProveedorSGC(SQLModel, table=True):
    """
    Proveedor gestionado por SGC (Sistema de Gestión de Calidad).
    OC Automatizaciones lee de esta tabla para el selector de proveedores.

    Campos marcados [FORMATO] se ajustarán cuando llegue el formato oficial
    de evaluación de proveedores.
    """

    __tablename__ = "sgc_proveedores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # ── Identificación ────────────────────────────────────────────────────────
    nombre: str = Field(max_length=200, description="Razón social del proveedor")
    nit: Optional[str] = Field(default=None, max_length=50)
    representante_legal: Optional[str] = Field(default=None, max_length=200)  # [FORMATO]

    # ── Contacto ──────────────────────────────────────────────────────────────
    email: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=50)
    direccion: Optional[str] = Field(default=None, max_length=300)  # [FORMATO]
    ciudad: Optional[str] = Field(default=None, max_length=100)     # [FORMATO]

    # ── Clasificación ─────────────────────────────────────────────────────────
    # Ajustar opciones cuando llegue el formato oficial
    categoria: Optional[str] = Field(default=None, max_length=100)

    # ── Estado ────────────────────────────────────────────────────────────────
    activo: bool = Field(default=True)
    observaciones: Optional[str] = Field(default=None)  # Notas internas de SGC

    # ── Auditoría ─────────────────────────────────────────────────────────────
    creado_por_id: Optional[int] = Field(default=None)  # FK lógica → intranet.db users
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = Field(default=None)
