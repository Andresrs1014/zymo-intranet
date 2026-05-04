# backend/app/services/extraction_pipeline.py
"""
Pipeline de extracción en dos fases.

FASE 1 (síncrona, ~1.2s):
  - Regex (cotizacion_parse) + extracción estructurada (extraction_utils)
  - Tabla de ítems (motor de encabezados)
  - Devuelve ExtraccionResult inmediatamente al usuario

FASE 2 (background, ~4-6s):
  - Gemini analiza el mismo PDF
  - Completa campos que quedaron None en Fase 1
  - Registra candidatos sin mapear en extraction_reviews
  - Incrementa veces_visto en learned_synonyms cuando reconoce etiquetas aprendidas
  - Guarda resultado parcheado en un archivo JSON temporal para que el frontend haga poll

Ver PLAN_B al final de este archivo si la arquitectura de poll genera problemas en producción.
"""
import json
import logging
from pathlib import Path
from typing import Optional

from app.services.number_utils import parse_cop

_log = logging.getLogger("zymo.extraction_pipeline")

# Directorio donde se guardan los resultados de Fase 2 para poll del frontend
_PHASE2_RESULTS_DIR = Path("/app/data/extraction_phase2")


def _ensure_dirs() -> None:
    _PHASE2_RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def run_phase1(
    contenido: bytes,
    ext: str,
    solicitud_id: str,
) -> dict:
    """Fase 1 síncrona: regex + fuzzy + sinónimos estáticos/aprendidos.

    Retorna dict compatible con ExtraccionResult de cotizaciones.py.
    No llama a Gemini. Nunca.
    """
    from app.services.cotizacion_parse import parsear_campos_cotizacion
    from app.services.extraction_utils import extraer_campos_estructurado
    from app.routers.oc.cotizaciones import _extraer_texto, _extraer_tabla_items

    extra: dict[str, str] = {}
    if ext in ("xlsx", "xls", "docx"):
        extra = extraer_campos_estructurado(contenido, ext)

    texto = _extraer_texto(contenido, ext)
    datos = parsear_campos_cotizacion(texto, extra)
    items_tabla = _extraer_tabla_items(contenido, ext)

    # Calcular cuántos campos se encontraron
    campos_encontrados = sum(1 for v in datos.values() if v is not None)
    if items_tabla:
        campos_encontrados += len(items_tabla)

    return {
        **datos,
        "items": items_tabla,
        "campos_encontrados": campos_encontrados,
        "phase2_disponible": False,  # el frontend lo monitorea
    }


