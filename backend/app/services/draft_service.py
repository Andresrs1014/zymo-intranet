"""
Lógica de negocio para borradores de formularios.

Responsabilidades:
- Búsqueda y upsert de FormDraft.
- Gestión de archivos en disco (guardar, eliminar).
- Limpieza por TTL (usada por el job APScheduler en main.py).
"""
import logging
import mimetypes
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlmodel import Session, select

from app.config import settings
from app.models.draft import FormDraft

_log = logging.getLogger("zymo.borradores")

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".xlsx", ".xls", ".doc", ".docx"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _drafts_base() -> Path:
    return Path(settings.drafts_dir)


def find_draft(
    db: Session,
    user_id: int,
    tipo: str,
    solicitud_id: Optional[str],
) -> Optional[FormDraft]:
    """Devuelve el borrador del usuario para tipo + solicitud_id, o None si no existe."""
    candidates = db.exec(
        select(FormDraft).where(FormDraft.user_id == user_id, FormDraft.tipo == tipo)
    ).all()

    for draft in candidates:
        ctx_sid = (draft.contexto or {}).get("solicitud_id")
        if solicitud_id is None:
            if ctx_sid is None:
                return draft
        else:
            if ctx_sid == solicitud_id:
                return draft

    return None


def upsert_draft(
    db: Session,
    *,
    user_id: int,
    tipo: str,
    contexto: Optional[dict],
    payload: Optional[dict],
) -> FormDraft:
    """Crea o actualiza el borrador del usuario para el tipo y contexto dados."""
    solicitud_id: Optional[str] = (contexto or {}).get("solicitud_id")
    draft = find_draft(db, user_id, tipo, solicitud_id)
    now = datetime.now(timezone.utc)

    if draft:
        if contexto is not None:
            draft.contexto = contexto
        if payload is not None:
            draft.payload = payload
        draft.updated_at = now
    else:
        draft = FormDraft(
            tipo=tipo,
            user_id=user_id,
            contexto=contexto,
            payload=payload,
            archivos=None,
            updated_at=now,
            creado_en=now,
        )

    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def save_draft_file(
    db: Session,
    *,
    user_id: int,
    tipo: str,
    solicitud_id: Optional[str],
    filename: str,
    content: bytes,
) -> tuple[FormDraft, dict]:
    """
    Guarda un archivo en disco, valida extensión y tamaño, y actualiza el campo
    `archivos` del borrador correspondiente (creándolo si no existe).

    Retorna (draft actualizado, referencia de archivo como dict).
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extensión '{ext}' no permitida.")

    if len(content) > MAX_FILE_SIZE:
        raise ValueError("El archivo supera el tamaño máximo de 20 MB.")

    draft = find_draft(db, user_id, tipo, solicitud_id)
    now = datetime.now(timezone.utc)

    if not draft:
        ctx: Optional[dict] = {"solicitud_id": solicitud_id} if solicitud_id else None
        draft = FormDraft(
            tipo=tipo,
            user_id=user_id,
            contexto=ctx,
            payload=None,
            archivos=None,
            updated_at=now,
            creado_en=now,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)

    dest_dir = _drafts_base() / str(user_id) / draft.id
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = dest_dir / filename

    with open(dest_path, "wb") as fh:
        fh.write(content)

    mime_type, _ = mimetypes.guess_type(filename)
    ref = {
        "path": str(dest_path),
        "nombre_original": filename,
        "mime": mime_type or "application/octet-stream",
        "size_bytes": len(content),
        "draft_id": draft.id,
    }

    existing = list(draft.archivos or [])
    existing.append(ref)
    draft.archivos = existing
    draft.updated_at = datetime.now(timezone.utc)

    db.add(draft)
    db.commit()
    db.refresh(draft)

    return draft, ref


def delete_draft(
    db: Session,
    *,
    user_id: int,
    tipo: str,
    solicitud_id: Optional[str],
) -> bool:
    """Elimina el borrador y sus archivos en disco. Retorna True si existía."""
    draft = find_draft(db, user_id, tipo, solicitud_id)
    if not draft:
        return False

    draft_dir = _drafts_base() / str(user_id) / draft.id
    if draft_dir.exists():
        shutil.rmtree(draft_dir)

    db.delete(draft)
    db.commit()
    return True


def purge_old_drafts(db: Session, *, ttl_days: int) -> int:
    """
    Elimina todos los borradores con updated_at más antiguo que ttl_days.
    Retorna el número de borradores eliminados.
    """
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=ttl_days)
    candidatos = db.exec(select(FormDraft)).all()
    eliminados = 0

    for draft in candidatos:
        updated = draft.updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        if updated < cutoff:
            draft_dir = _drafts_base() / str(draft.user_id) / draft.id
            if draft_dir.exists():
                shutil.rmtree(draft_dir)
            db.delete(draft)
            eliminados += 1

    db.commit()
    _log.info("[borradores] Purga: %d borrador(es) eliminado(s) (TTL=%d días).", eliminados, ttl_days)
    return eliminados
