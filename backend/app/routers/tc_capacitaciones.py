"""
Router T&C — Gestión gerencial de capacitaciones.

Prefijo: /tc  (montado junto a personal.py)
Endpoints propios:
  GET    /tc/capacitaciones                              — lista global con filtros
  GET    /tc/capacitaciones/stats                        — KPIs globales
  POST   /tc/capacitaciones/bulk                         — enrolar múltiples personas
  PATCH  /tc/capacitaciones/{cap_id}/completar           — marcar completada
  PATCH  /tc/capacitaciones/{cap_id}/documentos          — vincular URLs de documentos
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import Session, col, func, select

from app.core.deps import get_current_user, require_permission
from app.models.user import User
from app.personal_database import (
    PtcArea,
    PtcCapacitacion,
    PtcCargo,
    PtcPersona,
    get_personal_engine,
)

router = APIRouter(prefix="/tc", tags=["T&C Capacitaciones"])

require_tc        = require_permission("mod_tc")
require_tc_editar = require_permission("mod_tc_editar")


# ── Schemas ──────────────────────────────────────────────────────────────────

class BulkCapacitacionBody(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    fecha: Optional[date] = None
    horas: Optional[float] = Field(default=None, ge=0)
    observaciones: str = Field(default="", max_length=500)
    persona_ids: list[int] = Field(min_length=1, max_length=300)


class CompletarBody(BaseModel):
    score: Optional[float] = Field(default=None, ge=0, le=100)
    diploma_url: Optional[str] = Field(default=None, max_length=500)


class DocLink(BaseModel):
    nombre: str = Field(max_length=200)
    url: str = Field(max_length=1000)


class DocumentosBody(BaseModel):
    documentos: list[DocLink] = []


# ── Helper ────────────────────────────────────────────────────────────────────

def _enrich(cap: PtcCapacitacion, db: Session) -> dict:
    """Devuelve la capacitación con datos de persona, cargo y área."""
    persona = db.get(PtcPersona, cap.persona_id)
    cargo_nombre = ""
    area_nombre = ""
    sede_id = 0
    if persona:
        sede_id = persona.sede_id or 0
        if persona.cargo_id:
            cargo = db.get(PtcCargo, persona.cargo_id)
            cargo_nombre = cargo.nombre if cargo else ""
        if persona.area_id:
            area = db.get(PtcArea, persona.area_id)
            area_nombre = area.nombre if area else ""
    try:
        docs = json.loads(cap.documentos or "[]")
    except Exception:
        docs = []
    return {
        "id":             cap.id,
        "titulo":         cap.titulo,
        "fecha":          cap.fecha.isoformat() if cap.fecha else None,
        "horas":          cap.horas,
        "estado":         cap.estado,
        "observaciones":  cap.observaciones,
        "diploma_url":    cap.diploma_url,
        "documentos":     docs,
        "persona_id":     cap.persona_id,
        "persona_nombre": persona.nombre if persona else "",
        "cargo_nombre":   cargo_nombre,
        "area_nombre":    area_nombre,
        "sede_id":        sede_id,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/capacitaciones/stats")
def stats_capacitaciones(_: User = Depends(require_tc)):
    with Session(get_personal_engine()) as db:
        total       = db.exec(select(func.count(PtcCapacitacion.id))).one() or 0
        completadas = db.exec(
            select(func.count(PtcCapacitacion.id)).where(PtcCapacitacion.estado == "Completado")
        ).one() or 0
        horas_total = db.exec(
            select(func.sum(PtcCapacitacion.horas)).where(col(PtcCapacitacion.horas).isnot(None))
        ).one() or 0
        personas_cap = db.exec(
            select(func.count(func.distinct(PtcCapacitacion.persona_id)))
        ).one() or 0
        activos = db.exec(
            select(func.count(PtcPersona.id)).where(PtcPersona.estado == "Activo")
        ).one() or 1

    return {
        "total":               total,
        "completadas":         completadas,
        "completacion_pct":    round((completadas / max(total, 1)) * 100, 1),
        "horas_promedio":      round(float(horas_total) / max(activos, 1), 1),
        "personas_capacitadas": personas_cap,
        "cobertura_pct":       round((personas_cap / max(activos, 1)) * 100, 1),
    }


@router.get("/capacitaciones")
def listar_capacitaciones_global(
    area_id:      Optional[int]  = Query(default=None),
    sede_id:      Optional[int]  = Query(default=None),
    estado:       Optional[str]  = Query(default=None),
    fecha_desde:  Optional[date] = Query(default=None),
    fecha_hasta:  Optional[date] = Query(default=None),
    _: User = Depends(require_tc),
):
    with Session(get_personal_engine()) as db:
        q = select(PtcCapacitacion).order_by(col(PtcCapacitacion.created_at).desc())

        if estado:
            q = q.where(PtcCapacitacion.estado == estado)
        if fecha_desde:
            q = q.where(PtcCapacitacion.fecha >= fecha_desde)
        if fecha_hasta:
            q = q.where(PtcCapacitacion.fecha <= fecha_hasta)

        caps = db.exec(q).all()

        # Filtros por persona (area_id / sede_id) se aplican post-query
        result = []
        for cap in caps:
            persona = db.get(PtcPersona, cap.persona_id)
            if not persona:
                continue
            if area_id is not None and persona.area_id != area_id:
                continue
            if sede_id is not None and persona.sede_id != sede_id:
                continue
            result.append(_enrich(cap, db))

        return result


@router.post("/capacitaciones/bulk", status_code=status.HTTP_201_CREATED)
def enrolar_masivo(
    body: BulkCapacitacionBody,
    _: User = Depends(require_tc_editar),
):
    creadas = []
    with Session(get_personal_engine()) as db:
        # Verificar que las personas existen
        personas = db.exec(
            select(PtcPersona).where(col(PtcPersona.id).in_(body.persona_ids))
        ).all()
        ids_validos = {p.id for p in personas}

        for pid in body.persona_ids:
            if pid not in ids_validos:
                continue
            cap = PtcCapacitacion(
                persona_id=pid,
                titulo=body.titulo,
                fecha=body.fecha,
                horas=body.horas,
                estado="Pendiente",
                observaciones=body.observaciones,
            )
            db.add(cap)
            db.flush()
            creadas.append(cap.id)

        db.commit()

    return {"creadas": len(creadas), "ids": creadas}


@router.patch("/capacitaciones/{cap_id}/completar")
def completar_capacitacion(
    cap_id: int,
    body: CompletarBody,
    _: User = Depends(require_tc_editar),
):
    with Session(get_personal_engine()) as db:
        cap = db.get(PtcCapacitacion, cap_id)
        if not cap:
            raise HTTPException(status_code=404, detail="Capacitación no encontrada")

        cap.estado = "Completado"

        obs_parts = [cap.observaciones] if cap.observaciones else []
        if body.score is not None:
            obs_parts.append(f"Score: {body.score}/100")
        if obs_parts:
            cap.observaciones = " | ".join(obs_parts)

        if body.diploma_url:
            cap.diploma_url = body.diploma_url

        db.add(cap)
        db.commit()
        db.refresh(cap)

        return _enrich(cap, db)


@router.patch("/capacitaciones/{cap_id}/documentos")
def actualizar_documentos(
    cap_id: int,
    body: DocumentosBody,
    _: User = Depends(require_tc_editar),
):
    with Session(get_personal_engine()) as db:
        cap = db.get(PtcCapacitacion, cap_id)
        if not cap:
            raise HTTPException(status_code=404, detail="Capacitación no encontrada")
        cap.documentos = json.dumps([d.model_dump() for d in body.documentos], ensure_ascii=False)
        db.add(cap)
        db.commit()
        db.refresh(cap)
        return _enrich(cap, db)
