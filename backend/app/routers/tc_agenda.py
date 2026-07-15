"""
Router T&C — Agenda / Eventos (capacitaciones, cursos, reuniones).

Prefijo: /tc  (montado junto a personal.py)
"""
from __future__ import annotations

import os
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.core.deps import get_current_user, require_permission
from app.models.area import Area as GlobalArea
from app.models.user import User
from app.personal_database import (
    PtcAreaConfig,
    PtcEvento,
    PtcEventoDocumento,
    PtcEventoPersona,
    PtcOrdenDia,
    PtcPersona,
    get_personal_db,
)
from app.database import get_db
from app.services.tc_whatsapp import (
    build_generic_message,
    build_induccion_message,
    send_whatsapp,
)
from app.services.tc_email import build_evento_email, send_email
from app.personal_database import PtcSmtpConfig

router = APIRouter(prefix="/tc", tags=["T&C Agenda"])

require_tc          = require_permission("mod_tc")
require_tc_editar   = require_permission("mod_tc_editar")
require_tc_sensible = require_permission("mod_tc_sensible")

_TIPOS_EVENTO = {"induccion", "curso", "reunion", "otro"}
_ESTADOS_EVENTO = {"Programado", "En curso", "Completado", "Cancelado"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class EventoCreate(BaseModel):
    titulo: str
    tipo: str = "induccion"
    fecha: str          # "YYYY-MM-DD"
    hora_inicio: str = "08:00"
    hora_fin: str = "09:00"
    lugar: str = ""
    descripcion: str = ""
    area_id: Optional[int] = None
    persona_ids: list[int] = []


class EventoUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo: Optional[str] = None
    fecha: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    lugar: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None
    area_id: Optional[int] = None


class OrdenDiaItem(BaseModel):
    orden: int = 1
    titulo: str
    descripcion: str = ""
    responsable_nombre: str = ""
    area_id: Optional[int] = None
    duracion_min: int = 30


class AsistenciaUpdate(BaseModel):
    persona_id: int
    asistio: Optional[bool] = None
    evaluacion_puntaje: Optional[float] = None


class AreaConfigUpsert(BaseModel):
    area_id: int
    lider_nombre: str = ""
    lider_telefono: str = ""
    lider_email: str = ""
    activa: bool = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Fecha inválida: {s}")


def _evento_dict(ev: PtcEvento, db: Session, main_db: Session) -> dict:
    personas = db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == ev.id)
    ).all()
    orden = db.exec(
        select(PtcOrdenDia)
        .where(PtcOrdenDia.evento_id == ev.id)
        .order_by(PtcOrdenDia.orden)
    ).all()
    docs = db.exec(
        select(PtcEventoDocumento).where(PtcEventoDocumento.evento_id == ev.id)
    ).all()
    area = main_db.get(GlobalArea, ev.area_id) if ev.area_id else None
    return {
        "id": ev.id,
        "titulo": ev.titulo,
        "tipo": ev.tipo,
        "fecha": ev.fecha.isoformat() if ev.fecha else None,
        "hora_inicio": ev.hora_inicio,
        "hora_fin": ev.hora_fin,
        "lugar": ev.lugar,
        "descripcion": ev.descripcion,
        "estado": ev.estado,
        "area_id": ev.area_id,
        "area_nombre": area.name if area else "",
        "notificacion_enviada": ev.notificacion_enviada,
        "total_personas": len(personas),
        "personas": [
            {"persona_id": p.persona_id, "asistio": p.asistio, "evaluacion_puntaje": p.evaluacion_puntaje}
            for p in personas
        ],
        "orden_dia": [
            {
                "id": o.id, "orden": o.orden, "titulo": o.titulo,
                "descripcion": o.descripcion, "responsable_nombre": o.responsable_nombre,
                "area_id": o.area_id, "duracion_min": o.duracion_min,
            }
            for o in orden
        ],
        "documentos": [
            {"id": d.id, "nombre": d.nombre, "url": d.url, "tipo": d.tipo}
            for d in docs
        ],
        "created_at": ev.created_at.isoformat(),
    }


# ── Area Config ───────────────────────────────────────────────────────────────

