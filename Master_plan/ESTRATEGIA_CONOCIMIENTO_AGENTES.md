# Estrategia de Conocimiento para los Agentes ZYMO
# Para: Claude Code
# Contexto: Cómo conectar los archivos .md al cerebro de Gemini en el servidor

---

## El problema que hay que resolver

Obsidian es una **app de escritorio para humanos**. Corre en Windows/Mac, necesita interfaz gráfica, y no tiene API. En el servidor Ubuntu 24.04 (i5, 16GB RAM, 500GB SSD) corriendo headless con Docker, Obsidian no existe.

Lo que usamos en Obsidian fue para **diseñar y visualizar** la red neuronal. Lo que vive en el servidor debe ser algo que Gemini pueda **consultar programáticamente**.

---

## La solución recomendada: LightRAG

**LightRAG** (`pip install lightrag-hku`) es exactamente lo que necesitamos. Es la herramienta más adecuada por estas razones concretas:

1. **Entiende grafos de conocimiento nativamente** — no es solo búsqueda vectorial. Construye un grafo de entidades y relaciones a partir de los `.md`, igual que Obsidian pero procesable por código.
2. **Acepta archivos `.md` como input directo** — los archivos que ya creamos se ingresan tal cual.
3. **Backend PostgreSQL ya lo tenemos** — LightRAG soporta PostgreSQL como almacenamiento unificado. No hay que instalar nada nuevo.
4. **Se integra con Gemini** — acepta cualquier LLM via función configurable, incluyendo la API de Gemini.
5. **Tiene servidor con API REST y Web UI** — visualización del grafo incluida, parecida a Obsidian pero en el navegador.
6. **Docker-ready** — tiene setup wizard con Docker desde marzo 2026.
7. **Liviano para nuestro servidor** — diseñado para correr en hardware modesto, no requiere GPU para el grafo.

---

## Arquitectura resultante

```
/app/data/agent_docs/          ← Los .md que creamos (ZYMO_MENTE_COMPRAS, etc.)
         │
         ▼
  LightRAG (indexador)
  ├── Lee los .md
  ├── Extrae entidades y relaciones (incluye los [[wikilinks]])
  ├── Construye el grafo de conocimiento
  └── Guarda en PostgreSQL (schema: lightrag)
         │
         ▼
  LightRAG Query API
  POST /query  ←── Gemini llama a esto con la pregunta del usuario
         │
         ▼
  Respuesta con contexto del grafo → Gemini sintetiza → Usuario
```

---

## Cómo funciona el flujo de consulta

Cuando Sonia pregunta "¿Cuántas cotizaciones tengo pendientes de aprobar?":

```
1. Gemini recibe la pregunta
2. Gemini llama a buscar_en_conocimiento("cotizaciones pendientes aprobación")
3. LightRAG busca en el grafo:
   - Encuentra el nodo "pendiente_aprobacion" en estados_oc.md
   - Sigue el enlace [[kpis_y_tiempos]] → encuentra tiempo límite: 24h
   - Sigue el enlace [[alertas_y_triggers]] → encuentra alerta A-03
   - Sigue el enlace [[actores_y_roles]] → sabe que Sonia es quien aprueba
4. Retorna contexto enriquecido con relaciones
5. Gemini combina ese contexto con datos reales de la BD
6. Respuesta precisa sin alucinar
```

Esto es lo que el Plan de Implementación llama **RAG Basado en Grafos** — el agente no inventa reglas, las encuentra navegando el grafo.

---

## Lo que hace LightRAG con los [[wikilinks]]

LightRAG tiene dos niveles de comprensión de los archivos `.md`:

**Nivel 1 — Explícito (wikilinks):** Los `[[estados_oc]]`, `[[ZYMO_MENTE_COMPRAS]]` etc. se procesan como aristas del grafo. Si `proceso_compras_completo.md` menciona `[[estados_oc]]`, LightRAG crea una relación directa entre esos dos nodos.

**Nivel 2 — Semántico (embeddings):** Además de los links explícitos, LightRAG construye relaciones semánticas adicionales que los humanos no escribimos. Por ejemplo, puede detectar que "cotización rechazada" en `flujos_de_email.md` está semánticamente relacionada con el estado `rechazada` en `estados_oc.md`, aunque no haya un `[[]]` explícito.

Resultado: el grafo que construye LightRAG es **más rico** que el de Obsidian, no más pobre.

---

## Implementación en el servidor

### Paso 1 — Agregar a requirements.txt

```
lightrag-hku>=1.3.0
```

### Paso 2 — Nuevo schema en PostgreSQL

LightRAG usa PostgreSQL para almacenar el grafo. Agregar al `.env`:

```env
# LightRAG — Knowledge Graph
LIGHTRAG_WORKING_DIR=/app/data/lightrag
LIGHTRAG_DB_URL=postgresql://user:password@localhost:5432/zymo
# LightRAG crea su propio schema "lightrag" automáticamente
```

### Paso 3 — Servicio en docker-compose.yml

