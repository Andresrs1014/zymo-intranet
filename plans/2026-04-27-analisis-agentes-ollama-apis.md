# Análisis: Agentes ZYMO, Tareas Gerenciales, Ollama y APIs Alternativas

> **Fecha:** 2026-04-27  
> **Autor:** Revisión técnica automatizada  
> **Servidor objetivo:** Ubuntu 24.04 — Intel i5 4ta gen, 16GB RAM, 500GB SSD

---

## 1. Estado Actual del Sistema de Agentes

### 1.1 Arquitectura implementada

```
┌─────────────────────────────────────────────────┐
│  API KEY 1 (Gemini Flash)                        │
│  ZYMO Core — gemini-2.0-flash                   │
│  → Rondas cada 2h, alertas cada 15min           │
│  → Reportes diarios (8am) y semanales (lun 7am) │
└──────────────────┬──────────────────────────────┘
                   │ supervisa
                   ▼
┌─────────────────────────────────────────────────┐
│  API KEY 2 (Gemini Flash)                        │
│  Agente Administrativo (Sonia)                   │
│  → Chat SSE streaming                            │
│  → Bienvenida personalizada al login             │
│  → Sugerencias automáticas                       │
└──────────────────┬──────────────────────────────┘
                   │ consulta
                   ▼
┌─────────────────────────────────────────────────┐
│  LightRAG (lightrag-hku)                         │
│  → Grafo de conocimiento (.md indexados)         │
│  → Embeddings: gemini-embedding-001 (3072 dim)   │
│  → LLM: gemini-2.0-flash (extracción entidades) │
└─────────────────────────────────────────────────┘
```

### 1.2 Archivos clave del sistema

| Archivo | Función | Líneas |
|---------|---------|--------|
| `agents/base.py` | Clase base: sesiones, logs .md, chat/stream | 148 |
| `agents/zymo_core.py` | Orquestador: rondas, reportes, alertas, chat gerente | 334 |
| `agents/administrativo.py` | Agente Sonia: bienvenida, chat con contexto OC | 143 |
| `agents/worker.py` | APScheduler: 4 jobs programados (24/7) | 184 |
| `agents/lightrag_service.py` | Singleton LightRAG + funciones Gemini con rate-limit | 193 |
| `agents/tools/oc_tools.py` | Consultas OC: KPIs, cotizaciones, tiempos | 286 |
| `agents/tools/doc_tools.py` | Subir/indexar/buscar documentos RAG | 163 |
| `routers/agentes.py` | Endpoints REST del sistema de agentes | 348 |
| `routers/gerencial.py` | Tareas dev, órdenes, KPIs gerenciales | 581 |
| `services/memory_service.py` | Memoria persistente por usuario | 76 |

### 1.3 Consumo de API por componente

| Componente | Frecuencia | Llamadas Gemini/día estimadas |
|------------|------------|-------------------------------|
| `verificar_alertas` | cada 15 min | 0 (no usa LLM, solo BD) |
| `ronda_supervisora` | cada 2h | ~12 llamadas/día |
| `reporte_diario` | 1x/día | ~1 llamada |
| `reporte_semanal` | 1x/semana | ~0.14/día |
| Chat administrativo (Sonia) | bajo demanda | ~10-30/día estimado |
| Bienvenida al login | 1x por login | ~2-5/día |
| `_generar_descripcion_zymo` | por tarea dev creada | ~1-5/día |
| **Subtotal operativo** | | **~25-53 llamadas/día** |

**Esto NO debería agotar el free tier.** El problema está en otro lado → ver sección 2.

---

## 2. ⚠️ Por Qué la Indexación Consume Todo el Free Tier

### 2.1 El problema: LightRAG + Gemini = explosión de llamadas API

El script `indexar_rag.py` llama a `indexar_texto()` por cada archivo `.md`. Internamente, **LightRAG hace MUCHAS llamadas a la API por cada documento**:

```
Por cada documento indexado, LightRAG ejecuta:
  1. Chunking del texto
  2. Por cada chunk:
     a. 1 llamada LLM para extraer entidades y relaciones (gemini-2.0-flash)
     b. 1 llamada embedding para vectorizar (gemini-embedding-001)
  3. Resolución de entidades duplicadas → más llamadas LLM
  4. Construcción de aristas del grafo → más llamadas LLM
```

