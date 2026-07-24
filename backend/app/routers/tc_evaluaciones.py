"""
Router T&C — Formato digital "Evaluación de desempeño".

Prefijo API: /tc/evaluaciones-desempeno (deliberadamente distinto del prefijo
de la página frontend /tc/evaluaciones, mismo gotcha de siempre con la regex
de nginx).

Permiso propio `mod_tc_evaluaciones` — independiente de mod_tc/mod_tc_editar,
mismo patrón que mod_tc_agenda: el líder de un área evalúa a su gente sin
necesitar acceso al resto de T&C.

Hay dos rúbricas (operativo/líderes, ver frontend/src/lib/
evaluacionDesempenoRubricas.ts) con el mismo esquema de 6 competencias
ponderadas 20/20/20/20/10/10 — la única diferencia es el texto de las
preguntas. Cuál rúbrica aplica NO lo elige el evaluador a mano: se resuelve
solo mirando si la persona evaluada tiene gente a cargo (aparece como
jefe_directo_id de alguien activo) — igual definición que usa T&C en el
correo original ("líderes... o con personal a cargo").
"""
from __future__ import annotations

import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import require_permission
from app.database import get_db
from app.models.area import Area as GlobalArea
from app.models.sede import Sede
from app.models.user import User
from app.personal_database import (
    PtcCargo,
    PtcEvaluacion,
    PtcEvaluacionDesempeno,
    PtcPersona,
    get_personal_db,
)

router = APIRouter(prefix="/tc/evaluaciones-desempeno", tags=["T&C Evaluación de desempeño"])

require_tc_evaluaciones = require_permission("mod_tc_evaluaciones")

# Bandas de resultado — idénticas en ambas rúbricas (ver xlsm "RESULTADOS").
_BANDAS = [
    (4.1, "Sobresaliente"),
    (3.53, "Satisfactorio"),
    (2.53, "Necesita Mejorar"),
    (1.53, "Bajo"),
    (0.0, "No satisfactorio"),
]


def _resultado_de(puntaje: float) -> str:
    for minimo, nombre in _BANDAS:
        if puntaje >= minimo:
            return nombre
    return "No satisfactorio"


def _resolver_perfil_evaluador(user: User, db: Session) -> PtcPersona:
    persona = db.exec(select(PtcPersona).where(PtcPersona.user_id == user.id)).first()
    if not persona:
        raise HTTPException(400, "Tu usuario no tiene un perfil de colaborador vinculado en T&C — no se puede registrar quién evalúa.")
    return persona


def _es_lider(persona_id: int, db: Session) -> bool:
    """Definición de T&C: líder = tiene personal a cargo (aparece como
    jefe_directo_id de alguien activo)."""
    return db.exec(
        select(PtcPersona).where(PtcPersona.jefe_directo_id == persona_id, PtcPersona.estado == "Activo")
    ).first() is not None


# ── Personas (lectura liviana, sin depender de mod_tc) ────────────────────────

@router.get("/personas-lista")
def listar_personas(
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_evaluaciones),
):
    personas = db.exec(select(PtcPersona).where(PtcPersona.estado == "Activo")).all()
    result = []
    for p in personas:
        sede = main_db.get(Sede, p.sede_id) if p.sede_id else None
        area = main_db.get(GlobalArea, p.area_id) if p.area_id else None
        cargo = db.get(PtcCargo, p.cargo_id) if p.cargo_id else None
        result.append({
            "id": p.id,
            "nombre": p.nombre,
            "documento": p.documento,
            "empresa_nombre": sede.name if sede else "",
            "area_nombre": area.name if area else "",
            "cargo_nombre": cargo.nombre if cargo else "",
        })
    return result


@router.get("/persona/{persona_id}")
def obtener_persona(
    persona_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_evaluaciones),
):
    persona = db.get(PtcPersona, persona_id)
    if not persona:
        raise HTTPException(404, "Persona no encontrada.")
    sede = main_db.get(Sede, persona.sede_id) if persona.sede_id else None
    area = main_db.get(GlobalArea, persona.area_id) if persona.area_id else None
    cargo = db.get(PtcCargo, persona.cargo_id) if persona.cargo_id else None
    return {
        "id": persona.id,
        "nombre": persona.nombre,
        "cargo_nombre": cargo.nombre if cargo else "",
        "area_nombre": area.name if area else "",
        "empresa_nombre": sede.name if sede else "",
        "firma_url": persona.firma_url,
        "tipo": "lideres" if _es_lider(persona.id, db) else "operativo",
    }


