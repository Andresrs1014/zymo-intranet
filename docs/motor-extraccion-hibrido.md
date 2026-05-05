# Motor de Extracción IA — Arquitectura híbrida

## Resumen

El motor extrae campos de cotizaciones en dos fases independientes:

- **Fase 1** (síncrona, ~1.2 s): regex + fuzzy matching + sinónimos aprendidos. Devuelve resultado inmediato al usuario.
- **Fase 2** (background, ~4–6 s): Gemini File API completa los campos que Fase 1 dejó en `null`. El frontend hace poll hasta que el resultado esté disponible.

Con el tiempo, cada etiqueta que Gemini aprende y un admin aprueba entra a la tabla `learned_synonyms` y Fase 1 la resuelve directamente → menos llamadas a Gemini, respuestas más rápidas.

---

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | `` (vacío) | API Key de Google Gemini. Si está vacío, Fase 2 no se ejecuta. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo Gemini a usar en Fase 2. |
| `PHASE2_RESULTS_DIR` | `/app/data/extraction_phase2` | Directorio donde se persisten los JSON de Fase 2 para el poll del frontend. |

---

## Flujo de extracción

```
POST /api/oc/solicitudes/{id}/cotizacion/extraer
          │
          ├─► run_phase1()          [síncrono — devuelve en ~1.2s]
          │     ├ cotizacion_parse (regex)
          │     ├ extraction_utils (estructurado xlsx/docx)
          │     ├ synonym_loader (estáticos + aprendidos + fuzzy)
          │     └ devuelve ExtraccionResult con phase2_disponible=false
          │
          └─► BackgroundTasks.add_task(run_phase2, ...)
                    │  [solo si hay campos vacíos Y GEMINI_API_KEY configurada]
                    │
                    ├ extraer_con_gemini()   [Gemini File API]
                    ├ parchea campos null de Fase 1
                    ├ escribe {solicitud_id}.json en PHASE2_RESULTS_DIR
                    ├ registra candidatos sin mapear → extraction_reviews
                    └ incrementa veces_visto en learned_synonyms

GET /api/oc/solicitudes/{id}/cotizacion/extraccion/resultado
          ├ 204 No Content   → Fase 2 aún procesando
          └ 200 + JSON       → Fase 2 lista (phase2_disponible=true)
```

---

## Sinónimos aprendidos

Los sinónimos viven en la tabla `learned_synonyms` y se cargan a un cache en memoria al inicio. El cache se invalida automáticamente cuando un admin aprueba o elimina un sinónimo desde el panel `/admin/extraccion-ia`.

**Resolución (orden de prioridad):**
1. Cache de sinónimos aprendidos (BD)
2. `FIELD_SYNONYMS` estático (`services/field_synonyms.py`)
3. Fuzzy matching ≥ 0.85 de similitud

---

## Panel de administración

URL: `/admin/extraccion-ia`

**Permiso requerido:** rol `admin` O permiso `mod_extraccion_ia` asignado al rol del usuario.

El panel tiene tres secciones:

| Tab | Descripción |
|---|---|
| Cola de revisión | Candidatos pendientes que Gemini no pudo mapear. Admin elige campo canónico → se crea `learned_synonym`. |
| Sinónimos aprendidos | Lista de todos los sinónimos aprobados con contador de uso. Permite eliminar. |
| Campos canónicos | Listado de los campos reconocidos por el motor (de `FIELD_SYNONYMS`). |

---

## Concurrencia

- Máximo **2 llamadas simultáneas** a Gemini (`asyncio.Semaphore(2)` en `extraction_ai.py`).
- Las llamadas bloqueantes del SDK (`genai.upload_file`, `genai.delete_file`) se envuelven en `asyncio.to_thread()` para no bloquear el event loop.

---

## PLAN B — Alternativas si el poll no funciona en producción

### B1 — Desactivar Fase 2

En `backend/app/routers/oc/cotizaciones.py`, comentar la línea:

```python
# background_tasks.add_task(run_phase2, contenido, ext, str(solicitud_id), phase1_dict)
```

El sistema vuelve a ser 100% regex sin cambios para el usuario. Gemini sigue disponible para el panel admin.

### B2 — Gemini síncrono con timeout

Reemplazar la arquitectura de dos fases por una sola llamada con timeout:

```python
try:
    resultado = await asyncio.wait_for(extraer_con_gemini(...), timeout=8.0)
except asyncio.TimeoutError:
    resultado = phase1_fallback
```

Ventaja: formulario siempre completo. Desventaja: latencia de hasta 8 s.

### B3 — WebSocket / SSE

El endpoint de extracción devuelve un stream SSE que envía Fase 1 inmediatamente y completa con Fase 2 cuando termina. Más complejo pero UX ideal. Implementar solo si B1/B2 no satisfacen.
