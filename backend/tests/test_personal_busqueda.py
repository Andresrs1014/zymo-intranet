"""La búsqueda de personas del Directorio no distingue tildes, Ñ ni mayúsculas (WOW daba
"Ambas personas deben estar en el Directorio" a quien tenía Ñ o tilde en el nombre)."""
from unittest.mock import patch

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.personal_database import PtcPersona, registrar_sin_acentos, sin_acentos
from app.routers import personal


class _MainDbVacia:
    def get(self, *_args):
        return None


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    registrar_sin_acentos(engine)
    SQLModel.metadata.create_all(engine, tables=[SQLModel.metadata.tables[PtcPersona.__tablename__]])
    with Session(engine) as session:
        session.add_all([
            PtcPersona(nombre="OROZCO NIÑO LORENA ALEJANDRA", estado="Activo"),
            PtcPersona(nombre="SANDON NUÑEZ JORGE LUIS", estado="Activo"),
            PtcPersona(nombre="MONTENEGRO CONTRERAS LAURA LUCIA", estado="Activo"),
            PtcPersona(nombre="NIÑO RETIRADO PEDRO", estado="Inactivo"),
        ])
        session.commit()
        yield session


def _buscar(db, q):
    with patch.object(personal, "_valid_internal_key", return_value=True):
        return personal.buscar_personas_publico(q=q, x_internal_key="x", db=db, main_db=_MainDbVacia())


def test_sin_acentos():
    assert sin_acentos("OROZCO NIÑO") == "orozco nino"
    assert sin_acentos("Lucía Peña") == "lucia pena"
    assert sin_acentos(None) == ""


@pytest.mark.parametrize("q", [
    "OROZCO NIÑO LORENA ALEJANDRA",  # el nombre exacto que manda el formulario de WOW
    "orozco niño",
    "orozco nino",
    "NINO LORENA",
])
def test_encuentra_a_quien_tiene_enie(db, q):
    assert [p.nombre for p in _buscar(db, q)] == ["OROZCO NIÑO LORENA ALEJANDRA"]


def test_encuentra_nombre_con_enie_en_el_medio_y_sin_enie(db):
    assert [p.nombre for p in _buscar(db, "SANDON NUÑEZ JORGE LUIS")] == ["SANDON NUÑEZ JORGE LUIS"]
    assert [p.nombre for p in _buscar(db, "MONTENEGRO CONTRERAS LAURA LUCIA")] == ["MONTENEGRO CONTRERAS LAURA LUCIA"]


def test_no_devuelve_inactivos(db):
    assert _buscar(db, "RETIRADO") == []


def test_listar_personas_tambien_ignora_tildes(db):
    respuesta = personal.listar_personas(
        q="nuñez", empresa_id=None, area_id=None, cargo_id=None, estado=None, skip=0, limit=100,
        db=db, main_db=_MainDbVacia(), _=None,
    )
    assert respuesta["total"] == 1
