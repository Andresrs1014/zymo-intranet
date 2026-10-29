"""Pruebas del módulo de compras (OC): consecutivos, número de OC único, eliminar solicitud,
acceso a la solicitud, gestionar y transiciones de estado.

Todo corre contra SQLite en memoria (bases OC, principal y Financiero separadas, como en producción).
No se prueban correos, PDF real, extractor de cotizaciones ni pantallas.
"""
import uuid
from unittest.mock import patch

import pytest
from fastapi import BackgroundTasks, HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app import oc_database
from app.core.deps import require_admin
from app.models.financiero import FacturaProveedor
from app.models.oc import (
    CotizacionProveedor, EliminacionOC, EstadoOC, HistorialEstado, OrdenCompra, SolicitudOC,
)
from app.models.role import Role  # noqa: F401  (registra la tabla)
from app.models.area_acceso import UsuarioPermiso  # noqa: F401
from app.models.user import User
from app.routers.oc import documentos, solicitudes as sol
from app.services.consecutivos import liberar_consecutivo, siguiente_consecutivo
from app.services.oc_proforma import obtener_solicitud_con_acceso

OS = "OS-2026-"


def memoria():
    return create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)


@pytest.fixture
def oc():
    eng = memoria()
    with patch.object(oc_database, "get_oc_engine", return_value=eng):
        oc_database.create_oc_tables()  # mismas tablas e índices únicos que en producción
    with Session(eng) as s:
        yield s


@pytest.fixture
def db():
    eng = memoria()
    SQLModel.metadata.create_all(
        eng, tables=[SQLModel.metadata.tables[t] for t in ("user", "role", "usuario_permiso", "herramienta_acceso")]
    )
    with Session(eng) as s:
        s.add_all([
            User(id=1, email="admin@x.co", hashed_password="x", role="admin", full_name="Admin"),
            User(id=2, email="compras@x.co", hashed_password="x", area="Compras", full_name="Compras"),
            User(id=3, email="sol@x.co", hashed_password="x", area="Comercial", full_name="Solicitante"),
            User(id=4, email="otro@x.co", hashed_password="x", area="Comercial", full_name="Otro"),
        ])
        s.commit()
        yield s


@pytest.fixture
def fin():
    eng = memoria()
    SQLModel.metadata.create_all(eng, tables=[SQLModel.metadata.tables["fin_facturas"]])
    with Session(eng) as s:
        yield s


@pytest.fixture(autouse=True)
def sin_disco(tmp_path, monkeypatch):
    """Ninguna prueba toca /app/data: los directorios de archivos apuntan a una carpeta temporal."""
    monkeypatch.setattr(sol, "_SOLICITUDES_DIR", tmp_path / "solicitudes")
    monkeypatch.setattr(sol, "_COTIZACIONES_DIR_SOL", tmp_path / "cotizaciones")
    monkeypatch.setattr(documentos, "OC_DOCS_DIR", tmp_path / "oc_docs")
    monkeypatch.setattr(documentos, "_generar_pdf", lambda *a, **k: None)


def nueva(oc: Session, estado: EstadoOC = EstadoOC.nueva, **kw) -> SolicitudOC:
    s = SolicitudOC(
        consecutivo_os=kw.pop("consecutivo_os", None) or siguiente_consecutivo(oc, OS, SolicitudOC.consecutivo_os),
        descripcion="Sillas", cantidad=2, solicitante_nombre="Solicitante",
        solicitante_email="sol@x.co", estado=estado, **kw,
    )
    oc.add(s)
    oc.commit()
    return s


def con_cotizacion_aprobada(oc: Session, s: SolicitudOC) -> CotizacionProveedor:
    c = CotizacionProveedor(solicitud_id=s.id, proveedor_nombre="Prov", valor_unitario=10, valor_total=20, aprobada=True)
    oc.add(c)
    oc.commit()
    return c


def generar_oc(oc, db, s, **kw) -> OrdenCompra:
    return documentos.generar_orden_compra(s.id, current_user=db.get(User, 2), oc_db=oc, db=db, **kw)


def eliminar(oc, db, fin, s, motivo="Duplicada por error", liberar=False):
    payload = sol.EliminarSolicitudPayload(motivo=motivo, liberar_numero=liberar)
    return sol.eliminar_solicitud(s.id, payload, current_user=db.get(User, 1), oc_db=oc, fin_db=fin)


# ── Consecutivos OS/OC ────────────────────────────────────────────────────────

def test_consecutivo_empieza_en_uno_y_avanza(oc):
    assert [nueva(oc).consecutivo_os for _ in range(3)] == [f"{OS}0001", f"{OS}0002", f"{OS}0003"]


