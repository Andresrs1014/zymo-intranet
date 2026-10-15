import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.models.area import Area
from app.models.area_acceso import UsuarioPermiso
from app.models.sede import Sede
from app.models.user import User
from app.personal_database import PtcCargo, PtcPersona
from app.routers import area_acceso as r
from app.services import acceso_area


def memoria():
    return create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)


class OrganizacionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.main, self.pers = memoria(), memoria()
        SQLModel.metadata.create_all(self.main, tables=[SQLModel.metadata.tables[t] for t in ("area", "sede", "usuario_permiso", "herramienta_acceso", "user")])
        SQLModel.metadata.create_all(self.pers, tables=[SQLModel.metadata.tables[t] for t in ("ptc_cargo", "ptc_cargo_sede", "ptc_persona")])
        p = patch.object(r, "get_personal_engine", return_value=self.pers)
        p.start()
        self.addCleanup(p.stop)
        self.db = Session(self.main)
        self.addCleanup(self.db.close)
        self.db.add_all([Area(id=1, name="Comercial"), Area(id=2, name="Compras"), Sede(id=1, name="LOGIMAT")])
        for n in ("a@x.co", "b@x.co", "c@x.co"):
            self.db.add(User(email=n, hashed_password="x", area="Comercial"))
        self.db.add(User(email="d@x.co", hashed_password="x", area="Compras"))
        self.db.commit()
        with Session(self.pers) as p:
            p.add_all([PtcCargo(id=1, area_id=1, nombre="Ejecutivo"), PtcCargo(id=2, area_id=1, nombre="Asesor"),
                       PtcCargo(id=3, area_id=None, nombre="Libre"), PtcCargo(id=4, area_id=2, nombre="Comprador")])
            p.add_all([PtcPersona(id=1, nombre="A", area_id=1, cargo_id=1, user_id=1),
                       PtcPersona(id=2, nombre="B", area_id=1, cargo_id=2, user_id=2)])
            p.commit()

    def user(self, i: int) -> User:
        return self.db.get(User, i)

    def permisos(self, i: int) -> set[str]:
        return acceso_area.permisos_asignados(self.db, self.user(i))

    def ficha(self, user_id: int) -> list[PtcPersona]:
        with Session(self.pers) as p:
            return list(p.exec(select(PtcPersona).where(PtcPersona.user_id == user_id)).all())

    # ── permisos a la persona ─────────────────────────────────────────────────
    def test_los_permisos_son_de_la_persona_no_del_cargo(self) -> None:
        r.fijar_permisos(1, 1, r.PermisosIn(permisos=["mod_solicitudes", "mod_oc_ver"]), None, self.db)
        self.assertEqual(self.permisos(1), {"mod_solicitudes", "mod_oc_ver"})
        self.assertEqual(self.permisos(2), set())  # misma área, distinto cargo: no hereda nada

    def test_fijar_reemplaza_y_vaciar_quita(self) -> None:
        r.fijar_permisos(1, 1, r.PermisosIn(permisos=["mod_sig"]), None, self.db)
        r.fijar_permisos(1, 1, r.PermisosIn(permisos=["mod_sgc"]), None, self.db)
        self.assertEqual(self.permisos(1), {"mod_sgc"})
        r.fijar_permisos(1, 1, r.PermisosIn(), None, self.db)
        self.assertEqual(self.permisos(1), set())

    def test_permiso_con_formato_raro_se_rechaza(self) -> None:
        with self.assertRaises(HTTPException) as e:
            r.fijar_permisos(1, 1, r.PermisosIn(permisos=["MOD sig; drop"]), None, self.db)
        self.assertEqual(e.exception.status_code, 422)

    def test_herramienta_exclusiva_solo_la_reciben_personas_de_esas_areas(self) -> None:
        r.hacer_exclusivo("mod_tickets", r.ExclusivoIn(areas=[2]), None, self.db)
        with self.assertRaises(HTTPException):
            r.fijar_permisos(1, 1, r.PermisosIn(permisos=["mod_tickets"]), None, self.db)  # Comercial
        r.fijar_permisos(2, 4, r.PermisosIn(permisos=["mod_tickets"]), None, self.db)  # Compras
        self.assertEqual(self.permisos(4), {"mod_tickets"})

    def test_si_se_vuelve_exclusiva_despues_deja_de_aplicar_sin_borrar(self) -> None:
        r.fijar_permisos(1, 1, r.PermisosIn(permisos=["mod_sig"]), None, self.db)
        r.hacer_exclusivo("mod_sig", r.ExclusivoIn(areas=[2]), None, self.db)
        self.assertEqual(self.permisos(1), set())
        self.assertEqual(len(self.db.exec(select(UsuarioPermiso)).all()), 1)  # la fila sigue
        r.hacer_exclusivo("mod_sig", r.ExclusivoIn(areas=[]), None, self.db)
        self.assertEqual(self.permisos(1), {"mod_sig"})

    # ── crear persona: cargo y permisos opcionales, sin pasos ──────────────────
    def test_crear_persona_solo_con_lo_basico(self) -> None:
        out = r.crear_usuario(1, r.UsuarioNuevoIn(full_name="Nueva Persona", email="n@x.co", password="12345678"), None, self.db)
        u = self.user(out["id"])
        self.assertEqual((u.area, u.role, out["cargo"]), ("Comercial", "empleado", None))
        self.assertEqual(self.ficha(u.id), [])  # sin cargo no se toca el directorio
        self.assertEqual(self.permisos(u.id), set())

    def test_crear_persona_con_cargo_y_permisos_crea_la_ficha(self) -> None:
        out = r.crear_usuario(1, r.UsuarioNuevoIn(full_name="Ana Gómez", email="ana@x.co", password="12345678", sede="LOGIMAT",
                                                 cargo="Líder de cuenta", permisos=["mod_solicitudes"]), None, self.db)
        f = self.ficha(out["id"])
        self.assertEqual(len(f), 1)
        self.assertEqual((f[0].area_id, f[0].sede_id), (1, 1))
        with Session(self.pers) as p:
            self.assertEqual(p.get(PtcCargo, f[0].cargo_id).nombre, "Líder de cuenta")
        self.assertEqual(self.permisos(out["id"]), {"mod_solicitudes"})

    def test_crear_persona_enlaza_la_ficha_existente_con_el_mismo_correo(self) -> None:
        with Session(self.pers) as p:
            p.add(PtcPersona(id=9, nombre="LOPEZ RUIZ LUIS", email_corporativo="Luis@X.co", area_id=2))
            p.commit()
        out = r.crear_usuario(1, r.UsuarioNuevoIn(full_name="Luis López", email="luis@x.co", password="12345678", cargo="Asesor"), None, self.db)
        f = self.ficha(out["id"])
        self.assertEqual([(x.id, x.area_id, x.cargo_id) for x in f], [(9, 1, 2)])  # misma ficha, no duplica
        with Session(self.pers) as p:
            self.assertEqual(len(p.exec(select(PtcPersona)).all()), 3)

    def test_correo_repetido_da_409_y_exclusivo_ajeno_no_deja_creada_la_cuenta(self) -> None:
        with self.assertRaises(HTTPException) as e:
            r.crear_usuario(1, r.UsuarioNuevoIn(full_name="Otro", email="A@x.co", password="12345678"), None, self.db)
        self.assertEqual(e.exception.status_code, 409)
        r.hacer_exclusivo("mod_tickets", r.ExclusivoIn(areas=[2]), None, self.db)
        with self.assertRaises(HTTPException):
            r.crear_usuario(1, r.UsuarioNuevoIn(full_name="Otro", email="otro@x.co", password="12345678", permisos=["mod_tickets"]), None, self.db)
        self.assertIsNone(self.db.exec(select(User).where(User.email == "otro@x.co")).first())

    def test_crear_persona_suelta_vinculos_viejos_de_un_usuario_borrado(self) -> None:
        with Session(self.pers) as p:  # fichas que apuntan al id que va a tener la cuenta nueva (pero nunca fue suya)
            p.add_all([PtcPersona(id=20, nombre="Vieja 1", area_id=1, user_id=5), PtcPersona(id=21, nombre="Vieja 2", area_id=1, user_id=5)])
            p.commit()
        out = r.crear_usuario(1, r.UsuarioNuevoIn(full_name="Persona Nueva", email="nueva@x.co", password="12345678", cargo="Asesor"), None, self.db)
        self.assertEqual(out["id"], 5)
        self.assertEqual(len(self.ficha(5)), 1)  # solo la suya, creada ahora
        with Session(self.pers) as p:
            self.assertEqual([p.get(PtcPersona, i).user_id for i in (20, 21)], [None, None])

    # ── cargo en el directorio ─────────────────────────────────────────────────
    def test_cambiar_cargo_existente_nuevo_y_libre(self) -> None:
        r.cambiar_cargo(1, 2, r.CargoIn(cargo_id=1), None, self.db)
        self.assertEqual(self.ficha(2)[0].cargo_id, 1)
        r.cambiar_cargo(1, 2, r.CargoIn(nombre="  asesor "), None, self.db)  # misma palabra, otra grafía: no duplica
        self.assertEqual(self.ficha(2)[0].cargo_id, 2)
        r.cambiar_cargo(1, 2, r.CargoIn(cargo_id=3), None, self.db)  # un cargo sin área también se puede elegir
        self.assertEqual(self.ficha(2)[0].cargo_id, 3)
        out = r.cambiar_cargo(1, 2, r.CargoIn(nombre="Líder de cuenta"), None, self.db)
        with Session(self.pers) as p:
            self.assertEqual(p.get(PtcCargo, out["cargo_id"]).area_id, 1)

    def test_cambiar_cargo_a_alguien_sin_ficha_la_crea(self) -> None:
        r.cambiar_cargo(1, 3, r.CargoIn(nombre="Asesor"), None, self.db)
        self.assertEqual((self.ficha(3)[0].area_id, self.ficha(3)[0].cargo_id), (1, 2))

    def test_cambiar_cargo_rechaza_cargo_de_otra_area_y_vinculo_ambiguo(self) -> None:
        with self.assertRaises(HTTPException):
            r.cambiar_cargo(1, 2, r.CargoIn(cargo_id=4), None, self.db)
        with Session(self.pers) as p:
            p.add(PtcPersona(id=5, nombre="E", area_id=1, cargo_id=1, user_id=1))  # el usuario 1 queda con dos fichas
            p.commit()
        with self.assertRaises(HTTPException) as e:
            r.cambiar_cargo(1, 1, r.CargoIn(cargo_id=2), None, self.db)
        self.assertEqual(e.exception.status_code, 422)

    # ── catálogo para el SIG ───────────────────────────────────────────────────
    def test_catalogo_de_areas_para_el_sig_trae_cargos_y_exige_la_clave(self) -> None:
        with patch.object(r.settings, "internal_key", "clave-de-prueba"):
            with self.assertRaises(HTTPException) as e:
                r.catalogo_areas("otra", self.db)
            self.assertEqual(e.exception.status_code, 403)
            cat = {a["name"]: a["cargos"] for a in r.catalogo_areas("clave-de-prueba", self.db)}
        self.assertEqual(cat["Comercial"], ["Asesor", "Ejecutivo"])  # los que usa su gente o le pertenecen
        self.assertEqual(cat["Compras"], ["Comprador"])

    # ── listados ───────────────────────────────────────────────────────────────
    def test_listado_de_usuarios_trae_cargo_y_permisos(self) -> None:
        r.fijar_permisos(1, 1, r.PermisosIn(permisos=["mod_sig"]), None, self.db)
        por_id = {u["id"]: u for u in r.usuarios_del_area(1, None, self.db)}
        self.assertEqual((por_id[1]["cargo"], por_id[1]["permisos"], por_id[2]["permisos"]), ("Ejecutivo", ["mod_sig"], []))
        self.assertEqual((por_id[3]["fichas"], por_id[3]["persona_id"]), (0, None))

    def test_lista_de_cargos_separa_los_del_area_de_los_libres(self) -> None:
        por_id = {c["id"]: c["de_area"] for c in r.cargos_del_area(1, None, self.db)}
        self.assertEqual((por_id[1], por_id[3]), (True, False))
        self.assertNotIn(4, por_id)  # cargo de otra área


if __name__ == "__main__":
    unittest.main()
