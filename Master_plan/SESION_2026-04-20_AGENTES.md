# Sesión 2026-04-20 — Plan Agentes ZYMO (Días 1–3)
> Claude Code — Reporte de sesión y análisis técnico

---

## Tarea completada

- Lectura completa de `ZYMO_MASTER_PLAN_v2.md` y `ESTRATEGIA_CONOCIMIENTO_AGENTES.md`
- Configuración del servidor MCP `context-mode` en `~/.claude/mcp.json`
- Análisis de arquitectura de agentes para los Días 1, 2 y 3 del plan
- Análisis de decisión: **LightRAG vs ChromaDB** (ver sección final)

---

## Contexto

El proyecto ZYMO Intranet ya corre en producción en `zymointranet.com`. El plan de agentes es **nuevo encima del sistema existente** — no toca el código actual salvo agregar rutas y roles.

**Arquitectura objetivo:**
```
API Key 1 (Gemini) → ZYMO Core → Gerente / Andrea / Andrés
API Key 2 (Gemini) → Agente Administrativo → Sonia Gómez
                          └── Sub-agente: Documentos RAG ← LightRAG
```

**Lo que se construye en Días 1–3:**

| Día | Entregable principal |
|-----|---------------------|
| 1 | Infraestructura base: env, dependencias, carpetas, `agent_database.py`, `base.py` |
| 2 | Agente de Documentos (RAG) completo — indexación + endpoints |
| 3 | Control de tiempos OC + Agente Administrativo (Sonia) |

---

## Mejoras y asuntos críticos para otras sesiones de Claude Code

### 1. Leer antes de tocar
Estos archivos existen y son complejos — leerlos completos antes de modificar:
- [backend/app/routers/oc/documentos.py](../backend/app/routers/oc/documentos.py) — generación OC
- [backend/app/models/oc.py](../backend/app/models/oc.py) — agregar campos sin romper migraciones
- [frontend/src/App.tsx](../frontend/src/App.tsx) — agregar rutas con cuidado

### 2. Tres schemas PostgreSQL separados — sin FK entre ellos
- `schema: intranet` — usuarios, auth existente
- `schema: oc` — todo el módulo de compras
- `schema: agents` — NUEVO — tablas del sistema de agentes

**Nunca crear FK constraints entre schemas.** Es intencional por aislamiento.

### 3. El worker de Docker es crítico
`zymo-worker` debe tener `restart: always`. Si cae, ZYMO deja de supervisar. Verificar en producción que el servicio levanta correctamente después de cada deploy.

### 4. Streaming con SSE, no WebSocket
FastAPI tiene soporte nativo de `StreamingResponse`. Usarlo para el stream de respuestas del agente. No implementar WebSocket — más complejo sin beneficio para este caso.

### 5. Markdowns de sesiones son datos de entrenamiento
`/app/data/agent_logs/` guarda el historial de cada sesión de agente. **Nunca borrar, nunca comprimir.** Son el dataset para un futuro modelo ZYMO propio.

### 6. Sin tests automatizados en esta etapa
El servidor no tiene recursos. Las pruebas son manuales con Sonia como piloto. No invertir tiempo en pytest ni CI para los agentes por ahora.

### 7. context-mode MCP — estado en esta sesión
El servidor está registrado en `~/.claude/mcp.json` pero **no expuso herramientas activas** en esta sesión. Verificar en la próxima sesión con `/mcp` si está inicializado correctamente.

---

## Análisis: Cambiar ChromaDB por LightRAG

### Veredicto: ✅ SÍ cambiar — con condiciones

---

### Por qué sí

**1. El caso de uso lo exige, no es solo preferencia**

Los archivos `.md` de ZYMO tienen wikilinks reales (`[[estados_oc]]`, `[[actores_y_roles]]`, `[[alertas_y_triggers]]`). Esas son relaciones de negocio codificadas. ChromaDB las ignora completamente — trata los `.md` como texto plano y fragmenta sin entender la estructura.

