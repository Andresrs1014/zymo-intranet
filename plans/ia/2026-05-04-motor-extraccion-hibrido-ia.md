# Motor de Extracción Híbrido IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el pipeline de extracción de cotizaciones por un motor híbrido de dos fases: el regex responde inmediatamente al auxiliar, Gemini corre en background para completar campos y alimentar el aprendizaje del diccionario, con un panel de revisión solo visible para el admin.

**Architecture:** Fase 1 (síncrona, ~1.2s): regex + fuzzy + sinónimos aprendidos en BD → respuesta inmediata al frontend. Fase 2 (background, ~4-6s): Gemini lee el PDF completo vía File API, llena campos vacíos, registra etiquetas candidatas; el admin aprueba nuevos sinónimos desde un panel; los sinónimos aprobados se cargan en runtime y reducen progresivamente las llamadas a Gemini.

**Tech Stack:** Python 3.12, FastAPI BackgroundTasks, SQLModel/SQLite, google-generativeai >= 0.8.0 (File API + JSON mode), React 19, React Query 5, Tailwind CSS, TypeScript 5.

---

## ⚠️ Nota de arquitectura: Two-Phase como prueba

El diseño de dos fases (regex síncrono + Gemini en background) es la apuesta principal para resolver latencia. **Si en producción se detecta que el poll del frontend genera fricción o que los auxiliares no notan los campos completados a posteriori**, existe un plan B documentado al final de este archivo. No cambiar la arquitectura sin leer esa sección primero.

---

## Mapa de archivos

### Crear (backend)
| Archivo | Responsabilidad única |
|---|---|
| `backend/app/models/learned_synonym.py` | Tabla `learned_synonyms`: sinónimos aprobados por el admin |
| `backend/app/models/extraction_review.py` | Tabla `extraction_reviews`: cola de revisión de candidatos propuestos por Gemini |
| `backend/app/services/synonym_loader.py` | Carga sinónimos estáticos + BD; expone `resolve_field_enhanced()` y `get_all_synonyms_for_prompt()` |
| `backend/app/services/extraction_ai.py` | Llama a Gemini con el PDF (File API); devuelve `AIExtractionResult` con confianza por campo y candidatos |
| `backend/app/services/extraction_pipeline.py` | Orquesta Fase 1 (regex) + Fase 2 (Gemini background); expone `run_phase1()` y `schedule_phase2()` |
| `backend/app/routers/admin/__init__.py` | Paquete vacío |
| `backend/app/routers/admin/extraccion.py` | Endpoints admin: cola de revisión, aprobar/rechazar, métricas, sinónimos aprendidos |

### Modificar (backend)
| Archivo | Cambio |
|---|---|
| `backend/app/database.py` | Agregar `learned_synonyms` y `extraction_reviews` a `create_db_and_tables()` |
| `backend/app/main.py` | Registrar router admin; invalidar cache de `synonym_loader` al arrancar |
| `backend/app/routers/oc/cotizaciones.py` | `extraer_cotizacion()` usa `run_phase1()` + `schedule_phase2()`; agregar endpoint `GET .../extraccion/resultado/{solicitud_id}` para poll |

### Crear (frontend)
| Archivo | Responsabilidad única |
|---|---|
| `frontend/src/hooks/useExtraccionIA.ts` | React Query: cola de revisión, aprobar/rechazar, métricas, poll resultado fase 2 |
| `frontend/src/pages/admin/ExtraccionIAPage.tsx` | Panel admin: cola de candidatos, sinónimos aprendidos, métricas de ahorro |

### Modificar (frontend)
| Archivo | Cambio |
|---|---|
| `frontend/src/pages/oc/CotizacionFormPage.tsx` | Poll silencioso post-extracción; banner "IA completó N campos" con botón aplicar |
| `frontend/src/components/layout/Sidebar.tsx` | Enlace al panel admin (solo si `role === "admin"`) |
| `frontend/src/App.tsx` | Ruta `/admin/extraccion-ia` |

---

## Task 1: Modelos SQLModel — `learned_synonyms` y `extraction_reviews`

**Files:**
- Create: `backend/app/models/learned_synonym.py`
- Create: `backend/app/models/extraction_review.py`
- Modify: `backend/app/database.py`

- [ ] **Paso 1: Crear `learned_synonym.py`**

