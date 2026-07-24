"""
Router T&C — Capacitación tipo #2: inducción/reinducción de nuevo personal,
agendada por el coordinador de T&C (no por líderes de área, ver tc_agenda.py
para el tipo #1).

Prefijo API: /tc/cap-coordinador (deliberadamente distinto del prefijo de
las páginas frontend /tc/nuevo-personal/* para que la regex de proxy de
nginx no confunda ruta SPA con endpoint real — mismo gotcha que ya pasó
con /tc/empresa/:sedeId).

Permiso `mod_tc_cap_coordinador` — pensado como permiso adicional sobre
T&C completo (mod_tc + mod_tc_editar), no independiente como mod_tc_agenda.
Un "día" agrupa uno o más "bloques" (líder + horario, como una franja de
Teams); el roster y la evidencia (asistencia, foto/acta) viven por bloque,
no por día — cada líder puede excluir puntualmente a alguien de su propio
bloque sin afectar los demás.
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

from app.config import settings
from app.core.deps import require_admin, require_permission
from app.database import get_db
from app.models.sede import Sede
from app.models.user import User
from app.personal_database import (
    PtcCapBloque,
    PtcCapBloquePersona,
    PtcCapDia,
    PtcCargo,
    PtcPersona,
    get_personal_db,
)
from app.services.tc_acta import render_acta_pdf

router = APIRouter(prefix="/tc/cap-coordinador", tags=["T&C Capacitación Coordinador"])

require_tc_cap = require_permission("mod_tc_cap_coordinador")

_MAX_FOTO_MB = 8

_AGENDADO   = "Agendado"
_EN_CURSO   = "En curso"
_FINALIZADO = "Finalizado"


# ── Schemas ───────────────────────────────────────────────────────────────────

class BloqueInput(BaseModel):
    lider_persona_id: int
    hora_inicio: str = "08:00"
    hora_fin: str = "09:00"


class DiaCreate(BaseModel):
    fecha: str  # "YYYY-MM-DD"
    titulo: str = "Inducción nuevo personal"
    descripcion: str = ""
    sede_id: int
    persona_ids: list[int] = []
    bloques: list[BloqueInput] = []


class AsistenciaUpdate(BaseModel):
    persona_id: int
    asistio: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Fecha inválida: {s}")


def _calcular_estado(b: PtcCapBloque, dia: PtcCapDia) -> str:
    """Igual patrón que tipo #1: Agendado/En curso se derivan de fecha+hora del
    día dueño del bloque, Finalizado es la única transición persistida."""
    if b.finalizada_en is not None:
        return _FINALIZADO
    inicio = datetime.combine(dia.fecha, datetime.strptime(b.hora_inicio, "%H:%M").time())
    if datetime.now() >= inicio:
        return _EN_CURSO
    return _AGENDADO


def _requerir_estado(b: PtcCapBloque, dia: PtcCapDia, *permitidos: str) -> None:
    estado = _calcular_estado(b, dia)
    if estado not in permitidos:
        raise HTTPException(409, f"No disponible en estado '{estado}'.")


def _personas_del_dia(db: Session, dia_id: int) -> list[int]:
    bloque_ids = [b.id for b in db.exec(select(PtcCapBloque).where(PtcCapBloque.dia_id == dia_id)).all()]
    if not bloque_ids:
        return []
    ids = set()
    for bid in bloque_ids:
        for bp in db.exec(select(PtcCapBloquePersona).where(PtcCapBloquePersona.bloque_id == bid)).all():
            ids.add(bp.persona_id)
    return sorted(ids)


def _persona_mini(db: Session, persona_id: int) -> dict:
    p = db.get(PtcPersona, persona_id)
    cargo = db.get(PtcCargo, p.cargo_id) if p and p.cargo_id else None
    return {
        "id": persona_id,
        "nombre": p.nombre if p else f"Persona #{persona_id}",
        "cargo_nombre": cargo.nombre if cargo else "",
    }


def _bloque_dict(b: PtcCapBloque, db: Session, dia: Optional[PtcCapDia] = None) -> dict:
    lider = db.get(PtcPersona, b.lider_persona_id)
    dia = dia or db.get(PtcCapDia, b.dia_id)
    roster = db.exec(select(PtcCapBloquePersona).where(PtcCapBloquePersona.bloque_id == b.id)).all()
    personas = []
    for r in roster:
        mini = _persona_mini(db, r.persona_id)
        personas.append({**mini, "incluido": r.incluido, "asistio": r.asistio})
    return {
        "id": b.id,
        "dia_id": b.dia_id,
        "lider_persona_id": b.lider_persona_id,
        "lider_nombre": lider.nombre if lider else f"Persona #{b.lider_persona_id}",
        "hora_inicio": b.hora_inicio,
        "hora_fin": b.hora_fin,
        "estado": _calcular_estado(b, dia),
        "foto_evidencia_url": b.foto_evidencia_url,
        "acta_firmada_url": b.acta_firmada_url,
        "personas": personas,
        "total_incluidos": sum(1 for p in personas if p["incluido"]),
    }


def _dia_dict(d: PtcCapDia, db: Session, main_db: Session) -> dict:
    bloques = db.exec(
        select(PtcCapBloque).where(PtcCapBloque.dia_id == d.id).order_by(PtcCapBloque.hora_inicio)
    ).all()
    bloque_dicts = [_bloque_dict(b, db, dia=d) for b in bloques]
    sede = main_db.get(Sede, d.sede_id) if d.sede_id else None
    return {
        "id": d.id,
        "fecha": d.fecha.isoformat() if d.fecha else None,
        "titulo": d.titulo,
        "descripcion": d.descripcion,
        "sede_id": d.sede_id,
        "sede_nombre": sede.name if sede else "",
        "bloques": bloque_dicts,
        "total_personas": len(_personas_del_dia(db, d.id)),
        "created_at": d.created_at.isoformat(),
    }


# ── Días ──────────────────────────────────────────────────────────────────────

@router.get("/dias")
def listar_dias(
    mes: Optional[str] = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_cap),
):
    stmt = select(PtcCapDia).order_by(PtcCapDia.fecha)
    dias = db.exec(stmt).all()
    if mes:
        try:
            y, m = int(mes[:4]), int(mes[5:7])
            dias = [d for d in dias if d.fecha.year == y and d.fecha.month == m]
        except Exception:
            pass
    return [_dia_dict(d, db, main_db) for d in dias]


@router.post("/dias", status_code=201)
def crear_dia(
    body: DiaCreate,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_cap),
):
    if not main_db.get(Sede, body.sede_id):
        raise HTTPException(400, "La plataforma (sede) seleccionada no existe.")
    if not body.bloques:
        raise HTTPException(400, "Agrega al menos un bloque (líder + horario).")
    if not body.persona_ids:
        raise HTTPException(400, "Selecciona al menos una persona a capacitar.")

    dia = PtcCapDia(fecha=_parse_date(body.fecha), titulo=body.titulo, descripcion=body.descripcion, sede_id=body.sede_id)
    db.add(dia)
    db.flush()

    for binp in body.bloques:
        bloque = PtcCapBloque(
            dia_id=dia.id,
            lider_persona_id=binp.lider_persona_id,
            hora_inicio=binp.hora_inicio,
            hora_fin=binp.hora_fin,
        )
        db.add(bloque)
        db.flush()
        for pid in body.persona_ids:
            db.add(PtcCapBloquePersona(bloque_id=bloque.id, persona_id=pid, incluido=True))

    db.commit()
    db.refresh(dia)
    return _dia_dict(dia, db, main_db)


@router.get("/dias/{dia_id}")
def get_dia(
    dia_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_cap),
):
    dia = db.get(PtcCapDia, dia_id)
    if not dia:
        raise HTTPException(404, "Día no encontrado")
    return _dia_dict(dia, db, main_db)


@router.delete("/dias/{dia_id}", status_code=204)
def eliminar_dia(
    dia_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_admin),
):
    dia = db.get(PtcCapDia, dia_id)
    if not dia:
        raise HTTPException(404, "Día no encontrado")
    for b in db.exec(select(PtcCapBloque).where(PtcCapBloque.dia_id == dia_id)).all():
        for bp in db.exec(select(PtcCapBloquePersona).where(PtcCapBloquePersona.bloque_id == b.id)).all():
            db.delete(bp)
        db.delete(b)
    db.delete(dia)
    db.commit()


@router.post("/dias/{dia_id}/bloques", status_code=201)
def agregar_bloque(
    dia_id: int,
    body: BloqueInput,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_cap),
):
    """Agrega un bloque (líder + horario) adicional a un día ya creado — el
    roster arranca igual al del resto del día (unión de personas ya usadas
    en sus otros bloques), y de ahí se puede desmarcar puntualmente."""
    dia = db.get(PtcCapDia, dia_id)
    if not dia:
        raise HTTPException(404, "Día no encontrado")
    bloque = PtcCapBloque(
        dia_id=dia_id,
        lider_persona_id=body.lider_persona_id,
        hora_inicio=body.hora_inicio,
        hora_fin=body.hora_fin,
    )
    db.add(bloque)
    db.flush()
    for pid in _personas_del_dia(db, dia_id):
        db.add(PtcCapBloquePersona(bloque_id=bloque.id, persona_id=pid, incluido=True))
    db.commit()
    return _dia_dict(dia, db, main_db)


# ── Bloques ───────────────────────────────────────────────────────────────────

@router.delete("/bloques/{bloque_id}", status_code=204)
def eliminar_bloque(
    bloque_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _AGENDADO)
    for bp in db.exec(select(PtcCapBloquePersona).where(PtcCapBloquePersona.bloque_id == bloque_id)).all():
        db.delete(bp)
    db.delete(b)
    db.commit()


@router.put("/bloques/{bloque_id}")
def actualizar_bloque(
    bloque_id: int,
    body: BloqueInput,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _AGENDADO)
    b.lider_persona_id = body.lider_persona_id
    b.hora_inicio = body.hora_inicio
    b.hora_fin = body.hora_fin
    db.add(b)
    db.commit()
    return _bloque_dict(b, db)


@router.put("/bloques/{bloque_id}/personas")
def set_personas_bloque(
    bloque_id: int,
    persona_ids: list[int],
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    """persona_ids = las que quedan incluidas en este bloque específico —
    el resto del roster del bloque se marca incluido=False sin borrarse
    (conserva historial de asistencia si ya se había marcado antes)."""
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _AGENDADO, _EN_CURSO)
    incluidos = set(persona_ids)
    filas = {bp.persona_id: bp for bp in db.exec(
        select(PtcCapBloquePersona).where(PtcCapBloquePersona.bloque_id == bloque_id)
    ).all()}
    for pid, bp in filas.items():
        bp.incluido = pid in incluidos
        db.add(bp)
    for pid in incluidos:
        if pid not in filas:
            db.add(PtcCapBloquePersona(bloque_id=bloque_id, persona_id=pid, incluido=True))
    db.commit()
    return _bloque_dict(b, db)


@router.post("/bloques/{bloque_id}/finalizar")
def finalizar_bloque(
    bloque_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _EN_CURSO)
    b.finalizada_en = datetime.utcnow()
    db.add(b)
    db.commit()
    return _bloque_dict(b, db)


@router.patch("/bloques/{bloque_id}/asistencia")
def registrar_asistencia(
    bloque_id: int,
    body: AsistenciaUpdate,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _FINALIZADO)
    bp = db.exec(
        select(PtcCapBloquePersona).where(
            PtcCapBloquePersona.bloque_id == bloque_id,
            PtcCapBloquePersona.persona_id == body.persona_id,
        )
    ).first()
    if not bp:
        raise HTTPException(404, "Persona no asignada a este bloque")
    bp.asistio = body.asistio
    db.add(bp)
    db.commit()
    return {"ok": True}


@router.post("/bloques/{bloque_id}/asistencia/marcar-todos")
def marcar_todos_asistieron(
    bloque_id: int,
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _FINALIZADO)
    for bp in db.exec(
        select(PtcCapBloquePersona).where(
            PtcCapBloquePersona.bloque_id == bloque_id,
            PtcCapBloquePersona.incluido == True,  # noqa: E712
        )
    ).all():
        bp.asistio = True
        db.add(bp)
    db.commit()
    return _bloque_dict(b, db)


# ── Evidencia (foto opcional) ─────────────────────────────────────────────────

@router.post("/bloques/{bloque_id}/foto-evidencia")
async def subir_foto_evidencia(
    bloque_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _FINALIZADO)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Solo se permiten imágenes.")

    content = await file.read()
    if len(content) > _MAX_FOTO_MB * 1024 * 1024:
        raise HTTPException(400, f"La imagen no puede superar los {_MAX_FOTO_MB} MB.")

    ext = {"image/png": "png", "image/webp": "webp"}.get(file.content_type, "jpg")
    fotos_dir = settings.tc_fotos_dir
    os.makedirs(fotos_dir, exist_ok=True)
    fname = f"evidencia_cap_bloque_{bloque_id}.{ext}"
    with open(os.path.join(fotos_dir, fname), "wb") as f:
        f.write(content)

    b.foto_evidencia_url = f"/tc-fotos/{fname}"
    db.add(b)
    db.commit()
    db.refresh(b)
    return _bloque_dict(b, db)


# ── Acta descargable + reupload firmada ───────────────────────────────────────

@router.get("/bloques/{bloque_id}/acta.pdf")
def descargar_acta(
    bloque_id: int,
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    dia = db.get(PtcCapDia, b.dia_id)
    lider = db.get(PtcPersona, b.lider_persona_id)
    sede = main_db.get(Sede, dia.sede_id) if dia and dia.sede_id else None
    roster = db.exec(
        select(PtcCapBloquePersona).where(
            PtcCapBloquePersona.bloque_id == bloque_id,
            PtcCapBloquePersona.incluido == True,  # noqa: E712
        )
    ).all()
    nombres = [_persona_mini(db, r.persona_id)["nombre"] for r in roster]

    foto_b64 = None
    if b.foto_evidencia_url:
        fname = b.foto_evidencia_url.rsplit("/", 1)[-1]
        fpath = os.path.join(settings.tc_fotos_dir, fname)
        if os.path.isfile(fpath):
            with open(fpath, "rb") as f:
                ext = os.path.splitext(fname)[1].lstrip(".") or "jpeg"
                foto_b64 = f"data:image/{ext};base64,{base64.b64encode(f.read()).decode()}"

    pdf_bytes = render_acta_pdf(
        nombre_sede=sede.name if sede else None,
        titulo=dia.titulo if dia else "",
        fecha_str=dia.fecha.strftime("%d/%m/%Y") if dia else "",
        hora_inicio=b.hora_inicio,
        hora_fin=b.hora_fin,
        contexto_label="Dicta",
        contexto_valor=lider.nombre if lider else "",
        descripcion=dia.descripcion if dia else "",
        nombres=nombres,
        foto_b64=foto_b64,
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="acta_cap_bloque_{bloque_id}.pdf"'},
    )


@router.post("/bloques/{bloque_id}/acta-firmada")
async def subir_acta_firmada(
    bloque_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    b = db.get(PtcCapBloque, bloque_id)
    if not b:
        raise HTTPException(404, "Bloque no encontrado")
    _requerir_estado(b, db.get(PtcCapDia, b.dia_id), _FINALIZADO)

    content = await file.read()
    ext = os.path.splitext(file.filename or "")[1].lstrip(".") or "pdf"
    docs_dir = settings.tc_docs_dir
    os.makedirs(docs_dir, exist_ok=True)
    fname = f"acta_firmada_cap_bloque_{bloque_id}.{ext}"
    with open(os.path.join(docs_dir, fname), "wb") as f:
        f.write(content)

    b.acta_firmada_url = f"/tc-docs/{fname}"
    db.add(b)
    db.commit()
    db.refresh(b)
    return _bloque_dict(b, db)


# ── Líderes recientes (para "reutilizar los ya usados") ───────────────────────

@router.get("/lideres-recientes")
def lideres_recientes(
    db: Session = Depends(get_personal_db),
    _: User = Depends(require_tc_cap),
):
    bloques = db.exec(select(PtcCapBloque).order_by(PtcCapBloque.id.desc())).all()
    vistos: dict[int, None] = {}
    for b in bloques:
        vistos.setdefault(b.lider_persona_id, None)
        if len(vistos) >= 15:
            break
    return [_persona_mini(db, pid) for pid in vistos]
