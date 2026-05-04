# backend/app/routers/admin/extraccion.py
"""
Endpoints del panel de revisión de extracción IA.
Solo accesibles por rol admin (require_admin).

Flujo:
  GET  /api/admin/extraccion/cola          → candidatos pendientes de revisión
  POST /api/admin/extraccion/{id}/aprobar  → aprobar + crear learned_synonym
  POST /api/admin/extraccion/{id}/rechazar → marcar como rechazado
  GET  /api/admin/extraccion/sinonimos     → sinónimos aprendidos (con métricas)
  GET  /api/admin/extraccion/metricas      → % ahorro, totales
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.core.deps import get_db, require_admin
from app.models.extraction_review import ExtractionReview
from app.models.learned_synonym import LearnedSynonym
from app.models.user import User
from app.services.field_synonyms import FIELD_SYNONYMS

router = APIRouter(prefix="/api/admin/extraccion", tags=["Admin — Extracción IA"])

CANONICAL_FIELDS = list(FIELD_SYNONYMS.keys())


# ── Schemas ────────────────────────────────────────────────────────────────────

class ReviewRead(BaseModel):
    id: int
    label_raw: str
    campo_sugerido: Optional[str] = None
    confianza_ia: str
    tipo_documento: str
    estado: str
    contexto_id: Optional[str] = None
    fragmento_texto: Optional[str] = None
    creado_en: datetime

    class Config:
        from_attributes = True


class AprobarPayload(BaseModel):
    canonical_field: str   # debe ser una clave de FIELD_SYNONYMS


class SinonimosRead(BaseModel):
    id: int
    label: str
    canonical_field: str
    tipo_documento: str
    aprobado_por_email: str
    veces_visto: int
    creado_en: datetime

    class Config:
        from_attributes = True


class MetricasRead(BaseModel):
    total_candidatos: int
    pendientes: int
    aprobados: int
    rechazados: int
    total_sinonimos_aprendidos: int
    campos_canonicos_disponibles: list[str]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/cola", response_model=list[ReviewRead])
def get_cola(
    estado: str = "pendiente",
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[ExtractionReview]:
    """Cola de candidatos. Por defecto muestra solo los pendientes."""
    return db.exec(
        select(ExtractionReview)
        .where(ExtractionReview.estado == estado)
        .order_by(ExtractionReview.creado_en.desc())
    ).all()


@router.post("/{review_id}/aprobar", response_model=SinonimosRead)
def aprobar_candidato(
    review_id: int,
    payload: AprobarPayload,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LearnedSynonym:
    """Aprueba un candidato y lo registra como sinónimo aprendido."""
    if payload.canonical_field not in CANONICAL_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campo canónico inválido. Válidos: {CANONICAL_FIELDS}",
        )

    review = db.get(ExtractionReview, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato no encontrado.")
    if review.estado != "pendiente":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Ya fue {review.estado}.")

    # Actualizar estado de la revisión
    now = datetime.now(timezone.utc)
    review.estado = "aprobado"
    review.campo_sugerido = payload.canonical_field
    review.revisado_por_id = admin.id
    review.revisado_por_email = admin.email
    review.revisado_en = now
    db.add(review)

    # Crear o actualizar el sinónimo aprendido
    existing = db.exec(
        select(LearnedSynonym).where(LearnedSynonym.label == review.label_raw)
    ).first()

    if existing:
        existing.canonical_field = payload.canonical_field
        existing.aprobado_por_id = admin.id
        existing.aprobado_por_email = admin.email
        db.add(existing)
        synonym = existing
    else:
        synonym = LearnedSynonym(
            label=review.label_raw,
            canonical_field=payload.canonical_field,
            tipo_documento=review.tipo_documento,
            aprobado_por_id=admin.id,
            aprobado_por_email=admin.email,
        )
        db.add(synonym)

    db.commit()
    db.refresh(synonym)

    # Invalidar caché del synonym_loader para que el próximo PDF use el nuevo sinónimo
    from app.services.synonym_loader import invalidate_cache
    invalidate_cache()

    return synonym


@router.post("/{review_id}/rechazar", status_code=status.HTTP_204_NO_CONTENT)
def rechazar_candidato(
    review_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Descarta un candidato — no se crea sinónimo."""
    review = db.get(ExtractionReview, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidato no encontrado.")
    now = datetime.now(timezone.utc)
    review.estado = "rechazado"
    review.revisado_por_id = admin.id
    review.revisado_por_email = admin.email
    review.revisado_en = now
    db.add(review)
    db.commit()


@router.get("/sinonimos", response_model=list[SinonimosRead])
def get_sinonimos(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[LearnedSynonym]:
    """Lista todos los sinónimos aprobados, ordenados por más usados."""
    return db.exec(
        select(LearnedSynonym).order_by(LearnedSynonym.veces_visto.desc())
    ).all()


@router.delete("/sinonimos/{synonym_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_sinonimo(
    synonym_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Elimina un sinónimo aprendido y recarga la caché."""
    row = db.get(LearnedSynonym, synonym_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sinónimo no encontrado.")
    db.delete(row)
    db.commit()
    from app.services.synonym_loader import invalidate_cache
    invalidate_cache()


@router.get("/metricas", response_model=MetricasRead)
def get_metricas(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MetricasRead:
    """Métricas del motor: pendientes, aprobados, rechazados, sinónimos totales."""
    total = db.exec(select(func.count(ExtractionReview.id))).one()
    pendientes = db.exec(
        select(func.count(ExtractionReview.id)).where(ExtractionReview.estado == "pendiente")
    ).one()
    aprobados = db.exec(
        select(func.count(ExtractionReview.id)).where(ExtractionReview.estado == "aprobado")
    ).one()
    rechazados = db.exec(
        select(func.count(ExtractionReview.id)).where(ExtractionReview.estado == "rechazado")
    ).one()
    sinonimos = db.exec(select(func.count(LearnedSynonym.id))).one()

    return MetricasRead(
        total_candidatos=total,
        pendientes=pendientes,
        aprobados=aprobados,
        rechazados=rechazados,
        total_sinonimos_aprendidos=sinonimos,
        campos_canonicos_disponibles=CANONICAL_FIELDS,
    )