```python
# backend/app/models/learned_synonym.py
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class LearnedSynonym(SQLModel, table=True):
    __tablename__ = "learned_synonyms"

    id: Optional[int] = Field(default=None, primary_key=True)
    label: str = Field(nullable=False, max_length=200)
    # Nombre canónico del campo: debe ser una clave de FIELD_SYNONYMS
    # Ej: "valor_antes_iva", "forma_pago", "proveedor_nit"
    canonical_field: str = Field(nullable=False, max_length=100)
    # Tipo de documento donde se encontró: "cotizacion" | "factura"
    tipo_documento: str = Field(default="cotizacion", max_length=50)
    aprobado_por_id: int = Field(nullable=False)          # user.id del admin que aprobó
    aprobado_por_email: str = Field(nullable=False, max_length=200)
    # Cuántas veces se ha visto esta etiqueta en documentos (incrementado en background)
    veces_visto: int = Field(default=1)
    creado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Paso 2: Crear `extraction_review.py`**

```python
# backend/app/models/extraction_review.py
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class ExtractionReview(SQLModel, table=True):
    __tablename__ = "extraction_reviews"

    id: Optional[int] = Field(default=None, primary_key=True)
    # Etiqueta cruda tal como la vio Gemini en el documento
    label_raw: str = Field(nullable=False, max_length=200)
    # Campo canónico que Gemini sugiere (puede ser None si Gemini no supo)
    campo_sugerido: Optional[str] = Field(default=None, max_length=100)
    # Confianza de Gemini: "alta" | "media" | "baja"
    confianza_ia: str = Field(default="media", max_length=20)
    # Tipo de documento: "cotizacion" | "factura"
    tipo_documento: str = Field(default="cotizacion", max_length=50)
    # Estado: "pendiente" | "aprobado" | "rechazado"
    estado: str = Field(default="pendiente", max_length=20)
    # ID de solicitud o factura de donde vino (para trazabilidad)
    contexto_id: Optional[str] = Field(default=None, max_length=100)
    # Fragmento de texto donde Gemini encontró la etiqueta (para contexto visual en UI)
    fragmento_texto: Optional[str] = Field(default=None, max_length=500)
    revisado_por_id: Optional[int] = Field(default=None)
    revisado_por_email: Optional[str] = Field(default=None, max_length=200)
    creado_en: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    revisado_en: Optional[datetime] = Field(default=None)
```

- [ ] **Paso 3: Agregar las 2 tablas a `database.py`**

Abrir `backend/app/database.py`. Localizar `create_db_and_tables()`. Agregar:

```python
def create_db_and_tables() -> None:
    """Crea solo las tablas de la intranet en intranet.db."""
    from app.models.user import User
    from app.models.role import Role
    from app.models.area import Area
    from app.models.sede import Sede
    from app.models.draft import FormDraft
    from app.models.learned_synonym import LearnedSynonym      # ← agregar
    from app.models.extraction_review import ExtractionReview  # ← agregar

    intranet_table_names = {
        "user", "role", "area", "sede", "form_drafts",
        "learned_synonyms", "extraction_reviews",              # ← agregar
    }
    tables = [
        SQLModel.metadata.tables[t]
        for t in intranet_table_names
        if t in SQLModel.metadata.tables
    ]
    SQLModel.metadata.create_all(get_engine(), tables=tables)
```

- [ ] **Paso 4: Verificar que los modelos importan sin error**

```bash
cd backend
python -c "from app.models.learned_synonym import LearnedSynonym; from app.models.extraction_review import ExtractionReview; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Paso 5: Commit**

```bash
git add backend/app/models/learned_synonym.py backend/app/models/extraction_review.py backend/app/database.py
git commit -m "feat(extraccion): modelos SQLModel learned_synonyms y extraction_reviews"
```

---

## Task 2: `synonym_loader.py` — Resolver campos con estáticos + BD

**Files:**
- Create: `backend/app/services/synonym_loader.py`

Este servicio es el puente entre el diccionario hardcoded y los sinónimos aprendidos. El motor de extracción lo llama en lugar de llamar `resolve_field()` directamente.

- [ ] **Paso 1: Crear el servicio**

```python
# backend/app/services/synonym_loader.py
"""
Resuelve etiquetas de documentos a campos canónicos.
Combina el diccionario estático (field_synonyms.py) con
los sinónimos aprendidos y aprobados en BD (learned_synonyms).

Carga los sinónimos de BD una sola vez por proceso (caché en memoria).
Llamar a invalidate_cache() después de aprobar un nuevo sinónimo.
"""
import logging
from functools import lru_cache
from typing import Optional

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
    global _cache_loaded
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
    result = resolve_field(raw_label)
    if result:
        return result, "alta"

    # 3. Fuzzy con umbral alto
    canonical, score = fuzzy_resolve(raw_label, threshold=0.85)
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
```

- [ ] **Paso 2: Verificar import**

```bash
cd backend
python -c "from app.services.synonym_loader import resolve_field_enhanced; print(resolve_field_enhanced('nit proveedor'))"
```
Resultado esperado: `('proveedor_nit', 'alta')`

- [ ] **Paso 3: Commit**

```bash
git add backend/app/services/synonym_loader.py
git commit -m "feat(extraccion): synonym_loader combina sinónimos estáticos y aprendidos"
```

---

## Task 3: `extraction_ai.py` — Integración Gemini con PDF nativo

**Files:**
- Create: `backend/app/services/extraction_ai.py`

Este es el servicio que llama a Gemini. **Solo se debe llamar desde background tasks**, nunca en el path síncrono de respuesta al usuario.

- [ ] **Paso 1: Crear el servicio**

