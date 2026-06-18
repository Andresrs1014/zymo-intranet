"""
Base de datos del módulo T&C (Talento y Cultura) — Personal.

Dominio: registro de colaboradores de las 3 empresas del grupo ZYMO.
Tablas: ptc_empresa, ptc_area, ptc_cargo, ptc_persona

Sigue el mismo patrón que gerencial_database.py.
"""
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel, Session, create_engine

from app.config import settings
from app.sqlite_paths import ensure_sqlite_parent_dir

_personal_engine = None


def get_personal_engine():
    global _personal_engine
    if _personal_engine is None:
        url = settings.personal_database_url
        connect_args = {}
        if "sqlite" in url.lower():
            ensure_sqlite_parent_dir(url)
            connect_args = {"check_same_thread": False}
        _personal_engine = create_engine(url, connect_args=connect_args)
    return _personal_engine


def get_personal_db():
    with Session(get_personal_engine()) as session:
        yield session


# ── Modelos ────────────────────────────────────────────────────────────────────

class PtcEmpresa(SQLModel, table=True):
    __tablename__ = "ptc_empresa"

    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100)
    codigo: str = Field(max_length=20, unique=True)  # "ZYMOLOGI" | "ZYMOIMCC" | "ZYMOIMDE"
    sede_ref: str = Field(max_length=50, default="")  # referencia al claim 'sede' del JWT
    legacy_id: int = Field(default=0)                 # 0,1,2 del Directorio original


class PtcArea(SQLModel, table=True):
    __tablename__ = "ptc_area"

    id: Optional[int] = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="ptc_empresa.id")
    nombre: str = Field(max_length=100)


class PtcCargo(SQLModel, table=True):
    __tablename__ = "ptc_cargo"

    id: Optional[int] = Field(default=None, primary_key=True)
    empresa_id: int = Field(foreign_key="ptc_empresa.id")
    area_id: Optional[int] = Field(default=None, foreign_key="ptc_area.id")
    nombre: str = Field(max_length=150)


class PtcPersona(SQLModel, table=True):
    __tablename__ = "ptc_persona"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Identificación
    nombre: str = Field(max_length=150)
    initials: str = Field(max_length=5, default="")
    documento: str = Field(max_length=30, default="")

    # Organización
    empresa_id: int = Field(foreign_key="ptc_empresa.id")
    area_id: Optional[int] = Field(default=None, foreign_key="ptc_area.id")
    cargo_id: Optional[int] = Field(default=None, foreign_key="ptc_cargo.id")

    # Datos personales
    genero: str = Field(max_length=20, default="")
    rh: str = Field(max_length=10, default="")
    email: str = Field(max_length=150, default="")
    email_corporativo: str = Field(max_length=150, default="")
    telefono: str = Field(max_length=30, default="")
    telefono_corporativo: str = Field(max_length=30, default="")
    foto_url: str = Field(max_length=500, default="")

    # Contrato
    tipo_contrato: str = Field(max_length=80, default="Término indefinido")
    fecha_ingreso: Optional[date] = None
    antiguedad_label: str = Field(max_length=50, default="")
    estado: str = Field(max_length=20, default="Activo")   # "Activo" | "Inactivo"
    tipo_salida: str = Field(max_length=80, default="")
    fecha_salida: Optional[date] = None

    # Desarrollo
    idp_active: bool = False
    idp_eligible: bool = True

    # Vínculo con intranet (nullable — no todos tienen login)
    user_id: Optional[int] = None

    # Trazabilidad
    legacy_id: str = Field(max_length=80, default="", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ── Creación de tablas ─────────────────────────────────────────────────────────

_PERSONAL_TABLES = {"ptc_empresa", "ptc_area", "ptc_cargo", "ptc_persona"}


def create_personal_tables() -> None:
    from app.personal_database import PtcEmpresa, PtcArea, PtcCargo, PtcPersona  # noqa: F401
    tables = [
        SQLModel.metadata.tables[t]
        for t in _PERSONAL_TABLES
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_personal_engine(), tables=tables)
    _seed_empresas()


_EMPRESAS_SEED = [
    {"nombre": "Zymologística S.A.S", "codigo": "ZYMOLOGI", "sede_ref": "LOGIMAT", "legacy_id": 0},
    {"nombre": "IMC Cargo International", "codigo": "ZYMOIMCC", "sede_ref": "IMCCARGO", "legacy_id": 1},
    {"nombre": "IMC Depósito", "codigo": "ZYMOIMDE", "sede_ref": "IMC Depósito", "legacy_id": 2},
]


def _seed_empresas() -> None:
    from sqlmodel import select
    with Session(get_personal_engine()) as session:
        for data in _EMPRESAS_SEED:
            existing = session.exec(
                select(PtcEmpresa).where(PtcEmpresa.codigo == data["codigo"])
            ).first()
            if not existing:
                session.add(PtcEmpresa(**data))
        session.commit()
