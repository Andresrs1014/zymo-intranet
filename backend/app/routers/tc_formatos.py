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

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_db
from app.models.sede import Sede
from app.personal_database import PtcCargo, PtcPersona, get_personal_db

router = APIRouter(prefix="/tc/formatos-api", tags=["T&C Formatos"])


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

    return {
        "id": persona.id,
        "nombre": persona.nombre,
        "cargo_nombre": cargo.nombre if cargo else "",
        "sede_id": persona.sede_id,
        "empresa_nombre": sede.name if sede else "",
        "firma_url": persona.firma_url,
    }