```python
# backend/app/services/extraction_ai.py
"""
Extracción de campos de documentos usando Gemini File API.

IMPORTANTE: Este servicio hace llamadas de red a la API de Google.
Llamarlo SIEMPRE desde BackgroundTasks de FastAPI, nunca en el path síncrono.

Semáforo global MAX_CONCURRENT=2 para no saturar rate limits de Gemini.
"""
import asyncio
import json
import logging
import tempfile
from pathlib import Path
from typing import Optional

import google.generativeai as genai
from pydantic import BaseModel

from app.config import settings

_log = logging.getLogger("zymo.extraction_ai")

# Semáforo: máximo 2 llamadas Gemini simultáneas
_semaphore = asyncio.Semaphore(2)

# Campos canónicos que Gemini debe intentar extraer
CAMPOS_COTIZACION = [
    "proveedor_nombre", "proveedor_nit", "numero_cotizacion_proveedor",
    "valor_unitario", "valor_antes_iva", "valor_iva", "valor_total",
    "forma_pago", "plazo_entrega", "garantia", "anticipo", "pago_saldo",
]

CAMPOS_FACTURA = [
    "numero_factura", "fecha_factura", "valor_factura",
    "nit_proveedor", "nombre_proveedor",
]


class CampoExtraido(BaseModel):
    valor: Optional[str] = None
    confianza: str = "baja"      # "alta" | "media" | "baja"
    etiqueta_raw: Optional[str] = None  # cómo aparecía en el documento


class AIExtractionResult(BaseModel):
    campos: dict[str, CampoExtraido] = {}
    # Etiquetas que Gemini vio en el documento pero no supo mapear
    candidatos_sin_mapear: list[dict] = []
    # True si Gemini respondió con JSON válido
    exito: bool = False
    error: Optional[str] = None


def _build_prompt(tipo_documento: str, synonyms_hint: dict[str, list[str]]) -> str:
    campos = CAMPOS_COTIZACION if tipo_documento == "cotizacion" else CAMPOS_FACTURA

    campos_desc = "\n".join(
        f'- "{c}": variantes conocidas → {synonyms_hint.get(c, [])[:5]}'
        for c in campos
    )

    return f"""Eres un extractor de datos de documentos comerciales colombianos.

Analiza el documento adjunto ({tipo_documento}) y extrae los siguientes campos:

{campos_desc}

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{{
  "campos": {{
    "nombre_del_campo": {{
      "valor": "valor extraído como string, null si no se encuentra",
      "confianza": "alta|media|baja",
      "etiqueta_raw": "texto exacto del encabezado en el documento"
    }}
  }},
  "candidatos_sin_mapear": [
    {{"label": "etiqueta vista en doc", "valor": "valor asociado", "fragmento": "línea de contexto"}}
  ]
}}

Reglas:
- confianza "alta": etiqueta explícita y valor numérico/texto claro
- confianza "media": inferido por contexto o etiqueta ambigua
- confianza "baja": deducción incierta
- candidatos_sin_mapear: etiquetas con valores que NO corresponden a ningún campo de la lista
- Valores monetarios: string con el número tal como aparece (ej: "1.250.000" o "1250000")
- NO inventes valores — si no está en el documento, usa null
"""


async def extraer_con_gemini(
    contenido_bytes: bytes,
    ext: str,
    tipo_documento: str = "cotizacion",
    contexto_id: Optional[str] = None,
) -> AIExtractionResult:
    """Llama a Gemini con el PDF/Excel y retorna campos extraídos con confianza.

    Args:
        contenido_bytes: Bytes del archivo original.
        ext: Extensión del archivo ("pdf", "xlsx", "docx").
        tipo_documento: "cotizacion" | "factura".
        contexto_id: ID de solicitud o factura (solo para logging).

    Returns:
        AIExtractionResult con campos y candidatos.
    """
    if not settings.gemini_api_key:
        return AIExtractionResult(exito=False, error="GEMINI_API_KEY no configurada.")

    from app.services.synonym_loader import get_all_synonyms_for_prompt
    synonyms_hint = get_all_synonyms_for_prompt()

    # MIME types soportados por Gemini File API
    mime_map = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    mime_type = mime_map.get(ext, "application/octet-stream")

    async with _semaphore:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(settings.gemini_model)

            # Gemini File API: subir en archivo temporal
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(contenido_bytes)
                tmp_path = tmp.name

            uploaded = genai.upload_file(tmp_path, mime_type=mime_type)
            Path(tmp_path).unlink(missing_ok=True)

            prompt = _build_prompt(tipo_documento, synonyms_hint)

            response = await model.generate_content_async(
                [uploaded, prompt],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,  # Determinístico — no queremos creatividad
                ),
            )

            # Limpiar el archivo de Gemini (buena práctica)
            try:
                genai.delete_file(uploaded.name)
            except Exception:
                pass

            raw = response.text.strip()
            data = json.loads(raw)

            campos_parsed: dict[str, CampoExtraido] = {}
            for campo, info in data.get("campos", {}).items():
                campos_parsed[campo] = CampoExtraido(
                    valor=info.get("valor"),
                    confianza=info.get("confianza", "baja"),
                    etiqueta_raw=info.get("etiqueta_raw"),
                )

            _log.info(
                "[extraction_ai] contexto=%s tipo=%s campos=%d candidatos=%d",
                contexto_id, tipo_documento,
                len(campos_parsed),
                len(data.get("candidatos_sin_mapear", [])),
            )

            return AIExtractionResult(
                campos=campos_parsed,
                candidatos_sin_mapear=data.get("candidatos_sin_mapear", []),
                exito=True,
            )

        except Exception as e:
            _log.error("[extraction_ai] Error contexto=%s: %s", contexto_id, e)
            return AIExtractionResult(exito=False, error=str(e))
```

- [ ] **Paso 2: Verificar import (sin ejecutar la llamada)**

