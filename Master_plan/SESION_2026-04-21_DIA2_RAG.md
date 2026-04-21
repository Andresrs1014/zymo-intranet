# Sesión 2026-04-21 — Día 2: Agente de Documentos RAG
> Claude Code — Reporte de sesión completo
> Branch: master

---

## Resumen de la sesión

Se implementó el **Agente de Documentos RAG** (Día 2 del Master Plan), construido sobre LightRAG con Gemini como backend de LLM y embeddings.

---

## Archivos creados

### `backend/app/agents/lightrag_service.py`
Singleton de LightRAG con inicialización lazy (solo arranca cuando se necesita).

**Decisiones clave:**
- **No usa `lightrag.llm.gemini`** — se implementaron funciones Gemini propias (`_llm_func`, `_embed_func`) usando directamente `google-generativeai`. Esto elimina el riesgo identificado en la sesión anterior de que ese módulo no existiera.
- **Modelo de embeddings:** `text-embedding-004` de Google, dimensión 768.
- **LLM:** `gemini-2.0-flash` (el más rápido y eficiente para el servidor).
- **Fallback:** Si `lightrag-hku` no está instalado, todas las funciones retornan `None` o mensaje de error, sin romper el servidor.
- **`_get_lock()`:** El asyncio.Lock se crea dentro del event loop (no en import time) para evitar el error `RuntimeError: no running event loop`.

### `backend/app/agents/tools/doc_tools.py`
Tools que Gemini puede invocar cuando necesita buscar conocimiento interno.

**Funciones:**
- `extraer_texto(contenido, extension)` — extrae texto plano de MD/TXT/PDF/DOCX usando las librerías ya instaladas (pdfplumber, python-docx).
- `subir_e_indexar(...)` — guarda el archivo físico en `agent_docs/{area}/`, indexa en LightRAG, guarda metadata en `agent_documentos`.
- `listar_documentos(area)` — lista desde BD.
- `eliminar_documento(id)` — borra de BD y filesystem. **Limitación conocida:** LightRAG no soporta eliminación de nodos individuales del grafo.
- `buscar_en_conocimiento(query, area, modo)` — el tool principal que llaman los agentes.

### `backend/app/routers/agentes.py`
4 endpoints REST bajo `/api/agentes`:

| Método | Ruta | Acceso |
|--------|------|--------|
| POST | `/api/agentes/documentos/subir` | Cualquier usuario autenticado |
| GET | `/api/agentes/documentos/buscar?q=...&area=...&modo=...` | Cualquier usuario autenticado |
| GET | `/api/agentes/documentos/listar?area=...` | Cualquier usuario autenticado |
| DELETE | `/api/agentes/documentos/{id}` | Solo admin |

---

## Archivos modificados

### `backend/app/main.py`
- Añadido import de `agentes_router`
- Añadido `app.include_router(agentes_router)` al final del stack de routers

---

## Estado del plan maestro (actualizado)

### ✅ Completado
- **Día 1:** Infraestructura base (agent_database, base.py, config, requirements)
- **Día 2:** Agente de Documentos RAG (lightrag_service, doc_tools, router)

### ❌ Pendiente
- **Día 3:** Control de Tiempos OC + Agente Administrativo (Sonia)
  - Tabla `oc_tiempos_estado`
  - `agents/tools/oc_tools.py`
  - `agents/administrativo.py`
  - Endpoints `/api/agentes/administrativo/*`
- **Día 4:** Frontend (AgentFloatingWindow, AgentStatusBar, stream SSE)
- **Día 5:** ZYMO Core + worker.py + docker-compose
- **Semana 2:** Módulo Gerencial completo + piloto con Sonia

---

## Advertencias y recomendaciones para próximas sesiones

### 1. Verificar LightRAG antes del primer deploy
```bash
pip install lightrag-hku
python -c "from lightrag import LightRAG, QueryParam; from lightrag.utils import EmbeddingFunc; print('OK')"
```
Si falla el import de `EmbeddingFunc`, revisar la versión instalada. En versiones < 1.2 la API es diferente.

### 2. Primera indexación es lenta
LightRAG procesa cada documento llamando a Gemini para extraer entidades y relaciones. Calcular ~30-60 segundos por documento. Hacer la indexación inicial fuera de horario laboral.

### 3. LightRAG no soporta delete de nodos
El endpoint DELETE elimina de BD y filesystem pero **no purga el grafo**. Si se necesita quitar conocimiento del grafo, la única forma es vaciar `LIGHTRAG_WORKING_DIR` y re-indexar todo desde cero.

### 4. El lock de asyncio
El `_rag_lock` se crea con `_get_lock()` que lo instancia dentro del event loop (no en import time). No mover esa inicialización al nivel de módulo o fallará con `RuntimeError: no running event loop`.

### 5. Gemini API Key
El servicio usa `gemini_api_key_gerencial` con fallback a `gemini_api_key_administrativo`. En desarrollo, basta con una sola key en `.env`. En producción usar las dos cuentas separadas como dice el master plan.

### 6. Limitación de embeddings
`genai.embed_content` es síncrono — se ejecuta con `run_in_executor` para no bloquear el event loop. Esto funciona pero no es óptimo para indexaciones masivas. Si en el futuro se indexan cientos de documentos, considerar un queue o worker separado.

### 7. Próximo paso crítico (Día 3)
Antes de implementar el Agente Administrativo, leer:
- `backend/app/routers/oc/solicitudes.py` — para entender el modelo de datos de OCs
- `backend/app/models/oc.py` — antes de agregar `oc_tiempos_estado`
- `backend/app/routers/oc/kpis.py` — para no duplicar lógica de KPIs existente

---

*Fecha: 2026-04-21 | Branch: master | Próximo: Día 3 — Control de Tiempos OC + Agente Administrativo*
