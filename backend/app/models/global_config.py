from sqlmodel import Field, SQLModel


class GlobalConfig(SQLModel, table=True):
    """Configuración general de la intranet compartida entre módulos (ej. SMTP
    corporativo). Clave-valor, mismo patrón que OcConfig — evita una tabla
    nueva por cada setting."""
    __tablename__ = "global_config"

    key: str = Field(primary_key=True, max_length=100)
    value: str = Field(default="")
