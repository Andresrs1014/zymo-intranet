"""
Router T&C — Agenda (tipo #1: inducción de personal nuevo).

Prefijo: /tc  (montado junto a personal.py)
Permiso propio `mod_tc_agenda` — independiente de mod_tc/mod_tc_editar:
cualquier líder de área con este permiso puede agendar, sin necesitar
acceso al resto de T&C.
"""
from __future__ import annotations

import base64
import io
import os
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from weasyprint import HTML

from app.config import settings
from app.core.deps import require_admin, require_permission
from app.database import get_db
from app.models.area import Area as GlobalArea
from app.models.sede import Sede
from app.models.user import User
from app.personal_database import (
    PtcCapacitacion,
    PtcCargo,
    PtcEvento,
    PtcEventoPersona,
    PtcPersona,
    get_personal_db,
)

router = APIRouter(prefix="/tc", tags=["T&C Agenda"])

require_tc_agenda = require_permission("mod_tc_agenda")

_MAX_FOTO_MB = 8

_AGENDADA  = "Agendada"
_EN_CURSO  = "En curso"
_FINALIZADA = "Finalizada"


# ── Schemas ───────────────────────────────────────────────────────────────────

class EventoCreate(BaseModel):
    titulo: str
    fecha: str          # "YYYY-MM-DD"
    hora_inicio: str = "08:00"
    hora_fin: str = "09:00"
    descripcion: str = ""
    persona_ids: list[int] = []


class EventoUpdate(BaseModel):
    titulo: str
    fecha: str
    hora_inicio: str
    hora_fin: str
    descripcion: str = ""


class AsistenciaUpdate(BaseModel):
    persona_id: int
    asistio: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Fecha inválida: {s}")


def _resolver_area_lider(user: User, db: Session) -> int:
    """El área del evento nunca se elige a mano — es la del perfil T&C del
    líder que agenda. Sin perfil vinculado o sin área asignada, no se puede
    agendar (hay que arreglar el perfil primero, no adivinar el área)."""
    persona = db.exec(select(PtcPersona).where(PtcPersona.user_id == user.id)).first()
    if not persona:
        raise HTTPException(400, "Tu usuario no tiene un perfil de colaborador vinculado en T&C — no se puede resolver tu área.")
    if not persona.area_id:
        raise HTTPException(400, "Tu perfil de T&C no tiene área asignada — pídele a T&C que la complete antes de agendar.")
    return persona.area_id


def _calcular_estado(ev: PtcEvento) -> str:
    """Agendada → En curso → Finalizada. Las primeras dos se derivan de la
    fecha/hora — nunca se guardan ni se fuerzan a mano (evita depender de un
    cron para el corte). Finalizada sí se persiste (`finalizada_en`): es la
    única transición manual, la decide el líder."""
    if ev.finalizada_en is not None:
        return _FINALIZADA
    inicio = datetime.combine(ev.fecha, datetime.strptime(ev.hora_inicio, "%H:%M").time())
    if datetime.now() >= inicio:
        return _EN_CURSO
    return _AGENDADA


def _requerir_estado(ev: PtcEvento, *permitidos: str) -> None:
    estado = _calcular_estado(ev)
    if estado not in permitidos:
        raise HTTPException(409, f"No disponible en estado '{estado}'.")


def _evento_dict(ev: PtcEvento, db: Session, main_db: Session) -> dict:
    asignaciones = db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == ev.id)
    ).all()
    personas = []
    for a in asignaciones:
        p = db.get(PtcPersona, a.persona_id)
        cargo = db.get(PtcCargo, p.cargo_id) if p and p.cargo_id else None
        personas.append({
            "persona_id": a.persona_id,
            "nombre": p.nombre if p else f"Persona #{a.persona_id}",
            "cargo_nombre": cargo.nombre if cargo else "",
            "asistio": a.asistio,
        })
    area = main_db.get(GlobalArea, ev.area_id)
    return {
        "id": ev.id,
        "titulo": ev.titulo,
        "tipo": ev.tipo,
        "fecha": ev.fecha.isoformat() if ev.fecha else None,
        "hora_inicio": ev.hora_inicio,
        "hora_fin": ev.hora_fin,
        "descripcion": ev.descripcion,
        "area_id": ev.area_id,
        "area_nombre": area.name if area else "",
        "estado": _calcular_estado(ev),
        "foto_evidencia_url": ev.foto_evidencia_url,
        "acta_firmada_url": ev.acta_firmada_url,
        "total_personas": len(personas),
        "personas": personas,
        "created_at": ev.created_at.isoformat(),
    }


