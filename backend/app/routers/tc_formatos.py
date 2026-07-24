"""
Router T&C — Formatos digitales (Gestión Humana).

Prefijo API: /tc/formatos-api (deliberadamente distinto del prefijo de las
páginas frontend /tc/formatos/* para que la regex de proxy de nginx no
confunda ruta SPA con endpoint real — mismo gotcha que ya pasó con
/tc/empresa/:sedeId y /tc/nuevo-personal/*).

Sin autenticación a propósito: no todos los colaboradores tienen usuario de
la intranet, así que el formulario público debe poder resolver a la persona
por cédula sin login. Solo expone lo mínimo necesario para diligenciar el
formato (nombre, cargo, empresa, firma) — nada sensible.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_db
from app.models.plataforma_perfil import PlataformaPerfil
from app.models.sede import Sede
from app.personal_database import PtcCargo, PtcNovedad, PtcPersona, get_personal_db

router = APIRouter(prefix="/tc/formatos-api", tags=["T&C Formatos"])

# Cada formato digital cae en una de las 3 categorías que ya existen en el
# perfil (Evaluación / Sanción / Novedad) — con un solo formato en producción
# todavía no hace falta una tabla de configuración; cuando haya más se puede
# extraer a un mapeo formato→categoría editable.
_AUSENTISMO_ORIGEN = "formato:ausentismo"


def _parse_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(400, f"Fecha inválida: {s}")


@router.get("/persona-por-documento")
def persona_por_documento(
    documento: str = Query(..., min_length=1),
    db: Session = Depends(get_personal_db),
    main_db: Session = Depends(get_db),
):
    documento = documento.strip()
    if not documento:
        raise HTTPException(400, "Documento requerido.")

    persona = db.exec(
        select(PtcPersona).where(PtcPersona.documento == documento, PtcPersona.estado == "Activo")
    ).first()
    if not persona:
        raise HTTPException(404, "No se encontró un colaborador activo con esa cédula.")

    cargo = db.get(PtcCargo, persona.cargo_id) if persona.cargo_id else None
    sede = main_db.get(Sede, persona.sede_id) if persona.sede_id else None
    perfil = main_db.get(PlataformaPerfil, persona.sede_id) if persona.sede_id else None

    return {
        "id": persona.id,
        "nombre": persona.nombre,
        "cargo_nombre": cargo.nombre if cargo else "",
        "sede_id": persona.sede_id,
        "empresa_nombre": (perfil.nombre if perfil and perfil.nombre else sede.name if sede else ""),
        "logo_url": perfil.logo_url if perfil else "",
        "firma_url": persona.firma_url,
    }


class AusentismoSubmit(BaseModel):
    documento: str
    tipo: str  # "Permiso" | "Licencia remunerada" | "Licencia no remunerada"
    fecha_inicio: str
    hora_inicio: str = ""
    fecha_fin: str
    hora_fin: str = ""
    motivo: str = ""
    repone_tiempo: bool = False
    como: str = ""


@router.post("/ausentismo", status_code=201)
def enviar_ausentismo(
    body: AusentismoSubmit,
    db: Session = Depends(get_personal_db),
):
    documento = body.documento.strip()
    persona = db.exec(
        select(PtcPersona).where(PtcPersona.documento == documento, PtcPersona.estado == "Activo")
    ).first()
    if not persona:
        raise HTTPException(404, "No se encontró un colaborador activo con esa cédula.")
    if not persona.firma_url:
        raise HTTPException(400, "Este colaborador no tiene firma digital registrada — no se puede enviar el formato.")

    descripcion = body.motivo.strip()
    if body.repone_tiempo:
        descripcion += f"\nRepone tiempo: {body.como.strip() or 'sin especificar cómo'}."
    if body.hora_inicio or body.hora_fin:
        descripcion += f"\nHorario: {body.hora_inicio or '?'} – {body.hora_fin or '?'}."

    nov = PtcNovedad(
        persona_id=persona.id,
        tipo=body.tipo,
        descripcion=descripcion.strip(),
        fecha_inicio=_parse_date(body.fecha_inicio),
        fecha_fin=_parse_date(body.fecha_fin),
        estado="Pendiente",
        origen=_AUSENTISMO_ORIGEN,
    )
    db.add(nov)
    db.commit()
    db.refresh(nov)
    return {"id": nov.id, "persona_id": persona.id, "estado": nov.estado}
