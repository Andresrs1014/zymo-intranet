from sqlmodel import Field, SQLModel


class AreaSede(SQLModel, table=True):
    """Áreas activas por plataforma (Sede) — configurado desde "Gestionar áreas"
    en el Hub de cada plataforma. Independiente de si el área ya tiene cargos
    cargados ahí: permite reservar un área antes de crear su primer cargo."""
    __tablename__ = "area_sede"

    area_id: int = Field(primary_key=True)
    sede_id: int = Field(primary_key=True)
