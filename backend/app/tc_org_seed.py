"""Seed organigrama T&C desde jerarquías del prototipo Directorio."""
from __future__ import annotations

from typing import Any, Optional

from sqlmodel import Session, select

from app.personal_database import PtcCargo, PtcCargoSede, get_personal_engine

# ── Árbol corporativo (generalHierarchy) ───────────────────────────────────────

CORPORATIVO: list[dict[str, Any]] = [
    {
        "key": "gg",
        "label": "Gerente General",
        "number": "",
        "children": [
            {
                "key": "fin",
                "label": "Gerente Financiera / Operaciones",
                "number": "1/9",
                "children": [
                    {
                        "key": "fin-cont",
                        "label": "Contadoras",
                        "number": "9.1",
                        "children": [
                            {
                                "key": "fin-anal",
                                "label": "Analista Contable",
                                "number": "9.2",
                                "children": [
                                    {"key": "fin-aux-fact", "label": "Auxiliares de Facturación", "number": "9.3"},
                                ],
                            },
                        ],
                    },
                    {
                        "key": "fin-sup-op",
                        "label": "Supervisor de Operaciones",
                        "number": "1.1",
                        "children": [
                            {
                                "key": "fin-coord-op",
                                "label": "Coordinador de Operaciones",
                                "number": "1.2",
                                "children": [
                                    {"key": "fin-anal-op", "label": "Analista de Operaciones", "number": "1.3"},
                                    {"key": "fin-mont", "label": "Montacarguistas", "number": "1.4"},
                                    {"key": "fin-aux-op", "label": "Auxiliares Operativos", "number": "1.5"},
                                ],
                            },
                        ],
                    },
                    {
                        "key": "fin-sup-trans",
                        "label": "Supervisor de Transportes",
                        "number": "1.1",
                        "children": [
                            {
                                "key": "fin-coord-trans",
                                "label": "Coordinador de Operaciones - Transportes",
                                "number": "1.2",
                                "children": [
                                    {
                                        "key": "fin-asist-trans",
                                        "label": "Asistente Administrativo - Transportes",
                                        "number": "1.3",
                                        "children": [
                                            {"key": "fin-conduct", "label": "Conductores", "number": "1.4"},
                                            {"key": "fin-aux-trans", "label": "Auxiliares de Transporte", "number": "1.5"},
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                "key": "proy",
                "label": "Coordinador de Proyectos y Negocios",
                "number": "2",
                "children": [
                    {"key": "proy-asist", "label": "Asistente de Proyectos y Negocios", "number": "2.1"},
                ],
            },
            {
                "key": "plan",
                "label": "Directora de Planeación y Desarrollo",
                "number": "3",
                "children": [
                    {
                        "key": "plan-innov",
                        "label": "Coordinador de Innovación y Desarrollo",
                        "number": "3.1",
                        "children": [
                            {"key": "plan-aux-innov", "label": "Auxiliar de Innovación y Desarrollo", "number": "3.2"},
                        ],
                    },
                    {"key": "plan-aud", "label": "Auditor", "number": "3.3"},
                    {"key": "plan-sac", "label": "Pasante auxiliar SAC", "number": "3.4"},
                    {
                        "key": "plan-sig",
                        "label": "Coordinador Sistemas de Gestión",
                        "number": "4",
                        "children": [
                            {"key": "plan-aux-sig", "label": "Auxiliar del SIG", "number": "4.1"},
                        ],
                    },
                ],
            },
            {"key": "aud-gg", "label": "Auditor Gerencia General", "number": "5"},
            {
                "key": "seg",
                "label": "Director de Seguridad y Control",
                "number": "10",
                "children": [
                    {
                        "key": "seg-anal",
                        "label": "Analista de control y seguridad",
                        "number": "10.1",
                        "children": [
                            {"key": "seg-aux", "label": "Auxiliar de Control", "number": "10.3"},
                        ],
                    },
                ],
            },
            {
                "key": "th",
                "label": "Directora Administrativa y Talento Humano",
                "number": "6 / 7",
                "children": [
                    {
                        "key": "th-asist",
                        "label": "Asistente Administrativo Talento y Cultura",
                        "number": "6.1",
                        "children": [
                            {"key": "th-pas", "label": "Pasante Talento y Cultura", "number": "6.2"},
                        ],
                    },
                    {"key": "th-compras", "label": "Auxiliar de Compras", "number": "7.1"},
                ],
            },
            {
                "key": "it",
                "label": "Coordinador de IT y Soporte",
                "number": "8",
                "children": [
                    {"key": "it-aux", "label": "Auxiliar de IT y Soporte", "number": "8.1"},
                ],
            },
        ],
    },
]

# IMCC: Gerente General + rama financiera/operativa (companyImccHierarchy)
IMCC_EXTRA: list[dict[str, Any]] = CORPORATIVO[0]["children"][:1]  # solo rama fin bajo GG sede

SEDE_GG_ONLY: list[dict[str, Any]] = [
    {"key": "gg", "label": "Gerente General", "number": "", "children": []},
]


def _upsert_node(
    db: Session,
    *,
    context: str,
    node: dict[str, Any],
    parent_id: Optional[int],
    sede_id: Optional[int],
) -> int:
    key = node["key"]
    existing = db.exec(
        select(PtcCargo).where(
            PtcCargo.org_context == context,
            PtcCargo.org_key == key,
        )
    ).first()

    if existing:
        cargo = existing
        # Reseed restaura estructura/nombre, pero conserva campos visuales editables.
        cargo.nombre = node["label"]
        cargo.parent_id = parent_id
        cargo.en_organigrama = True
    else:
        cargo = PtcCargo(
            nombre=node["label"],
            org_context=context,
            org_key=key,
            org_number=node.get("number") or "",
            parent_id=parent_id,
            en_organigrama=True,
        )
        db.add(cargo)
        db.flush()

    if sede_id is not None:
        link = db.exec(
            select(PtcCargoSede).where(
                PtcCargoSede.cargo_id == cargo.id,
                PtcCargoSede.sede_id == sede_id,
            )
        ).first()
        if not link:
            db.add(PtcCargoSede(cargo_id=cargo.id, sede_id=sede_id))

    for child in node.get("children") or []:
        _upsert_node(db, context=context, node=child, parent_id=cargo.id, sede_id=sede_id)

    return cargo.id


def _walk_forest(
    db: Session,
    nodes: list[dict[str, Any]],
    context: str,
    sede_id: Optional[int],
) -> None:
    for node in nodes:
        _upsert_node(db, context=context, node=node, parent_id=None, sede_id=sede_id)


def seed_organigrama_if_needed(main_db: Session) -> None:
    from sqlalchemy import text

    from app.models.sede import Sede

    engine = get_personal_engine()
    with engine.connect() as conn:
        if conn.execute(text("SELECT value FROM ptc_config WHERE key='organigrama_seed_v2'")).first():
            return

    with Session(engine) as db:
        _walk_forest(db, CORPORATIVO, "corporativo", None)

        # Antes esto resolvía solo 3 "slots" (logi/imcc/imde) por palabra clave en
        # el nombre — si dos sedes coincidían con la misma palabra (LOGIMAT y
        # LOGIMAT 2) la segunda se perdía en silencio, y una sede que no coincidía
        # con ninguna palabra (Transversal) nunca recibía organigrama. Ahora se
        # recorren TODAS las sedes reales, cada una con su propio nodo — la única
        # que recibe el árbol completo es la que coincide con "IMCC".
        for s in main_db.exec(select(Sede)).all():
            es_imcc = "IMCC" in (s.name or "").upper()
            tree = (
                [{"key": "gg", "label": "Gerente General", "number": "", "children": list(IMCC_EXTRA)}]
                if es_imcc
                else SEDE_GG_ONLY
            )
            _walk_forest(db, tree, f"sede:{s.id}", s.id)

        db.commit()

    with engine.connect() as conn:
        conn.execute(text(
            "INSERT OR REPLACE INTO ptc_config (key, value) VALUES ('organigrama_seed_v2', 'done')"
        ))
        conn.commit()
