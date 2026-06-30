import unittest
from unittest.mock import patch

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.personal_database import PtcCargo, PtcCargoSede
from app.routers import personal
from app import tc_org_seed


class EmptyMainDb:
    def exec(self, _query: object) -> "EmptyMainDb":
        return self

    def all(self) -> list[object]:
        return []


def memory_engine() -> Engine:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(
        engine,
        tables=[
            SQLModel.metadata.tables[PtcCargo.__tablename__],
            SQLModel.metadata.tables[PtcCargoSede.__tablename__],
        ],
    )
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE ptc_config (key TEXT PRIMARY KEY, value TEXT)"))
    return engine


class OrganigramaTests(unittest.TestCase):
    def test_cargo_manual_default_y_ciclo(self) -> None:
        engine = memory_engine()
        with Session(engine) as db:
            body = personal.CargoCreate(nombre="Cargo manual")
            self.assertEqual(body.org_context, "corporativo")
            created = personal.crear_cargo(body, db, None)
            manual = db.get(PtcCargo, created["id"])
            self.assertEqual(manual.org_context, "corporativo")
            self.assertEqual(manual.org_key, "")

            child = PtcCargo(nombre="Hijo", parent_id=manual.id)
            grandchild = PtcCargo(nombre="Nieto")
            db.add(child)
            db.flush()
            grandchild.parent_id = child.id
            db.add(grandchild)
            db.commit()
            self.assertTrue(
                personal._cargo_parent_creates_cycle(db, manual.id, grandchild.id)
            )
            self.assertFalse(
                personal._cargo_parent_creates_cycle(db, grandchild.id, manual.id)
            )
            with self.assertRaises(personal.HTTPException) as raised:
                personal.actualizar_cargo(
                    manual.id,
                    personal.CargoUpdate(parent_id=grandchild.id),
                    db,
                    None,
                )
            self.assertEqual(raised.exception.status_code, 400)
            db.refresh(manual)
            self.assertIsNone(manual.parent_id)

    def test_seed_crea_raiz_corporativa_y_reseed_preserva_ediciones(self) -> None:
        engine = memory_engine()
        with patch.object(tc_org_seed, "get_personal_engine", return_value=engine):
            tc_org_seed.seed_organigrama_if_needed(EmptyMainDb())
            with Session(engine) as db:
                root = db.exec(
                    select(PtcCargo).where(
                        PtcCargo.org_context == "corporativo",
                        PtcCargo.org_key == "gg",
                    )
                ).one()
                self.assertEqual(root.nombre, "Gerente General")
                self.assertIsNone(root.parent_id)
                root.org_number = "GG-editado"
                root.org_image_url = "/tc-fotos/gg-editado.png"
                db.add(root)
                db.commit()

            with engine.begin() as conn:
                conn.execute(text(
                    "DELETE FROM ptc_config WHERE key='organigrama_seed_v2'"
                ))
            tc_org_seed.seed_organigrama_if_needed(EmptyMainDb())

            with Session(engine) as db:
                root = db.exec(
                    select(PtcCargo).where(PtcCargo.org_key == "gg")
                ).one()
                self.assertEqual(root.org_number, "GG-editado")
                self.assertEqual(root.org_image_url, "/tc-fotos/gg-editado.png")

    def test_reseed_es_solo_admin(self) -> None:
        route = next(
            route
            for route in personal.router.routes
            if route.path == "/tc/organigrama/reseed" and "POST" in route.methods
        )
        self.assertTrue(
            any(dep.call is personal.require_admin for dep in route.dependant.dependencies)
        )


if __name__ == "__main__":
    unittest.main()
