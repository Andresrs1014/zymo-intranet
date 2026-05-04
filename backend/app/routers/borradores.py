"""
Router de borradores de formularios.

Responsabilidad exclusiva: transporte HTTP, validación de entrada/salida y delegación
a `services.draft_service` para toda la lógica de negocio.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session

from app.core.deps import get_current_user, require_admin
from app.database import get_db
from app.models.user import User
from app.services import draft_service

router = APIRouter(prefix="/api/borradores", tags=["Borradores"])


# ── Schemas ────────────────────────────────────────────────────────────────────


class BorradorUpsert(BaseModel):
    tipo: str
    contexto: Optional[dict] = None
    payload: Optional[dict] = None


class ArchivoRef(BaseModel):
    path: str
    nombre_original: str
    mime: str
    size_bytes: int
    draft_id: str


class BorradorRead(BaseModel):
    id: str
    tipo: str
    user_id: int
    contexto: Optional[dict]
    payload: Optional[dict]
    archivos: Optional[list]
    updated_at: datetime
    creado_en: datetime


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.get("", response_model=BorradorRead)
def get_borrador(
    tipo: str,
    solicitud_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BorradorRead:
    draft = draft_service.find_draft(db, current_user.id, tipo, solicitud_id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe borrador para el tipo y contexto indicados.",
        )
    return draft


@router.put("", response_model=BorradorRead)
def upsert_borrador(
    body: BorradorUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BorradorRead:
    draft = draft_service.upsert_draft(
        db,
        user_id=current_user.id,
        tipo=body.tipo,
        contexto=body.contexto,
        payload=body.payload,
    )
    return draft


@router.post("/archivo", response_model=ArchivoRef, status_code=status.HTTP_201_CREATED)
async def upload_archivo(
    tipo: str = Form(...),
    archivo: UploadFile = File(...),
    solicitud_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ArchivoRef:
    content = await archivo.read()
    filename = archivo.filename or ""

    try:
        _, ref = draft_service.save_draft_file(
            db,
            user_id=current_user.id,
            tipo=tipo,
            solicitud_id=solicitud_id,
            filename=filename,
            content=content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return ArchivoRef(**ref)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_borrador(
    tipo: str,
    solicitud_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    found = draft_service.delete_draft(db, user_id=current_user.id, tipo=tipo, solicitud_id=solicitud_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe borrador para el tipo y contexto indicados.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/limpiar", status_code=status.HTTP_200_OK)
def limpiar_borradores_viejos(
    dias: int = Query(default=7, ge=1, description="Eliminar borradores con updated_at más viejo que N días"),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Endpoint admin: purga borradores con antigüedad superior a `dias` días."""
    eliminados = draft_service.purge_old_drafts(db, ttl_days=dias)
    return {"eliminados": eliminados}
