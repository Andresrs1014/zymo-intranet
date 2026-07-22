"""
Router T&C — Gestión gerencial de capacitaciones.

Prefijo: /tc  (montado junto a personal.py y tc_agenda.py)
Endpoints propios:
  GET    /tc/capacitaciones                              — lista global con filtros
  GET    /tc/capacitaciones/stats                        — KPIs globales
  POST   /tc/capacitaciones/bulk                         — enrolar múltiples personas
  PATCH  /tc/capacitaciones/{cap_id}/completar           — marcar completada
  PATCH  /tc/capacitaciones/{cap_id}/documentos          — vincular URLs de documentos
  POST   /tc/eventos/{evento_id}/generar-capacitaciones  — puente evento→capacitación
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
    PtcEvento,
    PtcEventoPersona,
    PtcPersona,
    get_personal_engine,
)

router = APIRouter(prefix="/tc", tags=["T&C Capacitaciones"])

require_tc        = require_permission("mod_tc")
require_tc_editar = require_permission("mod_tc_editar")

_TIPOS_CAPACITABLES = {"induccion", "curso"}


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


@router.post("/eventos/{evento_id}/generar-capacitaciones", status_code=status.HTTP_201_CREATED)
def generar_capacitaciones_desde_evento(
    evento_id: int,
    body: DocumentosBody = None,
    _: User = Depends(require_tc_editar),
):
    """
    Genera registros de capacitación para todos los asistentes de un evento
    de tipo 'curso' o 'induccion'. Idempotente: no crea duplicados.
    """
    with Session(get_personal_engine()) as db:
        evento = db.get(PtcEvento, evento_id)
        if not evento:
            raise HTTPException(status_code=404, detail="Evento no encontrado")

        if evento.tipo not in _TIPOS_CAPACITABLES:
            raise HTTPException(
                status_code=400,
                detail=f"Solo eventos de tipo {_TIPOS_CAPACITABLES} generan capacitaciones. "
                       f"Este evento es de tipo '{evento.tipo}'.",
            )

        asistentes = db.exec(
            select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
        ).all()

        if not asistentes:
            return {"capacitaciones_creadas": 0, "personas_ya_registradas": 0,
                    "personas_sin_marcar": 0, "evento_titulo": evento.titulo}

        # Horas desde la duración real del evento (PtcEvento no tiene
        # fecha_inicio/fecha_fin — solo fecha + hora_inicio/hora_fin "HH:MM").
        fecha_cap = evento.fecha
        try:
            h_ini = datetime.strptime(evento.hora_inicio, "%H:%M")
            h_fin = datetime.strptime(evento.hora_fin, "%H:%M")
            horas: Optional[float] = round((h_fin - h_ini).total_seconds() / 3600, 1)
        except ValueError:
            horas = None

        titulo = evento.titulo

        # Solo se genera registro para quien ya tiene asistencia marcada —
        # sin esto, alguien marcado "No asistió" (o sin marcar aún) quedaba
        # igual como "Completado" en su perfil (bug reportado 2026-07-21).
        ya_registradas = 0
        creadas = 0
        sin_marcar = 0

        for asistente in asistentes:
            if asistente.asistio is None:
                sin_marcar += 1
                continue

            existente = db.exec(
                select(PtcCapacitacion).where(
                    PtcCapacitacion.persona_id == asistente.persona_id,
                    PtcCapacitacion.titulo == titulo,
                    PtcCapacitacion.fecha == fecha_cap,
                )
            ).first()

            if existente:
                ya_registradas += 1
                continue

            docs_json = json.dumps(
                [d.model_dump() for d in body.documentos] if body and body.documentos else [],
                ensure_ascii=False,
            )
            obs = f"Generado automáticamente desde evento #{evento_id}"
            if not asistente.asistio and asistente.motivo_inasistencia:
                obs += f" — motivo: {asistente.motivo_inasistencia}"
            cap = PtcCapacitacion(
                persona_id=asistente.persona_id,
                titulo=titulo,
                fecha=fecha_cap,
                horas=horas if asistente.asistio else None,
                estado="Completado" if asistente.asistio else "No asistió",
                observaciones=obs,
                documentos=docs_json,
            )
            db.add(cap)
            creadas += 1

        db.commit()

    return {
        "capacitaciones_creadas": creadas,
        "personas_ya_registradas": ya_registradas,
        "personas_sin_marcar": sin_marcar,
        "evento_titulo": titulo,
    }
