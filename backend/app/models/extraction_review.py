# backend/app/models/extraction_review.py
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class ExtractionReview(SQLModel, table=True):
    __tablename__ = "extraction_reviews"

    id: Optional[int] = Field(default=None, primary_key=True)
    # Etiqueta cruda tal como la vio Gemini en el documento
    label_raw: str = Field(nullable=False, max_length=200)
    # Campo canónico que Gemini sugiere (puede ser None si Gemini no supo)
    campo_sugerido: Optional[str] = Field(default=None, max_length=100)
    # Confianza de Gemini: "alta" | "media" | "baja"
    confianza_ia: str = Field(default="media", max_length=20)
    # Tipo de documento: "cotizacion" | "factura"
    tipo_documento: str = Field(default="cotizacion", max_length=50)
    # Estado: "pendiente" | "aprobado" | "rechazado"
    estado: str = Field(default="pendiente", max_length=20)
    # ID de solicitud o factura de donde vino (para trazabilidad)
    contexto_id: Optional[str] = Field(default=None, max_length=100)
    # Fragmento de texto donde Gemini encontró la etiqueta (para contexto visual en UI)
    fragmento_texto: Optional[str] = Field(default=None, max_length=500)
    revisado_por_id: Optional[int] = Field(default=None)
    revisado_por_email: Optional[str] = Field(default=None, max_length=200)
    creado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    revisado_en: Optional[datetime] = Field(default=None)
