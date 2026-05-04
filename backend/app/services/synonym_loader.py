# backend/app/services/synonym_loader.py
"""
Resuelve etiquetas de documentos a campos canónicos.
Combina el diccionario estático (field_synonyms.py) con
los sinónimos aprendidos y aprobados en BD (learned_synonyms).

Carga los sinónimos de BD una sola vez por proceso (caché en memoria).
Llamar a invalidate_cache() después de aprobar un nuevo sinónimo.
"""
import logging

from sqlmodel import Session, select

from app.database import get_engine
from app.services.field_synonyms import resolve_field, fuzzy_resolve, FIELD_SYNONYMS

_log = logging.getLogger("zymo.synonym_loader")

# Caché en memoria: label.lower() → canonical_field
# Se reconstruye con invalidate_cache() al aprobar nuevos sinónimos
_learned_cache: dict[str, str] = {}
_cache_loaded = False


def _load_learned_cache() -> None:
    """Carga sinónimos aprobados de BD en _learned_cache. Idempotente."""
    global _learned_cache, _cache_loaded
    try:
        from app.models.learned_synonym import LearnedSynonym
        with Session(get_engine()) as db:
            rows = db.exec(select(LearnedSynonym)).all()
        _learned_cache = {r.label.lower(): r.canonical_field for r in rows}
        _cache_loaded = True
        _log.info("[synonym_loader] Caché cargada: %d sinónimos aprendidos.", len(_learned_cache))
    except Exception as e:
        _log.warning("[synonym_loader] No se pudo cargar caché de BD: %s", e)
        _cache_loaded = True  # evitar reintentos en bucle


def invalidate_cache() -> None:
    """Llama esto después de aprobar/rechazar un sinónimo en BD."""
    global _cache_loaded, _learned_cache
    _cache_loaded = False
    _load_learned_cache()
    _log.info("[synonym_loader] Caché invalidada y recargada.")


def resolve_field_enhanced(raw_label: str) -> tuple[str | None, str]:
    """Resuelve una etiqueta a su campo canónico.

    Orden de prioridad:
    1. Sinónimos aprendidos (BD) — exacto
    2. Diccionario estático (field_synonyms.py) — exacto
    3. fuzzy_resolve() con threshold 0.85 — aproximado

    Returns:
        (canonical_field | None, confianza: "alta" | "media" | "baja")
    """
    if not _cache_loaded:
        _load_learned_cache()

    normalized = " ".join(raw_label.strip().lower().split())

    # 1. Sinónimos aprendidos (mayor prioridad — corrigen el diccionario estático)
    if normalized in _learned_cache:
        return _learned_cache[normalized], "alta"

    # 2. Diccionario estático (exacto)
    result = resolve_field(normalized)
    if result:
        return result, "alta"

    # 3. Fuzzy con umbral alto
    canonical, _ = fuzzy_resolve(raw_label, threshold=0.85)
    if canonical:
        return canonical, "media"

    return None, "baja"


def get_all_synonyms_for_prompt() -> dict[str, list[str]]:
    """Devuelve el diccionario completo (estático + aprendido) para incluir en el prompt de Gemini.

    Gemini usa esto para entender qué campos existen y cómo se llaman.
    """
    if not _cache_loaded:
        _load_learned_cache()

    merged: dict[str, list[str]] = {k: list(v) for k, v in FIELD_SYNONYMS.items()}
    for label, canonical in _learned_cache.items():
        if canonical in merged and label not in merged[canonical]:
            merged[canonical].append(label)
    return merged
