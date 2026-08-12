# backend/app/models/rubrica.py
from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class RubricaCategoria(SQLModel, table=True):
    """Categoría de la rúbrica de análisis completo (MCP-001 / sig_analyze_full).

    Antes vivía hardcodeada como constantes de Python en netvault.py — se movió
    a tabla para que se pueda editar desde la página "Análisis" del SIG.
    """
    __tablename__ = "rubrica_categorias"

    id: str = Field(primary_key=True, max_length=50)  # ej. "claridad" — clave natural, no autoincrement
    name: str = Field(max_length=100)
    weight: float
    description: str = Field(max_length=500)
    checks: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    orden: int = Field(default=0)
