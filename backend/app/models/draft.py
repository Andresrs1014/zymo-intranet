from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class FormDraft(SQLModel, table=True):
    __tablename__ = "form_drafts"

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        primary_key=True,
    )
    tipo: str = Field(nullable=False, max_length=50)
    # Valores válidos: "solicitud_nueva", "cotizacion", "factura"

    user_id: int = Field(nullable=False)

    contexto: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    payload: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    archivos: Optional[list] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    creado_en: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