# ── Personas (lectura liviana, sin depender de mod_tc) ────────────────────────
# El picker de participantes lo usa un líder que puede NO tener acceso al
# resto de T&C (mod_tc) — mismo patrón que /operativo/clientes/lista-simple.

@router.get("/agenda/personas-lista")
def listar_personas_para_agenda(
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    personas = db.exec(
        select(PtcPersona).where(PtcPersona.estado == "Activo")
    ).all()
    result = []
    for p in personas:
        sede = main_db.get(Sede, p.sede_id) if p.sede_id else None
        area = main_db.get(GlobalArea, p.area_id) if p.area_id else None
        cargo = db.get(PtcCargo, p.cargo_id) if p.cargo_id else None
        result.append({
            "id": p.id,
            "nombre": p.nombre,
            "empresa_id": p.sede_id,
            "empresa_nombre": sede.name if sede else "",
            "area_id": p.area_id,
            "area_nombre": area.name if area else "",
            "cargo_id": p.cargo_id,
            "cargo_nombre": cargo.nombre if cargo else "",
        })
    return result


# ── Eventos CRUD ──────────────────────────────────────────────────────────────

@router.get("/eventos")
def listar_eventos(
    mes: Optional[str] = Query(None, description="YYYY-MM"),
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    stmt = select(PtcEvento)
    if desde:
        stmt = stmt.where(PtcEvento.fecha >= _parse_date(desde))
    if hasta:
        stmt = stmt.where(PtcEvento.fecha <= _parse_date(hasta))
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
    user: User = Depends(require_tc_agenda),
):
    area_id = _resolver_area_lider(user, db)

    ev = PtcEvento(
        titulo=body.titulo,
        fecha=_parse_date(body.fecha),
        hora_inicio=body.hora_inicio,
        hora_fin=body.hora_fin,
        descripcion=body.descripcion,
        area_id=area_id,
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
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    return _evento_dict(ev, db, main_db)


@router.delete("/eventos/{evento_id}", status_code=204)
def eliminar_evento(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_admin),
):
    """Solo admin — borrado real, sin gate de estado. Pensado para limpiar
    pruebas, no para uso normal del líder (que no tiene forma de deshacer
    una capacitación real ya agendada)."""
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    for asign in db.exec(select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)).all():
        db.delete(asign)
    db.delete(ev)
    db.commit()


@router.put("/eventos/{evento_id}")
def actualizar_evento(
    evento_id: int,
    body: EventoUpdate,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _AGENDADA)
    ev.titulo = body.titulo
    ev.fecha = _parse_date(body.fecha)
    ev.hora_inicio = body.hora_inicio
    ev.hora_fin = body.hora_fin
    ev.descripcion = body.descripcion
    ev.updated_at = datetime.utcnow()
    db.add(ev)
    db.commit()
    return _evento_dict(ev, db, main_db)


@router.put("/eventos/{evento_id}/personas")
def set_personas_evento(
    evento_id: int,
    persona_ids: list[int],
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _AGENDADA, _EN_CURSO)
    actuales = {a.persona_id: a for a in db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
    ).all()}
    nuevos = set(persona_ids)
    for pid, asign in actuales.items():
        if pid not in nuevos:
            db.delete(asign)
    for pid in nuevos:
        if pid not in actuales:
            db.add(PtcEventoPersona(evento_id=evento_id, persona_id=pid))
    db.commit()
    return _evento_dict(ev, db, main_db)


def _horas_evento(ev: PtcEvento) -> float:
    try:
        inicio = datetime.strptime(ev.hora_inicio, "%H:%M")
        fin = datetime.strptime(ev.hora_fin, "%H:%M")
        return round((fin - inicio).total_seconds() / 3600, 1)
    except Exception:
        return 0.0