```bash
cd backend
python -c "from app.services.extraction_ai import extraer_con_gemini, AIExtractionResult; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Paso 3: Commit**

```bash
git add backend/app/services/extraction_ai.py
git commit -m "feat(extraccion): extraction_ai.py — Gemini File API con semáforo y JSON mode"
```

---

## Task 4: `extraction_pipeline.py` — Orquestador de dos fases

**Files:**
- Create: `backend/app/services/extraction_pipeline.py`

Este es el corazón de la arquitectura. Fase 1 es síncrona y devuelve resultado inmediato. Fase 2 corre en background, completa campos vacíos y registra candidatos para aprendizaje.

- [ ] **Paso 1: Crear el orquestador**

```python
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
    except Exception:
        return None


def _registrar_candidatos_bd(candidatos: list[dict], solicitud_id: str) -> None:
    """Guarda candidatos sin mapear en extraction_reviews (estado: pendiente)."""
    try:
        from datetime import datetime, timezone
        from sqlmodel import Session, select
        from app.database import get_engine
        from app.models.extraction_review import ExtractionReview

        with Session(get_engine()) as db:
            for c in candidatos:
                label = (c.get("label") or "").strip().lower()
                if not label or len(label) < 2:
                    continue
                # No duplicar si ya existe pendiente
                exists = db.exec(
                    select(ExtractionReview).where(
                        ExtractionReview.label_raw == label,
                        ExtractionReview.estado == "pendiente",
                    )
                ).first()
                if exists:
                    continue
                db.add(ExtractionReview(
                    label_raw=label,
                    campo_sugerido=None,  # Gemini no supo → admin decide
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
            for label in etiquetas:
                row = db.exec(
                    select(LearnedSynonym).where(LearnedSynonym.label == label)
                ).first()
                if row:
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
```

- [ ] **Paso 2: Verificar import**

```bash
cd backend
python -c "from app.services.extraction_pipeline import run_phase1, run_phase2, get_phase2_result; print('OK')"
```
Resultado esperado: `OK`

- [ ] **Paso 3: Commit**

```bash
git add backend/app/services/extraction_pipeline.py
git commit -m "feat(extraccion): pipeline dos fases — phase1 síncrono, phase2 Gemini background"
```

---

## Task 5: Modificar `cotizaciones.py` — Conectar el pipeline

**Files:**
- Modify: `backend/app/routers/oc/cotizaciones.py`

Dos cambios quirúrgicos: (1) `extraer_cotizacion()` usa el nuevo pipeline, (2) nuevo endpoint de poll para Fase 2.

- [ ] **Paso 1: Modificar `extraer_cotizacion()` para usar pipeline**

Localizar la función `extraer_cotizacion` (~línea 596). Reemplazar su cuerpo interno:

```python
# ANTES (borrar estas líneas dentro de extraer_cotizacion):
#   items_tabla = _extraer_tabla_items(contenido, ext)
#   extra: dict[str, str] = {}
#   if ext in ("xlsx", "xls", "docx"):
#       extra = _extraer_campos_estructurado(contenido, ext)
#   texto = _extraer_texto(contenido, ext)
#   resultado = _parsear_campos(texto, extra)
#   if items_tabla: ...
#   resultado.nombre_archivo = nombre
#   try: guardar temp ...
#   return resultado

# DESPUÉS — reemplazar con:
async def extraer_cotizacion(
    solicitud_id: uuid.UUID,
    background_tasks: BackgroundTasks,        # ← agregar parámetro
    file: UploadFile = File(...),
    current_user: User = Depends(require_compras),
    oc_db: Session = Depends(get_oc_db),
):
    """Extrae campos de un PDF/Excel/Word de cotización sin guardar nada.

    Fase 1 (síncrona): regex + sinónimos → respuesta inmediata.
    Fase 2 (background): Gemini completa campos vacíos, alimenta aprendizaje.
    El frontend hace poll a GET .../extraccion/resultado/{solicitud_id} para Fase 2.
    """
    from app.services.extraction_pipeline import run_phase1, run_phase2

    solicitud = oc_db.get(SolicitudOC, solicitud_id)
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    nombre = file.filename or ""
    ext = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
    if ext not in ("pdf", "xlsx", "xls", "docx"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Formato no soportado. Use PDF, Excel (.xlsx) o Word (.docx).",
        )

    contenido = await file.read()

    # ── Fase 1: síncrona ──────────────────────────────────────────────────────
    phase1_dict = run_phase1(contenido, ext, str(solicitud_id))

    resultado = ExtraccionResult(
        proveedor_nit=phase1_dict.get("proveedor_nit"),
        numero_cotizacion_proveedor=phase1_dict.get("numero_cotizacion_proveedor"),
        proveedor_nombre=phase1_dict.get("proveedor_nombre"),
        valor_unitario=phase1_dict.get("valor_unitario"),
        valor_antes_iva=phase1_dict.get("valor_antes_iva"),
        valor_iva=phase1_dict.get("valor_iva"),
        valor_total=phase1_dict.get("valor_total"),
        forma_pago=phase1_dict.get("forma_pago"),
        plazo_entrega=phase1_dict.get("plazo_entrega"),
        garantia=phase1_dict.get("garantia"),
        anticipo=phase1_dict.get("anticipo"),
        pago_saldo=phase1_dict.get("pago_saldo"),
        items=[ItemCotizacion(**i) for i in (phase1_dict.get("items") or [])],
        nombre_archivo=nombre,
        campos_encontrados=phase1_dict.get("campos_encontrados", 0),
    )

    # Guardar archivo temporal (igual que antes)
    try:
        _COTIZACIONES_DIR.mkdir(parents=True, exist_ok=True)
        temp_path = _COTIZACIONES_DIR / f"temp_{solicitud_id}.{ext}"
        temp_path.write_bytes(contenido)
        resultado.temp_file_ext = ext
    except Exception as e:
        log.warning("[extraccion] No se pudo guardar archivo temporal %s: %s", solicitud_id, e)

    # ── Fase 2: background (Gemini) ───────────────────────────────────────────
    # Solo lanzar si hay campos vacíos que Gemini podría completar
    campos_vacios = sum(1 for v in [
        resultado.proveedor_nit, resultado.proveedor_nombre, resultado.valor_total,
        resultado.forma_pago, resultado.plazo_entrega, resultado.garantia,
    ] if v is None)

    if campos_vacios > 0 and settings.gemini_api_key:
        background_tasks.add_task(
            run_phase2, contenido, ext, str(solicitud_id), phase1_dict
        )
        log.info("[extraccion] Fase 2 programada para solicitud %s (%d campos vacíos)", solicitud_id, campos_vacios)

    return resultado
```

- [ ] **Paso 2: Agregar endpoint de poll para Fase 2**

Justo DESPUÉS del endpoint `extraer_cotizacion`, agregar:

```python
@router.get(
    "/solicitudes/{solicitud_id}/cotizacion/extraccion/resultado",
    status_code=status.HTTP_200_OK,
)
def get_extraccion_resultado(
    solicitud_id: uuid.UUID,
    current_user: User = Depends(require_compras),
):
    """Poll: retorna el resultado de Fase 2 (Gemini) cuando esté disponible.

    Retorna 204 si Fase 2 aún no terminó.
    Retorna 200 + JSON con campos completados cuando esté listo.
    """
    from app.services.extraction_pipeline import get_phase2_result
    result = get_phase2_result(str(solicitud_id))
    if result is None:
        from fastapi.responses import Response
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return result
```

- [ ] **Paso 3: Verificar que el router arranca sin errores**

```bash
cd backend
python -c "from app.routers.oc.cotizaciones import router; print('Router OK, rutas:', len(router.routes))"
```
Resultado esperado: `Router OK, rutas: N` (número mayor que el anterior)

- [ ] **Paso 4: Commit**

```bash
git add backend/app/routers/oc/cotizaciones.py
git commit -m "feat(extraccion): cotizaciones usa pipeline dos fases + endpoint poll fase 2"
```

---

## Task 6: Router admin `extraccion.py` — Panel de revisión

**Files:**
- Create: `backend/app/routers/admin/__init__.py`
- Create: `backend/app/routers/admin/extraccion.py`
- Modify: `backend/app/main.py`

- [ ] **Paso 1: Crear `__init__.py` vacío**

```bash
touch backend/app/routers/admin/__init__.py
```

- [ ] **Paso 2: Crear `extraccion.py`**

```python
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

from app.core.deps import get_current_user, get_db, require_admin
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
    campo_sugerido: Optional[str]
    confianza_ia: str
    tipo_documento: str
    estado: str
    contexto_id: Optional[str]
    fragmento_texto: Optional[str]
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
):
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
):
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
```

- [ ] **Paso 3: Registrar el router en `main.py`**

En `main.py`, agregar junto a los otros imports de routers:

```python
from app.routers.admin.extraccion import router as admin_extraccion_router
```

Y en la sección `app.include_router(...)`:

```python
app.include_router(admin_extraccion_router)
```

- [ ] **Paso 4: Verificar que el backend arranca**

```bash
cd backend
python -c "from app.main import app; print('App OK, rutas:', len(app.routes))"
```
Resultado esperado: `App OK, rutas: N`

- [ ] **Paso 5: Commit**

```bash
git add backend/app/routers/admin/__init__.py backend/app/routers/admin/extraccion.py backend/app/main.py
git commit -m "feat(extraccion): router admin para cola de revisión y sinónimos aprendidos"
```

---

## Task 7: Frontend — `useExtraccionIA.ts` + poll de Fase 2

**Files:**
- Create: `frontend/src/hooks/useExtraccionIA.ts`

- [ ] **Paso 1: Crear el hook**

```typescript
// frontend/src/hooks/useExtraccionIA.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: number
  label_raw: string
  campo_sugerido: string | null
  confianza_ia: "alta" | "media" | "baja"
  tipo_documento: string
  estado: "pendiente" | "aprobado" | "rechazado"
  contexto_id: string | null
  fragmento_texto: string | null
  creado_en: string
}

