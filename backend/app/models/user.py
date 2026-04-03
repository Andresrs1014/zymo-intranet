from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, nullable=False, sa_column_kwargs={"unique": True})
    full_name: str | None = Field(default=None, max_length=200)
    hashed_password: str = Field(nullable=False)
    role: str = Field(default="empleado", nullable=False, max_length=50)
    sede: str | None = Field(default=None, max_length=100)   # IMCCARGO / LOGIMAT / IMC Depósito → futuro: sede
    area: str | None = Field(default=None, max_length=100)   # Comercial / Operaciones / RRHH / etc.
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    deactivated_at: datetime | None = Field(default=None)
    last_login_at: datetime | None = Field(default=None)