**Ejemplo concreto:** Un documento de 10,000 caracteres (~20 chunks) puede generar:
- **~20-40 llamadas LLM** (extracción de entidades)
- **~20-40 llamadas de embedding**
- **~5-10 llamadas adicionales** (resolución, merge)
- **Total: ~45-90 llamadas API por un solo documento**

Si indexas **24 archivos .md**, eso son **~1,000-2,200 llamadas API en una sola sesión**.

### 2.2 Límites del Free Tier de Gemini (abril 2026)

| Recurso | Límite Free Tier |
|---------|-----------------|
| RPM (requests/min) | 5-15 RPM (según modelo) |
| RPD (requests/día) | 100-1,000 RPD |
| TPM (tokens/min) | Variable |

**Con 2 API keys (2 cuentas Google):**
- Máximo ~2,000 RPD entre ambas
- La indexación de 24 archivos consume ~1,000-2,200 llamadas
- **La indexación sola puede agotar el 50-100% del límite diario**

### 2.3 Agravantes en el código actual

1. **`lightrag_service.py` línea 64:** Usa `settings.gemini_api_key_gerencial or settings.gemini_api_key_administrativo` — ambas funciones LLM y embed usan **la misma key**. No distribuye carga entre las dos cuentas.

2. **`indexar_rag.py` línea 83:** Indexa secuencialmente pero no tiene control de cuántas llamadas API totales está haciendo LightRAG internamente.

3. **Pausas insuficientes:** Las pausas de 1.5s (LLM) y 0.5s (embed) en `lightrag_service.py` ayudan con RPM pero no previenen el agotamiento del RPD.

4. **Re-indexación completa:** `indexar_rag.py` limpia todo y re-indexa desde cero cada vez (línea 39-43). No hay indexación incremental.

### 2.4 Soluciones recomendadas

#### Solución A — Separar keys por función (inmediata)
```python
# lightrag_service.py — usar key diferente para embed vs LLM
_llm_func → usar gemini_api_key_gerencial
_embed_func → usar gemini_api_key_administrativo
```
**Impacto:** Duplica el RPD disponible para indexación.

#### Solución B — Usar embeddings locales (elimina ~50% de las llamadas API)
```
pip install sentence-transformers
# Usar all-MiniLM-L6-v2 local para embeddings
# Solo usar Gemini para LLM (extracción de entidades)
```
**Impacto:** Elimina todas las llamadas a `gemini-embedding-001`. La mitad de las API calls de indexación desaparecen. Cuesta ~500MB RAM extra en el servidor.

#### Solución C — Indexación incremental (mediano plazo)
Solo re-indexar documentos nuevos o modificados. LightRAG soporta esto pero hay que implementar tracking de hashes.

#### Solución D — Usar Ollama local para indexación (ver sección 3)

---

## 3. Viabilidad de Ollama en el Servidor

### 3.1 Specs del servidor

| Recurso | Disponible | Usado actualmente |
|---------|-----------|-------------------|
| CPU | Intel i5 4ta gen (4 cores, ~3.0GHz) | Backend + Frontend + Worker Docker |
| RAM | 16 GB DDR3 | ~4-6 GB (Docker containers + OS) |
| SSD | 500 GB | Datos + Docker images |
| GPU | **Ninguna** | N/A |

### 3.2 Rendimiento esperado con Ollama (CPU-only)

| Modelo          | Parámetros | RAM necesaria | Velocidad estimada |        ¿Viable? |
| --------------- | ---------- | ------------- | ------------------ | --------------: |
| Phi-3 Mini      | 3.8B       | ~3 GB         | 3-5 tokens/s       |    ⚠️ Funcional |
| Llama 3.2       | 3B         | ~2.5 GB       | 4-6 tokens/s       |    ⚠️ Funcional |
| Mistral 7B Q4   | 7B         | ~5 GB         | 2-4 tokens/s       |        ⚠️ Lento |
| Gemma 2 9B Q4   | 9B         | ~6 GB         | 1-3 tokens/s       |     ❌ Muy lento |
| Llama 3.1 8B Q4 | 8B         | ~5.5 GB       | 2-3 tokens/s       |        ⚠️ Lento |
| Cualquier 13B+  | 13B+       | ~8+ GB        | <1 token/s         | ❌ Impracticable |

### 3.3 Veredicto por caso de uso