export interface LearnedSynonym {
  id: number
  label: string
  canonical_field: string
  tipo_documento: string
  aprobado_por_email: string
  veces_visto: number
  creado_en: string
}

export interface ExtraccionMetricas {
  total_candidatos: number
  pendientes: number
  aprobados: number
  rechazados: number
  total_sinonimos_aprendidos: number
  campos_canonicos_disponibles: string[]
}

export interface Phase2Result {
  phase2_disponible: boolean
  phase2_campos_completados: string[]
  phase2_campos_count: number
  [key: string]: unknown
}

// ── Hooks admin ───────────────────────────────────────────────────────────────

export function useColaCandidatos(estado = "pendiente") {
  return useQuery({
    queryKey: ["extraccion-ia", "cola", estado],
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data } = await api.get(`/api/admin/extraccion/cola?estado=${estado}`)
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useAprobarCandidato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, canonical_field }: { id: number; canonical_field: string }) => {
      const { data } = await api.post(`/api/admin/extraccion/${id}/aprobar`, { canonical_field })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraccion-ia"] })
    },
  })
}

export function useRechazarCandidato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/admin/extraccion/${id}/rechazar`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraccion-ia"] })
    },
  })
}

export function useSinonimosAprendidos() {
  return useQuery({
    queryKey: ["extraccion-ia", "sinonimos"],
    queryFn: async (): Promise<LearnedSynonym[]> => {
      const { data } = await api.get("/api/admin/extraccion/sinonimos")
      return data
    },
  })
}

export function useEliminarSinonimo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/admin/extraccion/sinonimos/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraccion-ia"] })
    },
  })
}

export function useMetricasExtraccion() {
  return useQuery({
    queryKey: ["extraccion-ia", "metricas"],
    queryFn: async (): Promise<ExtraccionMetricas> => {
      const { data } = await api.get("/api/admin/extraccion/metricas")
      return data
    },
    staleTime: 60_000,
  })
}

// ── Poll Fase 2 (usado en CotizacionFormPage) ─────────────────────────────────

export function usePhase2Poll(
  solicitudId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["extraccion-phase2", solicitudId],
    queryFn: async (): Promise<Phase2Result | null> => {
      const { data, status } = await api.get(
        `/api/oc/solicitudes/${solicitudId}/cotizacion/extraccion/resultado`,
        { validateStatus: (s) => s === 200 || s === 204 }
      )
      if (status === 204) return null  // Gemini aún procesando
      return data as Phase2Result
    },
    enabled: !!solicitudId && enabled,
    refetchInterval: (query) => {
      // Dejar de hacer poll cuando Fase 2 esté disponible
      if (query.state.data?.phase2_disponible) return false
      return 2500  // Poll cada 2.5s mientras espera
    },
    retry: false,
  })
}
```

