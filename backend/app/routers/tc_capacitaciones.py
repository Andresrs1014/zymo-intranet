"""
Router T&C — Gestión gerencial de capacitaciones.

Prefijo: /tc  (montado junto a personal.py)
Endpoints propios:
  GET    /tc/capacitaciones                              — lista global con filtros
  GET    /tc/capacitaciones/stats                        — KPIs globales
  GET    /tc/capacitaciones/exportar                      — Excel (mismos filtros que la lista)
  POST   /tc/capacitaciones/bulk                         — enrolar múltiples personas
  PATCH  /tc/capacitaciones/{cap_id}/completar           — marcar completada
  PATCH  /tc/capacitaciones/{cap_id}/documentos          — vincular URLs de documentos
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
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
    tipo: str = Field(default="Interna")
    costo: Optional[float] = Field(default=None, ge=0)
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
        "tipo":           cap.tipo,
        "costo":          cap.costo,
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


def _filtrar_capacitaciones(
    db: Session,
    area_id: Optional[int],
    sede_id: Optional[int],
    estado: Optional[str],
    tipo: Optional[str],
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
) -> list[dict]:
    q = select(PtcCapacitacion).order_by(col(PtcCapacitacion.created_at).desc())

    if estado:
        q = q.where(PtcCapacitacion.estado == estado)
    if tipo:
        q = q.where(PtcCapacitacion.tipo == tipo)
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


@router.get("/capacitaciones")
def listar_capacitaciones_global(
    area_id:      Optional[int]  = Query(default=None),
    sede_id:      Optional[int]  = Query(default=None),
    estado:       Optional[str]  = Query(default=None),
    tipo:         Optional[str]  = Query(default=None, description="Interna | Externa"),
    fecha_desde:  Optional[date] = Query(default=None),
    fecha_hasta:  Optional[date] = Query(default=None),
    _: User = Depends(require_tc),
):
    with Session(get_personal_engine()) as db:
        return _filtrar_capacitaciones(db, area_id, sede_id, estado, tipo, fecha_desde, fecha_hasta)


@router.get("/capacitaciones/exportar")
def exportar_capacitaciones(
    area_id:      Optional[int]  = Query(default=None),
    sede_id:      Optional[int]  = Query(default=None),
    estado:       Optional[str]  = Query(default=None),
    tipo:         Optional[str]  = Query(default=None),
    fecha_desde:  Optional[date] = Query(default=None),
    fecha_hasta:  Optional[date] = Query(default=None),
    _: User = Depends(require_tc),
):
    """Excel simple (una hoja, encabezado + filas) con las mismas columnas y
    el mismo filtro que la tabla en pantalla — pedido explícito del usuario:
    'no tiene que ser muy complicado'."""
    import io

    import openpyxl

    with Session(get_personal_engine()) as db:
        filas = _filtrar_capacitaciones(db, area_id, sede_id, estado, tipo, fecha_desde, fecha_hasta)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Capacitaciones"

    encabezados = ["Título", "Persona", "Cargo", "Área", "Fecha", "Horas", "Tipo", "Costo", "Estado", "Observaciones"]
    ws.append(encabezados)
    for f in filas:
        ws.append([
            f["titulo"], f["persona_nombre"], f["cargo_nombre"], f["area_nombre"],
            f["fecha"] or "", f["horas"] or "", f["tipo"], f["costo"] or "",
            f["estado"], f["observaciones"],
        ])
    for col, width in zip("ABCDEFGHIJ", [35, 28, 28, 18, 12, 8, 10, 12, 14, 40]):
        ws.column_dimensions[col].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="capacitaciones.xlsx"'},
    )


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
                tipo=body.tipo,
                costo=body.costo,
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