LightRAG convierte cada `[[wikilink]]` en una arista de grafo. Cuando Sonia pregunta "¿qué pasa después de que rechazo una cotización?", LightRAG puede navegar: `rechazada → [[estados_oc]] → en_cotizacion → [[flujos_email]] → email al auxiliar`. ChromaDB solo encuentra chunks con la palabra "rechazo".

**2. PostgreSQL ya existe — cero infraestructura nueva**

LightRAG usa el mismo PostgreSQL que ya tenemos. Crea su propio schema `lightrag` automáticamente. No hay que instalar ni mantener nada nuevo.

**3. Embeddings con Gemini — elimina sentence-transformers**

Si Gemini hace los embeddings, `sentence-transformers` sale del `requirements.txt`. Ahorra ~500MB de RAM en el servidor (modelo de embeddings local). Relevante en un servidor con 16GB compartidos entre varios servicios Docker.

---

### Riesgos y condiciones antes de implementar el Día 2

**Crítico — verificar antes de escribir una sola línea:**

```bash
pip install lightrag-hku
python -c "from lightrag.llm.gemini import gemini_complete, gemini_embed; print('OK')"
```

El código en `ESTRATEGIA_CONOCIMIENTO_AGENTES.md` usa `from lightrag.llm.gemini import ...`. Este módulo puede no existir o tener nombre diferente en la versión actual. Si falla, hay que adaptar la configuración del LLM antes de continuar.

**Riesgo 2 — Watcher de carpeta no está implementado**

El documento describe flujo:
```
Andrés edita .md → sube al servidor → LightRAG indexa automáticamente
```
Pero el código de `initialize_rag()` hace indexación manual (un loop, una vez). El watcher automático hay que implementarlo. Para el Día 2 es aceptable hacerlo manual (re-indexar cuando se suban archivos vía endpoint). El watcher se puede agregar en iteraciones posteriores.

**Riesgo 3 — Puerto 9621 (Web UI)**

Si se quiere ver el grafo desde la intranet, el puerto necesita abrirse en el firewall del servidor Ubuntu. Para el piloto con Sonia no es necesario — es solo diagnóstico para Andrés.

**Riesgo 4 — Tiempo de indexación inicial**

~5 min para 24 archivos está documentado. Si los `.md` crecen (ZYMO_CEREBRO_COMPRAS tiene 12+ archivos), hay que hacer la indexación inicial fuera de horario para no bloquear el servicio.

---

### Cambios al Master Plan v2 derivados de esta decisión

```diff
# requirements.txt
- chromadb>=0.5.0
- sentence-transformers>=3.0.0
+ lightrag-hku>=1.3.0

# Variables de entorno (.env) — agregar:
+ LIGHTRAG_WORKING_DIR=/app/data/lightrag
+ LIGHTRAG_DB_URL=postgresql://user:password@localhost:5432/zymo

# Estructura de carpetas
- backend/app/data/chroma_db/
+ backend/app/data/lightrag/

# docker-compose.yml — agregar servicio:
+ zymo-lightrag (puerto 9621, solo para diagnóstico interno)
```

La nota 7 del Master Plan v2 dice: *"ChromaDB — inicializar con persist_directory='/app/data/chroma_db'"* — ya no aplica. Actualizar en próxima sesión.

---

### Tabla de decisión final

| Criterio | ChromaDB | LightRAG |
|---|---|---|
| Búsqueda semántica | ✅ | ✅ |
| Entiende relaciones `[[wikilinks]]` | ❌ | ✅ |
| Backend PostgreSQL (ya tenemos) | ❌ necesita chroma_db dir | ✅ directo |
| Elimina sentence-transformers | ❌ | ✅ (con Gemini embed) |
| Madurez / estabilidad | Alta | Media (verificar imports) |
| Web UI para inspección | ❌ | ✅ puerto 9621 |
| Complejidad de setup | Baja | Media |

**Decisión: LightRAG en el Día 2, con verificación de imports como primer paso.**

---

*Fecha: 2026-04-20 | Branch: master | Próximo: Día 1 — infraestructura base*