- [ ] **Paso 2: Verificar que TypeScript compila**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep useExtraccionIA || echo "Sin errores en useExtraccionIA"
```

- [ ] **Paso 3: Commit**

```bash
git add frontend/src/hooks/useExtraccionIA.ts
git commit -m "feat(extraccion): hook useExtraccionIA con poll Fase 2 y endpoints admin"
```

---

## Task 8: Frontend — Banner Fase 2 en `CotizacionFormPage`

**Files:**
- Modify: `frontend/src/pages/oc/CotizacionFormPage.tsx`

Agregar el poll silencioso y el banner "IA completó N campos — click para aplicar". **No tocar ninguna lógica de negocio existente.**

- [ ] **Paso 1: Leer el archivo para identificar dónde se aplica el resultado de extracción**

Buscar en `CotizacionFormPage.tsx` el lugar donde se hace `setForm` con el resultado del `extraer`. Será algo como `onSuccess` de la mutation de extracción. Ese es el punto donde también se aplicarán los datos de Fase 2.

- [ ] **Paso 2: Agregar imports**

```typescript
import { usePhase2Poll } from "@/hooks/useExtraccionIA"
import type { Phase2Result } from "@/hooks/useExtraccionIA"
```

- [ ] **Paso 3: Agregar estado y poll dentro del componente**

```typescript
// Agregar junto a los otros useState:
const [phase2Applied, setPhase2Applied] = useState(false)
const [phase2Pending, setPhase2Pending] = useState(false)
const [phase2Result, setPhase2Result] = useState<Phase2Result | null>(null)

// Poll de Fase 2 — activo solo después de subir un archivo
const { data: phase2Data } = usePhase2Poll(id, phase2Pending)

// Cuando Fase 2 llega, guardar el resultado pero NO aplicar automáticamente
useEffect(() => {
  if (phase2Data?.phase2_disponible && !phase2Applied) {
    setPhase2Result(phase2Data)
    setPhase2Pending(false)
  }
}, [phase2Data, phase2Applied])

// Activar poll cuando el usuario sube el archivo de extracción
// Buscar el onSuccess de la mutación de extracción y agregar:
//   setPhase2Pending(true)
//   setPhase2Applied(false)
//   setPhase2Result(null)
```

- [ ] **Paso 4: Función para aplicar resultado de Fase 2**

```typescript
function aplicarFase2() {
  if (!phase2Result) return
  const CAMPOS_MONETARIOS = new Set(["valor_unitario", "valor_antes_iva", "valor_iva", "valor_total"])

  setForm((prev) => {
    const next = { ...prev }
    for (const campo of (phase2Result.phase2_campos_completados as string[])) {
      const valor = phase2Result[campo]
      if (valor != null && (next as Record<string, unknown>)[campo] == null) {
        (next as Record<string, unknown>)[campo] = CAMPOS_MONETARIOS.has(campo)
          ? Number(valor)
          : String(valor)
      }
    }
    return next
  })
  setPhase2Applied(true)
  setPhase2Result(null)
}
```

- [ ] **Paso 5: Agregar banner en JSX**

Agregar justo DESPUÉS del área de upload del archivo, ANTES del formulario de campos:

```tsx
{/* Banner Fase 2 — aparece cuando Gemini completó campos adicionales */}
{phase2Result && !phase2Applied && (
  <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
    <div className="flex items-center gap-2 text-blue-700">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd"/>
      </svg>
      <span>
        IA completó{" "}
        <strong>{phase2Result.phase2_campos_count as number} campo{(phase2Result.phase2_campos_count as number) !== 1 ? "s" : ""}</strong>
        {" "}adicional{(phase2Result.phase2_campos_count as number) !== 1 ? "es" : ""} que el motor no encontró.
      </span>
    </div>
    <button
      type="button"
      onClick={aplicarFase2}
      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
    >
      Aplicar campos
    </button>
  </div>
)}

