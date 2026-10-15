"""Permisos a aplicaciones: se dan directo a la persona (usuario). Solo organiza quién VE qué; no cambia cómo funciona ninguna herramienta."""
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


class UsuarioPermiso(SQLModel, table=True):
    __tablename__ = "usuario_permiso"
    __table_args__ = (UniqueConstraint("user_id", "permiso", name="uq_usuario_permiso"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True, nullable=False))
    permiso: str = Field(index=True, max_length=100)


class HerramientaAcceso(SQLModel, table=True):
    """Un permiso exclusivo de ciertas áreas. Sin fila = compartido (cualquier persona de cualquier área puede recibirlo)."""
    __tablename__ = "herramienta_acceso"

    permiso: str = Field(primary_key=True, max_length=100)
    areas: list[int] = Field(default_factory=list, sa_column=Column(JSON))