def test_consecutivo_no_se_reutiliza_tras_borrar_la_fila(oc):
    s = nueva(oc)
    oc.delete(s)
    oc.commit()
    assert nueva(oc).consecutivo_os == f"{OS}0002"


def test_consecutivo_respeta_numeros_mayores_ya_existentes(oc):
    nueva(oc, consecutivo_os=f"{OS}0040")  # fila importada a mano con un número alto
    assert nueva(oc).consecutivo_os == f"{OS}0041"


def test_numero_liberado_pero_ocupado_no_se_entrega(oc):
    for _ in range(3):
        nueva(oc)
    liberar_consecutivo(oc, f"{OS}0002")  # liberado pero sigue ocupado: no se entrega
    assert siguiente_consecutivo(oc, OS, SolicitudOC.consecutivo_os) == f"{OS}0004"


# ── Número de OC único ────────────────────────────────────────────────────────

def test_indice_unico_impide_dos_ordenes_con_el_mismo_numero(oc):
    s = nueva(oc)
    c = con_cotizacion_aprobada(oc, s)
    oc.add_all([OrdenCompra(solicitud_id=s.id, cotizacion_id=c.id, numero_oc="OC-2026-0001") for _ in range(2)])
    with pytest.raises(IntegrityError):
        oc.commit()


def test_generar_oc_numera_seguido_y_regenerar_conserva_el_numero(oc, db):
    a, b = nueva(oc), nueva(oc)
    con_cotizacion_aprobada(oc, a)
    con_cotizacion_aprobada(oc, b)
    na = generar_oc(oc, db, a).numero_oc
    nb = generar_oc(oc, db, b).numero_oc
    assert na.endswith("-0001") and nb.endswith("-0002")
    assert generar_oc(oc, db, a, forzar=True).numero_oc == na
    assert len(oc.exec(select(OrdenCompra)).all()) == 2


def test_si_falla_el_pdf_el_numero_de_oc_queda_consumido(oc, db, monkeypatch):
    a, b = nueva(oc), nueva(oc)
    con_cotizacion_aprobada(oc, a)
    con_cotizacion_aprobada(oc, b)

    def falla(*_a, **_k):
        raise RuntimeError("PDF")

    monkeypatch.setattr(documentos, "_generar_pdf", falla)
    with pytest.raises(RuntimeError):
        generar_oc(oc, db, a)
    assert oc.exec(select(OrdenCompra)).all() == []
    monkeypatch.setattr(documentos, "_generar_pdf", lambda *x, **k: None)
    assert generar_oc(oc, db, b).numero_oc.endswith("-0002")


# ── Eliminar solicitud ────────────────────────────────────────────────────────

def test_eliminar_exige_motivo():
    with pytest.raises(ValidationError):
        sol.EliminarSolicitudPayload(motivo="  ")
    with pytest.raises(ValidationError):
        sol.EliminarSolicitudPayload()


def test_eliminar_solo_admin(db):
    with pytest.raises(HTTPException) as e:
        require_admin(db.get(User, 2))
    assert e.value.status_code == 403


def test_eliminar_con_facturas_responde_409_y_no_borra(oc, db, fin):
    s = nueva(oc)
    fin.add(FacturaProveedor(solicitud_id=s.id, cotizacion_id=uuid.uuid4()))
    fin.commit()
    with pytest.raises(HTTPException) as e:
        eliminar(oc, db, fin, s)
    assert e.value.status_code == 409
    assert oc.get(SolicitudOC, s.id) is not None


def test_eliminar_borra_todo_deja_bitacora_y_no_reutiliza_numeros(oc, db, fin):
    s = nueva(oc, EstadoOC.aprobada)
    con_cotizacion_aprobada(oc, s)
    numero_oc = generar_oc(oc, db, s).numero_oc
    oc.add(HistorialEstado(solicitud_id=s.id, estado_nuevo="aprobada"))
    oc.commit()
    sid = s.id
    eliminar(oc, db, fin, s, motivo="  Duplicada por error  ")
    oc.expire_all()
    assert oc.get(SolicitudOC, sid) is None
    for modelo in (CotizacionProveedor, OrdenCompra, HistorialEstado):
        assert oc.exec(select(modelo).where(modelo.solicitud_id == sid)).all() == []
    b = oc.exec(select(EliminacionOC)).one()
    assert (b.motivo, b.consecutivo_os, b.numeros_oc, b.numero_liberado) == (
        "Duplicada por error", f"{OS}0001", numero_oc, False)
    assert nueva(oc).consecutivo_os == f"{OS}0002"


def test_eliminar_con_liberar_numero_permite_reusar_os_y_oc(oc, db, fin):
    s = nueva(oc)
    con_cotizacion_aprobada(oc, s)
    numero_oc = generar_oc(oc, db, s).numero_oc
    eliminar(oc, db, fin, s, liberar=True)
    t = nueva(oc)
    con_cotizacion_aprobada(oc, t)
    assert t.consecutivo_os == f"{OS}0001"
    assert generar_oc(oc, db, t).numero_oc == numero_oc