async def run_phase2(
    contenido: bytes,
    ext: str,
    solicitud_id: str,
    phase1_result: dict,
) -> None:
    """Fase 2 en background: Gemini completa campos vacíos y alimenta aprendizaje.

    Persiste el resultado parcheado en /app/data/extraction_phase2/{solicitud_id}.json
    para que el frontend haga poll con GET .../extraccion/resultado/{solicitud_id}.

    Esta función es llamada con BackgroundTasks — sus excepciones no llegan al usuario.
    """
    _ensure_dirs()
    result_path = _PHASE2_RESULTS_DIR / f"{solicitud_id}.json"

    try:
        from app.services.extraction_ai import extraer_con_gemini
        ai_result = await extraer_con_gemini(
            contenido, ext, tipo_documento="cotizacion", contexto_id=solicitud_id
        )

        if not ai_result.exito:
            _log.warning("[phase2] Gemini falló para solicitud %s: %s", solicitud_id, ai_result.error)
            return

        # Parchar solo los campos que Fase 1 dejó vacíos
        patched = dict(phase1_result)
        campos_completados: list[str] = []

        for campo, extraido in ai_result.campos.items():
            if extraido.valor is None:
                continue
            # Solo parchar si Fase 1 no lo encontró
            if patched.get(campo) is None:
                # Convertir valores monetarios a float si aplica
                campos_monetarios = {"valor_unitario", "valor_antes_iva", "valor_iva", "valor_total"}
                if campo in campos_monetarios:
                    val_float = parse_cop(extraido.valor)
                    if val_float and val_float > 0:
                        patched[campo] = val_float
                        campos_completados.append(campo)
                else:
                    patched[campo] = extraido.valor
                    campos_completados.append(campo)

        patched["phase2_disponible"] = True
        patched["phase2_campos_completados"] = campos_completados
        patched["phase2_campos_count"] = len(campos_completados)

        # Guardar para poll
        result_path.write_text(
            json.dumps(patched, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

        _log.info(
            "[phase2] solicitud=%s campos_completados=%d: %s",
            solicitud_id, len(campos_completados), campos_completados,
        )

        # Registrar candidatos sin mapear en extraction_reviews
        if ai_result.candidatos_sin_mapear:
            _registrar_candidatos_bd(ai_result.candidatos_sin_mapear, solicitud_id)

        # Incrementar veces_visto para sinónimos aprendidos que se usaron
        _incrementar_veces_visto(ai_result.campos, solicitud_id)

    except Exception as e:
        _log.error("[phase2] Error inesperado solicitud=%s: %s", solicitud_id, e)


def get_phase2_result(solicitud_id: str) -> Optional[dict]:
    """Lee el resultado de Fase 2 del disco. Retorna None si aún no está listo."""
    path = _PHASE2_RESULTS_DIR / f"{solicitud_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        _log.warning("[phase2] No se pudo leer resultado de disco solicitud=%s: %s", solicitud_id, e)
        return None


def _registrar_candidatos_bd(candidatos: list[dict], solicitud_id: str) -> None:
    """Guarda candidatos sin mapear en extraction_reviews (estado: pendiente)."""
    try:
        from sqlmodel import Session, select
        from app.database import get_engine
        from app.models.extraction_review import ExtractionReview

        with Session(get_engine()) as db:
            labels = [
                (c.get("label") or "").strip().lower()
                for c in candidatos
                if len((c.get("label") or "").strip()) >= 2
            ]
            existing_labels = {
                r.label_raw
                for r in db.exec(
                    select(ExtractionReview).where(
                        ExtractionReview.label_raw.in_(labels),
                        ExtractionReview.estado == "pendiente",
                    )
                ).all()
            }
            for c in candidatos:
                label = (c.get("label") or "").strip().lower()
                if not label or len(label) < 2 or label in existing_labels:
                    continue
                db.add(ExtractionReview(
                    label_raw=label,
                    campo_sugerido=None,
                    confianza_ia="baja",
                    tipo_documento="cotizacion",
                    estado="pendiente",
                    contexto_id=solicitud_id,
                    fragmento_texto=(c.get("fragmento") or "")[:500],
                ))
            db.commit()
    except Exception as e:
        _log.warning("[phase2] No se pudieron registrar candidatos en BD: %s", e)


def _incrementar_veces_visto(campos: dict, solicitud_id: str) -> None:
    """Incrementa el contador veces_visto en learned_synonyms cuando Gemini usa etiqueta aprendida."""
    try:
        from sqlmodel import Session, select
        from app.database import get_engine
        from app.models.learned_synonym import LearnedSynonym

        etiquetas = [
            c.etiqueta_raw.strip().lower()
            for c in campos.values()
            if c.etiqueta_raw
        ]
        if not etiquetas:
            return

        with Session(get_engine()) as db:
            rows = db.exec(
                select(LearnedSynonym).where(LearnedSynonym.label.in_(etiquetas))
            ).all()
            for row in rows:
                row.veces_visto += 1
                db.add(row)
            db.commit()
    except Exception as e:
        _log.warning("[phase2] No se pudo incrementar veces_visto: %s", e)


# ──────────────────────────────────────────────────────────────────────────────
# PLAN B — Si el poll del frontend no funciona en producción
# ──────────────────────────────────────────────────────────────────────────────
#
# Si los auxiliares reportan que no notan los campos completados por Gemini,
# o si el poll genera peticiones excesivas al servidor, hay dos alternativas:
#
# OPCIÓN B1 — Desactivar Fase 2 completamente:
#   En cotizaciones.py, comentar la línea:
#     background_tasks.add_task(run_phase2, contenido, ext, str(solicitud_id), phase1_dict)
#   El sistema vuelve a ser 100% regex, sin cambios de usuario.
#   Gemini sigue disponible para el panel admin de clasificación de candidatos.
#
# OPCIÓN B2 — Gemini síncrono con timeout:
#   Reemplazar run_phase1() + schedule_phase2() por una sola llamada con timeout de 8s:
#     try:
#         resultado = await asyncio.wait_for(extraer_con_gemini(...), timeout=8.0)
#     except asyncio.TimeoutError:
#         resultado = phase1_fallback
#   Ventaja: formulario siempre completo. Desventaja: latencia ocasional de 8s.
#
# OPCIÓN B3 — WebSocket/SSE en lugar de poll:
#   El endpoint de extracción devuelve un stream SSE que envía el resultado parcial
#   de Fase 1 inmediatamente y completa con Fase 2 cuando termina.
#   Más complejo pero UX ideal. Implementar solo si B1/B2 no satisfacen.
# ──────────────────────────────────────────────────────────────────────────────