```yaml
zymo-lightrag:
  build: ./backend
  command: python -m app.agents.lightrag_service
  environment:
    - GEMINI_API_KEY_GERENCIAL=${GEMINI_API_KEY_GERENCIAL}
    - LIGHTRAG_DB_URL=${LIGHTRAG_DB_URL}
  volumes:
    - backend_data:/app/data
  restart: always
  depends_on:
    - backend
    - postgres
  ports:
    - "9621:9621"   # Web UI del grafo (accesible desde la intranet)
```

### Paso 4 — Inicializar LightRAG con los .md

```python
# backend/app/agents/lightrag_service.py

import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.llm.gemini import gemini_complete, gemini_embed  # wrapper Gemini
from pathlib import Path

async def initialize_rag():
    rag = LightRAG(
        working_dir="/app/data/lightrag",
        llm_model_func=gemini_complete,       # Usa Gemini para razonamiento
        embedding_func=gemini_embed,           # Usa Gemini para embeddings
    )
    await rag.initialize_storages()
    
    # Indexar todos los .md de agent_docs/
    docs_dir = Path("/app/data/agent_docs")
    for md_file in docs_dir.rglob("*.md"):
        with open(md_file, "r", encoding="utf-8") as f:
            contenido = f.read()
        await rag.ainsert(contenido)
    
    return rag
```

### Paso 5 — Tool que llama Gemini

```python
# backend/app/agents/tools/doc_tools.py

async def buscar_en_conocimiento(query: str, modo: str = "mix") -> str:
    """
    Busca en el grafo de conocimiento de ZYMO.
    
    modos disponibles:
    - "local"  → busca en nodos directamente relacionados (preciso)
    - "global" → busca patrones en todo el grafo (vista amplia)  
    - "mix"    → combina ambos (recomendado para la mayoría de preguntas)
    """
    resultado = await rag.aquery(
        query,
        param=QueryParam(mode=modo)
    )
    return resultado
```

---

## Obsidian como herramienta de diseño, LightRAG como motor

Esta es la separación correcta de responsabilidades:

| Herramienta | Dónde corre | Para qué |
|---|---|---|
| **Obsidian** | PC de Andrés | Diseñar, visualizar y editar la red neuronal |
| **LightRAG** | Servidor Ubuntu | Motor de consulta que Gemini llama en producción |
| **Los `.md`** | Ambos lugares | Son el conocimiento — el mismo formato funciona en los dos |

El flujo de trabajo es:
```
Andrés edita .md en Obsidian (ve el grafo visualmente)
         ↓
Sube los .md al servidor en /app/data/agent_docs/
         ↓
LightRAG los indexa automáticamente (watcher de carpeta)
         ↓
Gemini ya puede consultar el conocimiento actualizado
```

---

## Por qué no las otras opciones

**ChromaDB solo** (lo que ya tenemos en el plan): es búsqueda vectorial pura — no entiende relaciones. Si Sonia pregunta "¿qué pasa después de que rechazo una cotización?", ChromaDB encuentra chunks con la palabra "rechazo" pero no sabe que eso conecta con el estado `en_cotizacion` y el email al auxiliar. LightRAG sí.

**Microsoft GraphRAG**: demasiado complejo para nuestro servidor. Requiere Azure o setup muy pesado. No vale la pena.

**Neo4j**: base de datos de grafos pura, potente pero requiere aprender Cypher query language y no está optimizado para LLMs. LightRAG abstrae todo eso.

**Archivos .md raw con ChromaDB**: lo que teníamos antes. Funciona pero pierde las relaciones. Con LightRAG conservamos las relaciones Y tenemos búsqueda semántica.

---

## Impacto en el Master Plan

Este cambio afecta la dependencia `chromadb` del plan original:

```
# requirements.txt — ACTUALIZADO:

# REEMPLAZA chromadb como motor principal de RAG:
lightrag-hku>=1.3.0

# ChromaDB puede mantenerse como fallback liviano para búsqueda simple
# chromadb>=0.5.0   ← opcional, evaluar si se necesita

# sentence-transformers ya no es necesario si Gemini hace los embeddings
# sentence-transformers>=3.0.0  ← opcional si se usa embedding de Gemini
```

El resto del Master Plan no cambia — LightRAG se integra como una capa adicional dentro de `doc_tools.py`, que es exactamente donde el plan ya tenía la búsqueda RAG.

---

## Resumen para implementar

```
Día 2 del plan (Agente de Documentos RAG):
  [ ] pip install lightrag-hku  
  [ ] Agregar LIGHTRAG_WORKING_DIR y config al .env
  [ ] Crear lightrag_service.py con inicialización
  [ ] Copiar los .md de ZYMO_CEREBRO_COMPRAS y ZYMO_CEREBRO_CORE a /app/data/agent_docs/
  [ ] Indexar con LightRAG (primera vez: ~5 min para 24 archivos)
  [ ] Reemplazar buscar_documentos() en doc_tools.py por buscar_en_conocimiento()
  [ ] Agregar servicio zymo-lightrag al docker-compose.yml
  [ ] Verificar Web UI en puerto 9621 — debe verse el grafo igual que Obsidian
```

---

*Fecha: 2026-04-20 | Repositorio: Andresrs1014/zymo-intranet | Branch: master*
