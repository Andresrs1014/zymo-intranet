from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Sede(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, sa_column_kwargs={"unique": True}, max_length=100)
    # Sedes RH (ej. Transversal): false — no pueden ser plataforma de formalización OC
    visible_en_solicitudes_oc: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
