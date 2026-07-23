from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class PlataformaPerfil(SQLModel, table=True):
    """Perfil de plataforma (Sede) para el hub de T&C — logo y nombre propios,
    configurados por el usuario. Una Sede sin fila acá no tiene Hub visible en
    "Empresas del grupo": la activación es explícita, no automática."""
    __tablename__ = "plataforma_perfil"

    sede_id: int = Field(primary_key=True)
    nombre: str = Field(max_length=100)
    logo_url: str = Field(default="", max_length=500)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
