# backend/app/models/analysis_kind.py
from sqlmodel import Field, SQLModel


class AnalysisKind(SQLModel, table=True):
    """Catálogo de tipos de análisis del SIG (Coherencia, Mejoras, etc.).

    Antes vivía hardcodeado como ANALYSIS_KINDS en SigRubricaPanel.tsx — se
    movió a tabla para que se pueda editar desde la página "Análisis" del SIG,
    igual que ya pasó con RubricaCategoria (backend/app/models/rubrica.py).
    """
    __tablename__ = "analysis_kinds"

    id: str = Field(primary_key=True, max_length=50)  # ej. "coherencia" — clave natural
    name: str = Field(max_length=100)
    cost: str = Field(max_length=10)  # "bajo" | "medio" | "alto"
    description: str = Field(max_length=500)
    where_text: str = Field(max_length=300)
    orden: int = Field(default=0)
