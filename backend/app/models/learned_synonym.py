# backend/app/models/learned_synonym.py
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class LearnedSynonym(SQLModel, table=True):
    __tablename__ = "learned_synonyms"

    id: Optional[int] = Field(default=None, primary_key=True)
    label: str = Field(nullable=False, max_length=200)
    # Nombre canónico del campo: debe ser una clave de FIELD_SYNONYMS
    # Ej: "valor_antes_iva", "forma_pago", "proveedor_nit"
    canonical_field: str = Field(nullable=False, max_length=100)
    # Tipo de documento donde se encontró: "cotizacion" | "factura"
    tipo_documento: str = Field(default="cotizacion", max_length=50)
    aprobado_por_id: int = Field(nullable=False)          # user.id del admin que aprobó
    aprobado_por_email: str = Field(nullable=False, max_length=200)
    # Cuántas veces se ha visto esta etiqueta en documentos (incrementado en background)
    veces_visto: int = Field(default=1)
    creado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