# ── Acceso a la solicitud (solicitante, compras, admin) ───────────────────────

@pytest.mark.parametrize("user_id, permitido", [(1, True), (2, True), (3, True), (4, False)])
def test_acceso_a_solicitud_historial_y_orden(oc, db, user_id, permitido):
    s = nueva(oc)
    con_cotizacion_aprobada(oc, s)
    generar_oc(oc, db, s)
    u = db.get(User, user_id)
    lecturas = [
        lambda: sol.get_solicitud(s.id, current_user=u, db=db, oc_db=oc),
        lambda: sol.get_historial_estados(s.id, current_user=u, db=db, oc_db=oc),
        lambda: documentos.obtener_orden_por_solicitud(s.id, current_user=u, db=db, oc_db=oc),
        lambda: obtener_solicitud_con_acceso(s.id, u, db, oc),  # adjuntos y cotizaciones usan este mismo control
    ]
    for leer in lecturas:
        if permitido:
            leer()
        else:
            with pytest.raises(HTTPException) as e:
                leer()
            assert e.value.status_code == 403


def test_acceso_inexistente_404_y_adjuntos_bloqueados_si_cerrada(oc, db):
    with pytest.raises(HTTPException) as e:
        obtener_solicitud_con_acceso(uuid.uuid4(), db.get(User, 1), db, oc)
    assert e.value.status_code == 404
    s = nueva(oc, EstadoOC.cerrada)
    obtener_solicitud_con_acceso(s.id, db.get(User, 3), db, oc)  # leer sí
    with pytest.raises(HTTPException) as e:
        obtener_solicitud_con_acceso(s.id, db.get(User, 3), db, oc, modifica=True)
    assert e.value.status_code == 409


# ── Gestionar solicitud ───────────────────────────────────────────────────────

def test_gestionar_no_edita_aval_ni_datos_de_factura(oc, db):
    s = nueva(oc, EstadoOC.aprobada, aval_compra="Directora", numero_factura="F-1")
    payload = sol.GestionPayload(plataforma="SAP", aval_compra="Otro", numero_factura="F-9",
                                 observacion_contabilidad="x")
    r = sol.gestionar_solicitud(s.id, payload, current_user=db.get(User, 2), oc_db=oc)
    assert (r.plataforma, r.aval_compra, r.numero_factura, r.observacion_contabilidad) == (
        "SAP", "Directora", "F-1", None)


@pytest.mark.parametrize("estado", [EstadoOC.cerrada, EstadoOC.cancelada])
def test_gestionar_bloqueado_si_cerrada_o_cancelada(oc, db, estado):
    s = nueva(oc, estado)
    with pytest.raises(HTTPException) as e:
        sol.gestionar_solicitud(s.id, sol.GestionPayload(plataforma="SAP"), current_user=db.get(User, 2), oc_db=oc)
    assert e.value.status_code == 409


# ── Transiciones de estado ────────────────────────────────────────────────────

def cambiar(oc, db, s, estado):
    return sol.cambiar_estado(s.id, sol.EstadoPayload(estado=estado), BackgroundTasks(),
                              current_user=db.get(User, 2), oc_db=oc)


def test_flujo_completo_registra_historial(oc, db):
    s = nueva(oc)
    camino = [EstadoOC.en_cotizacion, EstadoOC.pendiente_aprobacion, EstadoOC.aprobada,
              EstadoOC.oc_enviada, EstadoOC.oc_en_plataforma, EstadoOC.cerrada]
    for estado in camino:
        assert cambiar(oc, db, s, estado).estado == estado
    hist = oc.exec(select(HistorialEstado).where(HistorialEstado.solicitud_id == s.id)
                   .order_by(HistorialEstado.fecha)).all()
    assert [h.estado_nuevo for h in hist] == [e.value for e in camino]


@pytest.mark.parametrize("desde, hacia", [
    (EstadoOC.nueva, EstadoOC.aprobada),
    (EstadoOC.en_cotizacion, EstadoOC.oc_enviada),
    (EstadoOC.aprobada, EstadoOC.cerrada),
    (EstadoOC.cerrada, EstadoOC.en_cotizacion),
    (EstadoOC.cancelada, EstadoOC.en_cotizacion),
    (EstadoOC.en_correccion, EstadoOC.aprobada),
])
def test_transiciones_invalidas_responden_422(oc, db, desde, hacia):
    s = nueva(oc, desde)
    with pytest.raises(HTTPException) as e:
        cambiar(oc, db, s, hacia)
    assert e.value.status_code == 422
    oc.refresh(s)
    assert s.estado == desde