def _sync_capacitacion(db: Session, persona_id: int, ev: PtcEvento, asistio: Optional[bool]) -> None:
    """Refleja la asistencia de Agenda (tipo #1) en el historial de
    Capacitaciones del perfil de la persona — antes quedaba solo en
    PtcEventoPersona.asistio, sin aparecer nunca en su perfil. Cubre los 3
    estados: asistió, no asistió, y "finalizada pero nunca se marcó" (se crea
    ya en Pendiente al finalizar, antes de que el líder toque la asistencia)."""
    if asistio is True:
        estado = "Completado"
        observaciones = "Asistió a la inducción."
    elif asistio is False:
        estado = "No asistió"
        observaciones = f'Tenía "{ev.titulo}" agendada y no se marcó asistencia.'
    else:
        estado = "Pendiente"
        observaciones = f'Tenía "{ev.titulo}" agendada y no se marcó asistencia.'

    diploma_url = ev.acta_firmada_url or ev.foto_evidencia_url or ""

    existing = db.exec(
        select(PtcCapacitacion).where(
            PtcCapacitacion.persona_id == persona_id,
            PtcCapacitacion.titulo == ev.titulo,
            PtcCapacitacion.fecha == ev.fecha,
        )
    ).first()
    if existing:
        existing.estado = estado
        existing.observaciones = observaciones
        existing.diploma_url = diploma_url
        existing.horas = _horas_evento(ev)
        db.add(existing)
    else:
        db.add(PtcCapacitacion(
            persona_id=persona_id,
            titulo=ev.titulo,
            fecha=ev.fecha,
            horas=_horas_evento(ev),
            estado=estado,
            observaciones=observaciones,
            diploma_url=diploma_url,
        ))


def _sync_capacitaciones_evento(db: Session, ev: PtcEvento) -> None:
    """Vuelve a sincronizar a todos los asistentes del evento — usado cuando
    cambia algo del evento mismo (evidencia subida) que debe reflejarse en
    cada registro de Capacitación ya creado."""
    asignaciones = db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == ev.id)
    ).all()
    for a in asignaciones:
        _sync_capacitacion(db, a.persona_id, ev, a.asistio)


@router.post("/eventos/{evento_id}/finalizar")
def finalizar_evento(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _EN_CURSO)
    ev.finalizada_en = datetime.utcnow()
    db.add(ev)
    db.flush()
    # Crea de una vez el registro "Pendiente" para todos los asistentes —
    # así queda visible en su perfil aunque el líder nunca marque asistencia.
    _sync_capacitaciones_evento(db, ev)
    db.commit()
    return _evento_dict(ev, db, main_db)


@router.patch("/eventos/{evento_id}/asistencia")
def registrar_asistencia(
    evento_id: int,
    body: AsistenciaUpdate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _FINALIZADA)
    ep = db.exec(
        select(PtcEventoPersona).where(
            PtcEventoPersona.evento_id == evento_id,
            PtcEventoPersona.persona_id == body.persona_id,
        )
    ).first()
    if not ep:
        raise HTTPException(404, "Persona no asignada a este evento")
    ep.asistio = body.asistio
    db.add(ep)
    _sync_capacitacion(db, body.persona_id, ev, body.asistio)
    db.commit()
    return {"ok": True}


@router.post("/eventos/{evento_id}/asistencia/marcar-todos")
def marcar_todos_asistieron(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    """Marca a todos como asistieron de una vez — luego el líder desmarca
    puntualmente a quien no asistió (más rápido que uno por uno)."""
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _FINALIZADA)
    asignaciones = db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
    ).all()
    for a in asignaciones:
        a.asistio = True
        db.add(a)
        _sync_capacitacion(db, a.persona_id, ev, True)
    db.commit()
    return _evento_dict(ev, db, main_db)


# ── Evidencia (foto opcional) ─────────────────────────────────────────────────

@router.post("/eventos/{evento_id}/foto-evidencia")
async def subir_foto_evidencia(
    evento_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _FINALIZADA)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Solo se permiten imágenes.")

    content = await file.read()
    if len(content) > _MAX_FOTO_MB * 1024 * 1024:
        raise HTTPException(400, f"La imagen no puede superar los {_MAX_FOTO_MB} MB.")

    ext = {"image/png": "png", "image/webp": "webp"}.get(file.content_type, "jpg")
    fotos_dir = settings.tc_fotos_dir
    os.makedirs(fotos_dir, exist_ok=True)
    fname = f"evidencia_evento_{evento_id}.{ext}"
    with open(os.path.join(fotos_dir, fname), "wb") as f:
        f.write(content)

    ev.foto_evidencia_url = f"/tc-fotos/{fname}"
    ev.updated_at = datetime.utcnow()
    db.add(ev)
    db.flush()
    _sync_capacitaciones_evento(db, ev)
    db.commit()
    db.refresh(ev)
    return _evento_dict(ev, db, main_db)