@router.get("/area-config")
def listar_area_config(
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    configs = db.exec(select(PtcAreaConfig)).all()
    result = []
    for c in configs:
        area = main_db.get(GlobalArea, c.area_id)
        result.append({
            "id": c.id, "area_id": c.area_id,
            "area_nombre": area.name if area else str(c.area_id),
            "lider_nombre": c.lider_nombre,
            "lider_telefono": c.lider_telefono,
            "lider_email": c.lider_email,
            "activa": c.activa,
        })
    return result


@router.put("/area-config")
def upsert_area_config(
    body: AreaConfigUpsert,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    existing = db.exec(
        select(PtcAreaConfig).where(PtcAreaConfig.area_id == body.area_id)
    ).first()
    if existing:
        existing.lider_nombre = body.lider_nombre
        existing.lider_telefono = body.lider_telefono
        existing.lider_email = body.lider_email
        existing.activa = body.activa
        existing.updated_at = datetime.utcnow()
        db.add(existing)
    else:
        db.add(PtcAreaConfig(
            area_id=body.area_id,
            lider_nombre=body.lider_nombre,
            lider_telefono=body.lider_telefono,
            lider_email=body.lider_email,
            activa=body.activa,
        ))
    db.commit()
    return {"ok": True}


# ── Eventos CRUD ──────────────────────────────────────────────────────────────

@router.get("/eventos")
def listar_eventos(
    mes: Optional[str] = Query(None, description="YYYY-MM — filtra por mes"),
    tipo: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    stmt = select(PtcEvento)
    if tipo:
        stmt = stmt.where(PtcEvento.tipo == tipo)
    if estado:
        stmt = stmt.where(PtcEvento.estado == estado)
    eventos = db.exec(stmt.order_by(PtcEvento.fecha)).all()

    if mes:
        try:
            y, m = int(mes[:4]), int(mes[5:7])
            eventos = [e for e in eventos if e.fecha.year == y and e.fecha.month == m]
        except Exception:
            pass

    return [_evento_dict(e, db, main_db) for e in eventos]


@router.post("/eventos", status_code=201)
def crear_evento(
    body: EventoCreate,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_editar),
):
    if body.tipo not in _TIPOS_EVENTO:
        raise HTTPException(400, f"tipo debe ser uno de: {_TIPOS_EVENTO}")
    ev = PtcEvento(
        titulo=body.titulo,
        tipo=body.tipo,
        fecha=_parse_date(body.fecha),
        hora_inicio=body.hora_inicio,
        hora_fin=body.hora_fin,
        lugar=body.lugar,
        descripcion=body.descripcion,
        area_id=body.area_id,
    )
    db.add(ev)
    db.flush()
    for pid in body.persona_ids:
        db.add(PtcEventoPersona(evento_id=ev.id, persona_id=pid))
    db.commit()
    db.refresh(ev)
    return _evento_dict(ev, db, main_db)


@router.get("/eventos/{evento_id}")
def get_evento(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    return _evento_dict(ev, db, main_db)


@router.put("/eventos/{evento_id}")
def actualizar_evento(
    evento_id: int,
    body: EventoUpdate,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    data = body.model_dump(exclude_none=True)
    if "fecha" in data:
        data["fecha"] = _parse_date(data["fecha"])
    if "estado" in data and data["estado"] not in _ESTADOS_EVENTO:
        raise HTTPException(400, f"estado inválido: {data['estado']}")
    for k, v in data.items():
        setattr(ev, k, v)
    ev.updated_at = datetime.utcnow()
    db.add(ev)
    db.commit()
    return _evento_dict(ev, db, main_db)


@router.delete("/eventos/{evento_id}", status_code=204)
def eliminar_evento(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404)
    for m in db.exec(select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)).all():
        db.delete(m)
    for o in db.exec(select(PtcOrdenDia).where(PtcOrdenDia.evento_id == evento_id)).all():
        db.delete(o)
    for d in db.exec(select(PtcEventoDocumento).where(PtcEventoDocumento.evento_id == evento_id)).all():
        db.delete(d)
    db.delete(ev)
    db.commit()


# ── Personas del evento ───────────────────────────────────────────────────────

@router.put("/eventos/{evento_id}/personas")
def set_personas_evento(
    evento_id: int,
    persona_ids: list[int],
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404)
    existing = db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
    ).all()
    existing_ids = {e.persona_id for e in existing}
    new_ids = set(persona_ids)
    for p in existing:
        if p.persona_id not in new_ids:
            db.delete(p)
    for pid in new_ids - existing_ids:
        db.add(PtcEventoPersona(evento_id=evento_id, persona_id=pid))
    db.commit()
    return {"ok": True, "total": len(new_ids)}


@router.patch("/eventos/{evento_id}/asistencia")
def registrar_asistencia(
    evento_id: int,
    body: AsistenciaUpdate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    ep = db.exec(
        select(PtcEventoPersona).where(
            PtcEventoPersona.evento_id == evento_id,
            PtcEventoPersona.persona_id == body.persona_id,
        )
    ).first()
    if not ep:
        raise HTTPException(404, "Persona no asignada a este evento")
    if body.asistio is not None:
        ep.asistio = body.asistio
    if body.evaluacion_puntaje is not None:
        ep.evaluacion_puntaje = body.evaluacion_puntaje
    db.add(ep)
    db.commit()
    return {"ok": True}


# ── Orden del día ─────────────────────────────────────────────────────────────

@router.put("/eventos/{evento_id}/orden-dia")
def set_orden_dia(
    evento_id: int,
    items: list[OrdenDiaItem],
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404)
    for old in db.exec(select(PtcOrdenDia).where(PtcOrdenDia.evento_id == evento_id)).all():
        db.delete(old)
    for item in items:
        db.add(PtcOrdenDia(
            evento_id=evento_id,
            orden=item.orden,
            titulo=item.titulo,
            descripcion=item.descripcion,
            responsable_nombre=item.responsable_nombre,
            area_id=item.area_id,
            duracion_min=item.duracion_min,
        ))
    db.commit()
    return {"ok": True, "items": len(items)}


# ── Documentos ────────────────────────────────────────────────────────────────

@router.post("/eventos/{evento_id}/documentos")
async def subir_documento(
    evento_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404)

    docs_dir = os.path.join(settings.tc_docs_dir, str(evento_id))
    os.makedirs(docs_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(docs_dir, fname)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    tipo = ext.lstrip(".")
    url = f"/tc-docs/{evento_id}/{fname}"
    doc = PtcEventoDocumento(
        evento_id=evento_id,
        nombre=file.filename or fname,
        url=url,
        tipo=tipo,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "nombre": doc.nombre, "url": doc.url, "tipo": doc.tipo}


@router.delete("/eventos/{evento_id}/documentos/{doc_id}", status_code=204)
def eliminar_documento(
    evento_id: int,
    doc_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    doc = db.get(PtcEventoDocumento, doc_id)
    if not doc or doc.evento_id != evento_id:
        raise HTTPException(404)
    db.delete(doc)
    db.commit()


# ── Notificación WhatsApp ─────────────────────────────────────────────────────

@router.post("/eventos/{evento_id}/notificar")
def notificar_evento(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404)

    config = db.exec(
        select(PtcAreaConfig).where(PtcAreaConfig.area_id == ev.area_id)
    ).first() if ev.area_id else None

    if not config or not config.lider_telefono:
        raise HTTPException(400, "El área no tiene líder con teléfono configurado")

    # Construir lista de participantes
    personas_ids = [
        p.persona_id for p in db.exec(
            select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
        ).all()
    ]
    nombres = []
    for pid in personas_ids[:10]:
        p = db.get(PtcPersona, pid)
        if p:
            nombres.append(p.nombre)

    fecha_fmt = ev.fecha.strftime("%d/%m/%Y") if ev.fecha else ""

    if ev.tipo == "induccion":
        msg = build_induccion_message(
            lider_nombre=config.lider_nombre or "Estimado/a",
            fecha=fecha_fmt,
            hora=ev.hora_inicio,
            evento_titulo=ev.titulo,
            personas=nombres,
            lugar=ev.lugar,
        )
    else:
        msg = build_generic_message(
            lider_nombre=config.lider_nombre or "Estimado/a",
            fecha=fecha_fmt,
            hora=ev.hora_inicio,
            evento_titulo=ev.titulo,
            lugar=ev.lugar,
        )

    ok = send_whatsapp(config.lider_telefono, msg)
    if ok:
        ev.notificacion_enviada = True
        ev.updated_at = datetime.utcnow()
        db.add(ev)
        db.commit()

    return {"ok": ok, "to": config.lider_telefono, "mensaje": msg}


# ── Notificación Email ────────────────────────────────────────────────────────

@router.post("/eventos/{evento_id}/notificar-email")
def notificar_evento_email(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_editar),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404)

    config = db.exec(
        select(PtcAreaConfig).where(PtcAreaConfig.area_id == ev.area_id)
    ).first() if ev.area_id else None

    if not config or not config.lider_email:
        raise HTTPException(400, "El área no tiene email del líder configurado")

    from app.services.global_smtp import get_global_smtp

    smtp_local = db.get(PtcSmtpConfig, 1)
    global_smtp = get_global_smtp()
    if global_smtp:
        smtp_host, smtp_port = global_smtp["smtp_host"], global_smtp["smtp_port"]
        smtp_usuario, smtp_password = global_smtp["smtp_user"], global_smtp["smtp_password"]
        smtp_from_email = global_smtp["smtp_from"]
        smtp_from_nombre = (smtp_local.from_nombre if smtp_local else "") or "T&C Zymo"
    elif smtp_local and smtp_local.activo and smtp_local.host:
        smtp_host, smtp_port = smtp_local.host, smtp_local.port
        smtp_usuario, smtp_password = smtp_local.usuario, smtp_local.password
        smtp_from_email, smtp_from_nombre = smtp_local.from_email, smtp_local.from_nombre
    else:
        raise HTTPException(
            400,
            "SMTP no configurado — configúralo en Configuración de la intranet · SMTP corporativo (o en T&C · Ajustes)",
        )

    personas_ids = [
        p.persona_id for p in db.exec(
            select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
        ).all()
    ]
    nombres = [p.nombre for pid in personas_ids[:10] if (p := db.get(PtcPersona, pid))]
    fecha_fmt = ev.fecha.strftime("%d/%m/%Y") if ev.fecha else ""

    subject, html = build_evento_email(
        lider_nombre=config.lider_nombre or "Estimado/a",
        fecha=fecha_fmt,
        hora=ev.hora_inicio,
        evento_titulo=ev.titulo,
        lugar=ev.lugar,
        personas=nombres if ev.tipo == "induccion" else None,
    )

    ok = send_email(
        host=smtp_host, port=smtp_port,
        usuario=smtp_usuario, password=smtp_password,
        from_email=smtp_from_email, from_nombre=smtp_from_nombre,
        to=config.lider_email, subject=subject, body_html=html,
    )

    return {"ok": ok, "to": config.lider_email, "asunto": subject}