#### Para INDEXACIÓN RAG (reemplazar Gemini en LightRAG)
**⚠️ VIABLE PERO CON RESTRICCIONES**
- La extracción de entidades de LightRAG no requiere velocidad — puede tardar horas
- Un modelo de 3-7B puede extraer entidades aceptablemente
- Se ejecutaría fuera de horario laboral (noche/madrugada)
- **Beneficio:** Elimina 100% del consumo de API en indexación

```python
# Configuración para Ollama en LightRAG
llm_model_func = ollama_complete  # modelo: phi3:mini o llama3.2:3b
embedding_func = ollama_embed     # modelo: nomic-embed-text (768 dim)
```

#### Para CHAT EN TIEMPO REAL (reemplazar Gemini en agentes)
**❌ NO VIABLE**
- 2-5 tokens/s es inaceptable para streaming SSE al frontend
- Sonia esperaría 30-60 segundos por respuesta simple
- El gerente no va a tolerar esa latencia
- Además, el CPU estaría saturado durante la inferencia

#### Para WORKER (reportes automáticos cada 2h)
**⚠️ PARCIALMENTE VIABLE**
- Los reportes no necesitan ser instantáneos
- Un modelo 3B podría generar un reporte en 2-3 minutos
- Problema: durante la inferencia, el servidor se ralentizaría para otros servicios

### 3.4 Recomendación: Modelo Híbrido

```
┌─────────────────────────────────────────────┐
│  OLLAMA LOCAL (i5 + 16GB)                    │
│  → Indexación LightRAG (fuera de horario)    │
│  → Embeddings locales (nomic-embed-text)     │
│  → Tareas batch no urgentes                  │
└──────────────────────────────────────────────┘
                    +
┌─────────────────────────────────────────────┐
│  API CLOUD (Gemini/Groq/etc.)                │
│  → Chat en tiempo real (Sonia, gerente)      │
│  → Reportes con deadline (rondas cada 2h)    │
│  → Bienvenidas al login                      │
└──────────────────────────────────────────────┘
```

**Con este modelo híbrido:**
- La indexación RAG deja de consumir API calls de Gemini
- El free tier queda 100% disponible para operación diaria (~25-53 calls/día)
- El servidor solo carga Ollama durante indexación nocturna

---

## 4. APIs Alternativas con Tier Gratuito

### 4.1 Comparativa

| Proveedor | Free Tier | RPM | RPD/Tokens día | Mejor modelo gratis | Compatible OpenAI API |
|-----------|----------|-----|----------------|--------------------|-----------------------|
| **Google Gemini** | Sí | 5-15 | 100-1,000 RPD | gemini-2.0-flash | No (SDK propio) |
| **Groq** | Sí (sin tarjeta) | Variable | Hasta 14,400 RPD (8B) | Llama 3.1 8B, Mixtral | ✅ Sí |
| **OpenRouter** | Sí (sin tarjeta) | ~20 | ~200 RPD por modelo | Llama 3, Gemma, Qwen | ✅ Sí |
| **Mistral** | Sí (plan Experiment) | ~1 req/s | Limitado | Mistral 7B, Mixtral | ✅ Sí |
| **Cloudflare Workers AI** | Sí | ~300 | 10,000 neurons/día | Llama 3.1 8B | API propia |
| **Ollama Local** | ∞ (tu hardware) | ∞ | ∞ | Phi-3, Llama 3.2 3B | ✅ Sí |

### 4.2 Recomendación por caso de uso

#### Para Chat en Tiempo Real (Sonia + Gerente)
**Opción 1 — Gemini (actual):** Mantener. 2 API keys × ~500 RPD = suficiente.  
**Opción 2 — Groq como backup:** Velocidad superior (~500 tokens/s), free tier generoso.

```python
# Ejemplo: fallback a Groq cuando Gemini da 429
async def chat_con_fallback(mensaje):
    try:
        return await gemini_chat(mensaje)
    except RateLimitError:
        return await groq_chat(mensaje)  # Llama 3.1 8B instant
```

#### Para Indexación RAG
**Opción recomendada: Ollama local** (ver sección 3.4)
- Cero costo de API
- Sin límites de rate
- Calidad aceptable con phi3:mini para extracción de entidades

#### Para Embeddings
**Opción recomendada: Embeddings locales**
- `nomic-embed-text` via Ollama (768 dim, rápido en CPU)
- O `sentence-transformers/all-MiniLM-L6-v2` (~90MB, rápido)
- Elimina ~50% del consumo API en indexación