{/* Indicador mientras Gemini procesa en background */}
{phase2Pending && (
  <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
    <svg className="animate-spin h-3.5 w-3.5 text-brand-blue" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
    IA analizando el documento en segundo plano…
  </div>
)}
```

- [ ] **Paso 6: Verificar que TypeScript compila sin errores**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep CotizacionFormPage || echo "Sin errores en CotizacionFormPage"
```

- [ ] **Paso 7: Commit**

```bash
git add frontend/src/pages/oc/CotizacionFormPage.tsx
git commit -m "feat(extraccion): banner fase 2 en CotizacionFormPage con poll y botón aplicar"
```

---

## Task 9: Frontend — `ExtraccionIAPage.tsx` (panel admin)

**Files:**
- Create: `frontend/src/pages/admin/ExtraccionIAPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Paso 1: Crear la página**

```typescript
// frontend/src/pages/admin/ExtraccionIAPage.tsx
import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { useAuthStore } from "@/store/authStore"
import {
  useColaCandidatos, useAprobarCandidato, useRechazarCandidato,
  useSinonimosAprendidos, useEliminarSinonimo, useMetricasExtraccion,
} from "@/hooks/useExtraccionIA"

type Tab = "cola" | "sinonimos" | "metricas"

export function ExtraccionIAPage() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>("cola")
  const [campoSeleccionado, setCampoSeleccionado] = useState<Record<number, string>>({})

  const { data: cola = [], isLoading: loadingCola } = useColaCandidatos("pendiente")
  const { data: sinonimos = [] } = useSinonimosAprendidos()
  const { data: metricas } = useMetricasExtraccion()
  const aprobar = useAprobarCandidato()
  const rechazar = useRechazarCandidato()
  const eliminar = useEliminarSinonimo()

  if (user?.role !== "admin") {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar title="Admin" />
          <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Acceso restringido — solo administradores.
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Admin — Motor de Extracción IA" />
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Motor de Extracción IA</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Revisa candidatos, aprueba sinónimos y monitorea el aprendizaje del motor.
            </p>
          </div>

          {/* Métricas rápidas */}
          {metricas && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Pendientes de revisión", value: metricas.pendientes, color: "text-amber-600" },
                { label: "Aprobados", value: metricas.aprobados, color: "text-green-600" },
                { label: "Rechazados", value: metricas.rechazados, color: "text-red-500" },
                { label: "Sinónimos aprendidos", value: metricas.total_sinonimos_aprendidos, color: "text-brand-blue" },
              ].map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-6">
            {(["cola", "sinonimos", "metricas"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "cola" ? `Cola de revisión${metricas?.pendientes ? ` (${metricas.pendientes})` : ""}` : t === "sinonimos" ? "Sinónimos aprendidos" : "Campos canónicos"}
              </button>
            ))}
          </div>

          {/* Tab: Cola de revisión */}
          {tab === "cola" && (
            <div className="space-y-3">
              {loadingCola && <p className="text-sm text-gray-400">Cargando…</p>}
              {!loadingCola && cola.length === 0 && (
                <div className="flex flex-col items-center py-16 text-gray-400">
                  <p className="text-sm">No hay candidatos pendientes de revisión.</p>
                  <p className="text-xs mt-1">Cuando Gemini encuentre etiquetas desconocidas en cotizaciones, aparecerán aquí.</p>
                </div>
              )}
              {cola.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-gray-900">"{item.label_raw}"</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.confianza_ia === "alta" ? "bg-green-100 text-green-700" :
                          item.confianza_ia === "media" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-600"
                        }`}>
                          {item.confianza_ia}
                        </span>
                      </div>
                      {item.fragmento_texto && (
                        <p className="text-xs text-gray-400 italic truncate max-w-lg">
                          Contexto: "{item.fragmento_texto}"
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Solicitud: {item.contexto_id ?? "—"} · {new Date(item.creado_en).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <select
                        value={campoSeleccionado[item.id] ?? ""}
                        onChange={(e) => setCampoSeleccionado((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                      >
                        <option value="">Seleccionar campo…</option>
                        {metricas?.campos_canonicos_disponibles.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!campoSeleccionado[item.id] || aprobar.isPending}
                        onClick={() => aprobar.mutate({ id: item.id, canonical_field: campoSeleccionado[item.id] })}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={rechazar.isPending}
                        onClick={() => rechazar.mutate(item.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Sinónimos aprendidos */}
          {tab === "sinonimos" && (
            <div>
              {sinonimos.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">Aún no hay sinónimos aprendidos.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-gray-500 uppercase border-b border-gray-100 bg-gray-50 text-left">
                        <th className="px-4 py-2">Etiqueta aprendida</th>
                        <th className="px-4 py-2">Campo canónico</th>
                        <th className="px-4 py-2">Veces usada</th>
                        <th className="px-4 py-2">Aprobado por</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sinonimos.map((s) => (
                        <tr key={s.id} className="text-gray-700">
                          <td className="px-4 py-2.5 font-mono text-xs">"{s.label}"</td>
                          <td className="px-4 py-2.5 text-brand-blue font-medium text-xs">{s.canonical_field}</td>
                          <td className="px-4 py-2.5 text-gray-500">{s.veces_visto}×</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{s.aprobado_por_email}</td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => eliminar.mutate(s.id)}
                              className="text-xs text-red-500 hover:text-red-700 transition-colors"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Campos canónicos disponibles */}
          {tab === "metricas" && metricas && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Campos canónicos del motor</h2>
              <div className="flex flex-wrap gap-2">
                {metricas.campos_canonicos_disponibles.map((c) => (
                  <span key={c} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-600">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Paso 2: Agregar ruta en `App.tsx`**

Buscar donde están las otras rutas protegidas y agregar:
```typescript
import { ExtraccionIAPage } from "@/pages/admin/ExtraccionIAPage"
// ...
<Route path="/admin/extraccion-ia" element={<ExtraccionIAPage />} />
```

- [ ] **Paso 3: Agregar enlace en `Sidebar.tsx`**

Buscar el bloque de navegación del sidebar. Agregar un item visible SOLO para admin:
```typescript
// Dentro del sidebar, busca la lista de items de navegación:
{user?.role === "admin" && (
  <NavItem
    to="/admin/extraccion-ia"
    label="Motor IA"
    // Usar el mismo icono/patrón que los otros NavItem del sidebar
  />
)}
```
*(Adaptar al patrón exacto de componentes que usa el Sidebar existente)*

- [ ] **Paso 4: Verificar build**

```bash
cd frontend
npx tsc --noEmit 2>&1 | tail -5
```
Resultado esperado: sin errores.

- [ ] **Paso 5: Commit final**

```bash
git add frontend/src/pages/admin/ExtraccionIAPage.tsx frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(extraccion): panel admin ExtraccionIAPage — cola, sinónimos y métricas"
```

---

## Task 10: Build Docker y smoke test

- [ ] **Paso 1: Build completo**

```bash
docker compose build --no-cache
```
Resultado esperado: sin errores en backend ni frontend.

- [ ] **Paso 2: Levantar servicios**

```bash
docker compose up -d
```

- [ ] **Paso 3: Verificar tablas creadas en BD**

```bash
docker compose exec backend python -c "
from app.database import get_engine
from sqlalchemy import inspect
inspector = inspect(get_engine())
tablas = inspector.get_table_names()
assert 'learned_synonyms' in tablas, 'Falta learned_synonyms'
assert 'extraction_reviews' in tablas, 'Falta extraction_reviews'
print('Tablas OK:', [t for t in tablas if t in ('learned_synonyms','extraction_reviews','form_drafts')])
"
```

- [ ] **Paso 4: Verificar endpoint de métricas**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  http://localhost:8001/api/admin/extraccion/metricas
```
Resultado esperado: `200`

- [ ] **Paso 5: Verificar endpoint de poll (sin extracción previa)**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_COMPRAS" \
  "http://localhost:8001/api/oc/solicitudes/cualquier-id/cotizacion/extraccion/resultado"
```
Resultado esperado: `204` (Fase 2 no iniciada — correcto)

- [ ] **Paso 6: Commit**

```bash
git commit --allow-empty -m "chore(extraccion): smoke test motor híbrido en Docker — OK"
```

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| Regex responde inmediatamente | Task 4 — `run_phase1()` |
| Gemini en background, no bloquea | Task 4 — `run_phase2()` vía BackgroundTasks |
| Semáforo para rate limits | Task 3 — `_semaphore = asyncio.Semaphore(2)` |
| Sinónimos aprendidos en BD | Task 1 + Task 2 |
| Cola de revisión solo para admin | Task 6 |
| Panel admin con métricas | Task 9 |
| Banner "IA completó N campos" | Task 8 |
| Plan B documentado | Task 4 — sección PLAN_B |
| Preparado para facturas | `tipo_documento` en todos los modelos |
| `field_synonyms.py` intocable | Task 2 — `synonym_loader` lo envuelve |

---

## Plan B — documentado

Si la arquitectura de dos fases genera problemas:

**B1 — Desactivar Fase 2 (1 línea de cambio):** en `cotizaciones.py`, comentar `background_tasks.add_task(run_phase2, ...)`. El sistema vuelve a ser 100% regex instantáneamente.

**B2 — Gemini síncrono con timeout de 8s:** reemplazar las dos llamadas por `asyncio.wait_for(extraer_con_gemini(...), timeout=8.0)` con fallback al resultado de Fase 1.

**B3 — SSE en lugar de poll:** el endpoint de extracción devuelve un stream que envía Fase 1 inmediatamente y completa con Fase 2 cuando termina. Mayor complejidad, UX ideal.