# ── Acta descargable + reupload firmada ───────────────────────────────────────

@router.get("/eventos/{evento_id}/acta.pdf")
def descargar_acta(
    evento_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    area = main_db.get(GlobalArea, ev.area_id)
    asignaciones = db.exec(
        select(PtcEventoPersona).where(PtcEventoPersona.evento_id == evento_id)
    ).all()
    nombres = []
    for a in asignaciones:
        p = db.get(PtcPersona, a.persona_id)
        nombres.append(p.nombre if p else f"Persona #{a.persona_id}")

    # Si ya hay foto de evidencia, el acta la incrusta como constancia y no
    # pide firma — foto y firma son evidencia intercambiable, no las dos a la vez.
    foto_b64 = None
    if ev.foto_evidencia_url:
        fname = ev.foto_evidencia_url.rsplit("/", 1)[-1]
        fpath = os.path.join(settings.tc_fotos_dir, fname)
        if os.path.isfile(fpath):
            with open(fpath, "rb") as f:
                ext = os.path.splitext(fname)[1].lstrip(".") or "jpeg"
                foto_b64 = f"data:image/{ext};base64,{base64.b64encode(f.read()).decode()}"

    if foto_b64:
        filas = "".join(f"<tr><td>{nombre}</td></tr>" for nombre in nombres)
        tabla_head = "<tr><th>Nombre</th></tr>"
        evidencia_html = f'<img src="{foto_b64}" class="evidencia" />'
    else:
        filas = "".join(f'<tr><td>{nombre}</td><td class="firma"></td></tr>' for nombre in nombres)
        tabla_head = "<tr><th>Nombre</th><th>Firma</th></tr>"
        evidencia_html = ""

    html = f"""
    <html><head><meta charset="utf-8"><style>
      body {{ font-family: sans-serif; font-size: 12px; color: #222; }}
      h1 {{ font-size: 16px; margin-bottom: 4px; }}
      .meta {{ margin-bottom: 16px; }}
      .meta span {{ display: inline-block; margin-right: 18px; }}
      table {{ width: 100%; border-collapse: collapse; }}
      th, td {{ border: 1px solid #999; padding: 8px; text-align: left; }}
      .firma {{ width: 40%; height: 40px; }}
      .evidencia {{ max-width: 100%; max-height: 260px; margin-bottom: 16px; border: 1px solid #999; }}
    </style></head>
    <body>
      <h1>Acta de asistencia — {ev.titulo}</h1>
      <div class="meta">
        <span><strong>Fecha:</strong> {ev.fecha.strftime('%d/%m/%Y')}</span>
        <span><strong>Hora:</strong> {ev.hora_inicio} – {ev.hora_fin}</span>
        <span><strong>Área:</strong> {area.name if area else ''}</span>
      </div>
      <p>{ev.descripcion}</p>
      {evidencia_html}
      <table>
        <thead>{tabla_head}</thead>
        <tbody>{filas}</tbody>
      </table>
    </body></html>
    """
    pdf_bytes = HTML(string=html).write_pdf()
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="acta_evento_{evento_id}.pdf"'},
    )


@router.post("/eventos/{evento_id}/acta-firmada")
async def subir_acta_firmada(
    evento_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_agenda),
):
    ev = db.get(PtcEvento, evento_id)
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    _requerir_estado(ev, _FINALIZADA)

    content = await file.read()
    ext = os.path.splitext(file.filename or "")[1].lstrip(".") or "pdf"
    docs_dir = settings.tc_docs_dir
    os.makedirs(docs_dir, exist_ok=True)
    fname = f"acta_firmada_evento_{evento_id}.{ext}"
    with open(os.path.join(docs_dir, fname), "wb") as f:
        f.write(content)

    ev.acta_firmada_url = f"/tc-docs/{fname}"
    ev.updated_at = datetime.utcnow()
    db.add(ev)
    db.flush()
    _sync_capacitaciones_evento(db, ev)
    db.commit()
    db.refresh(ev)
    return _evento_dict(ev, db, main_db)