#### Para Worker (reportes automáticos)
**Mantener Gemini.** Solo ~12 llamadas/día para rondas. No justifica cambio.

### 4.3 Estrategia multi-proveedor propuesta

```
Prioridad 1: Gemini Flash (Key 1) → Chat gerente + Worker
Prioridad 2: Gemini Flash (Key 2) → Chat Sonia
Prioridad 3: Groq (free) → Fallback si Gemini da 429
Prioridad 4: Ollama local → Indexación RAG + embeddings
```

**Implementación:** Crear un `llm_router.py` que intente proveedores en orden.

---

## 5. Módulo de Tareas Gerenciales — Estado

### 5.1 Funcionalidad implementada

| Feature | Estado | Notas |
|---------|--------|-------|
| CRUD tareas dev | ✅ Completo | POST/GET/PATCH en `/api/gerencial/tareas-dev` |
| Descripción gerencial auto (ZYMO) | ✅ Completo | Background task con Gemini |
| Evaluación de impacto auto | ✅ Completo | ZYMO estima horas ahorradas |
| Filtros (estado/etiqueta/plataforma) | ✅ Completo | Query params en GET |
| KPIs gerenciales | ✅ Completo | Combina OC + tareas dev |
| Feed de actividad | ✅ Completo | Tareas + acciones del agente admin |
| Órdenes directas del gerente | ✅ Completo | CRUD + notificación email |
| Estado del servidor (Docker stats) | ✅ Completo | Subprocess `docker stats` |
| Permisos (require_gerencial) | ✅ Completo | Roles: gerente, admin, dev |

### 5.2 Interacción con agentes

- Cada tarea creada por Andrés dispara `_generar_descripcion_zymo()` en background
- ZYMO Core instancia completa para generar la descripción → **1 llamada API por tarea**
- La descripción gerencial e impacto se guardan en `gerencial_tareas` (SQLite/PostgreSQL)

### 5.3 Impacto en consumo de API

Las tareas gerenciales consumen **mínimo** de API:
- ~1-5 tareas/día × 1 llamada Gemini cada una = **~1-5 llamadas/día**
- Esto es negligible comparado con la indexación

---

## 6. Plan de Acción Recomendado

### Fase 1 — Inmediata (hoy)
- [ ] Separar API keys: LLM usa Key 1, Embeddings usa Key 2
- [ ] No re-indexar hasta implementar Fase 2

### Fase 2 — Esta semana
- [ ] Instalar Ollama en el servidor Ubuntu
- [ ] Descargar `phi3:mini` (~2.3GB) y `nomic-embed-text` (~274MB)
- [ ] Modificar `lightrag_service.py` para usar Ollama en indexación
- [ ] Crear script de indexación nocturna (cron a las 2am)
- [ ] Mantener Gemini solo para chat/reportes en tiempo real

### Fase 3 — Próxima semana
- [ ] Implementar fallback Groq para chat cuando Gemini da 429
- [ ] Crear `llm_router.py` con prioridad multi-proveedor
- [ ] Implementar indexación incremental (hash tracking de .md)
- [ ] Monitorear consumo real de API con logging detallado

### Fase 4 — Mediano plazo
- [ ] Evaluar si Ollama puede manejar reportes del worker (off-peak)
- [ ] Considerar OpenRouter como pool de modelos gratuitos
- [ ] Evaluar upgrade de RAM del servidor (32GB) si Ollama se usa más

---

## 7. Resumen Ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Por qué se agota el free tier? | **LightRAG genera ~45-90 llamadas API por documento indexado.** 24 docs = ~1,000-2,200 calls en una sesión. |
| ¿Es viable Ollama en el servidor? | **Sí, pero solo para tareas batch (indexación, embeddings).** No para chat en tiempo real. |
| ¿Qué modelo usar en Ollama? | **phi3:mini (3.8B)** para LLM + **nomic-embed-text** para embeddings |
| ¿Hay APIs gratis alternativas? | **Sí: Groq (mejor opción como fallback), OpenRouter, Mistral Experiment** |
| ¿Las tareas gerenciales son problema? | **No.** Solo ~1-5 llamadas API/día. El módulo está bien implementado. |
| ¿Solución recomendada? | **Modelo híbrido:** Ollama para indexación + Gemini/Groq para chat en tiempo real |

---

*Generado: 2026-04-27 | Repositorio: Andresrs1014/zymo-intranet | Branch: master*