# ── Envío de la evaluación ────────────────────────────────────────────────────

class CategoriaItemSubmit(BaseModel):
    texto: str
    valor: int  # 1-5


class CategoriaSubmit(BaseModel):
    nombre: str
    peso: float
    items: list[CategoriaItemSubmit]


class EvaluacionSubmit(BaseModel):
    persona_id: int
    tipo: str  # "operativo" | "lideres" — se revalida server-side
    periodo: str
    anio: int
    categorias: list[CategoriaSubmit]
    accion_mejora: str = ""
    observaciones_lider: str = ""
    observaciones_liderado: str = ""


@router.post("", status_code=201)
def enviar_evaluacion(
    body: EvaluacionSubmit,
    db: Session = Depends(get_personal_db),
    user: User = Depends(require_tc_evaluaciones),
):
    evaluador = _resolver_perfil_evaluador(user, db)
    evaluado = db.get(PtcPersona, body.persona_id)
    if not evaluado:
        raise HTTPException(404, "Persona a evaluar no encontrada.")
    if not evaluador.firma_url:
        raise HTTPException(400, "Tu perfil de T&C no tiene firma digital registrada — agrégala antes de evaluar.")
    if not evaluado.firma_url:
        raise HTTPException(400, f"{evaluado.nombre} no tiene firma digital registrada en su perfil — no se puede completar la evaluación.")
    if not body.categorias:
        raise HTTPException(400, "Faltan las competencias evaluadas.")
    if not body.observaciones_lider.strip() or not body.observaciones_liderado.strip():
        raise HTTPException(400, "Las observaciones del líder y del liderado son obligatorias — de lo contrario la evaluación no se tiene en cuenta.")

    tipo_real = "lideres" if _es_lider(evaluado.id, db) else "operativo"

    categorias_calc = []
    puntaje_total = 0.0
    for cat in body.categorias:
        if not cat.items:
            raise HTTPException(400, f"La competencia '{cat.nombre}' no tiene ítems calificados.")
        for it in cat.items:
            if it.valor < 1 or it.valor > 5:
                raise HTTPException(400, f"Valor inválido ({it.valor}) en '{cat.nombre}'.")
        puntaje_cat = sum(it.valor for it in cat.items) / len(cat.items)
        total_cat = puntaje_cat * cat.peso
        puntaje_total += total_cat
        categorias_calc.append({
            "nombre": cat.nombre, "peso": cat.peso,
            "puntaje": round(puntaje_cat, 2), "total": round(total_cat, 3),
        })

    resultado = _resultado_de(puntaje_total)

    if resultado in ("Necesita Mejorar", "Bajo", "No satisfactorio") and not body.accion_mejora.strip():
        raise HTTPException(400, f'Resultado "{resultado}" — la acción de mejora es obligatoria.')

    respuestas = [
        {"categoria": cat.nombre, "texto": it.texto, "valor": it.valor}
        for cat in body.categorias for it in cat.items
    ]

    detalle = PtcEvaluacionDesempeno(
        persona_id=evaluado.id,
        evaluador_persona_id=evaluador.id,
        tipo=tipo_real,
        periodo=body.periodo,
        anio=body.anio,
        respuestas=json.dumps(respuestas, ensure_ascii=False),
        categorias=json.dumps(categorias_calc, ensure_ascii=False),
        puntaje_total=round(puntaje_total, 3),
        resultado=resultado,
        accion_mejora=body.accion_mejora.strip(),
        observaciones_lider=body.observaciones_lider.strip(),
        observaciones_liderado=body.observaciones_liderado.strip(),
        firma_lider_url=evaluador.firma_url,
        firma_liderado_url=evaluado.firma_url,
    )
    db.add(detalle)

    resumen = PtcEvaluacion(
        persona_id=evaluado.id,
        titulo=f"Evaluación de desempeño — {body.periodo} {body.anio}",
        puntaje=round(puntaje_total, 2),
        cumple_meta=resultado in ("Sobresaliente", "Satisfactorio"),
        fecha=date.today(),
        observaciones=f"Resultado: {resultado}." + (f" Acción de mejora: {body.accion_mejora.strip()}" if body.accion_mejora.strip() else ""),
        origen=f"formato:evaluacion_{tipo_real}",
    )
    db.add(resumen)
    db.commit()
    db.refresh(detalle)
    return {"id": detalle.id, "puntaje_total": detalle.puntaje_total, "resultado": detalle.resultado}
