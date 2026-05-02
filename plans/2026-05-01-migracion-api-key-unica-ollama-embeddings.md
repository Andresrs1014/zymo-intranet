# Migración: API Key única + Embeddings con Ollama

**Fecha:** 2026-05-01
**Estado:** Completado

---

## Motivación

El sistema de agentes usaba dos API keys de Gemini (una por agente) para distribuir la cuota de tokens. Adicionalmente, los embeddings de LightRAG se generaban vía `gemini-embedding-001`, lo que consumía cuota de la misma cuenta Google.

**Objetivo:** simplificar a una sola API key de Gemini y mover los embeddings a Ollama local (sin cuota externa, sin latencia de red).

---

## Arquitectura resultante

```
Usuario → Intranet (chat)
              ↓
         FastAPI backend
              ↓
    ┌─────────────────────┐
    │   Gemini API key    │  ← LLM: razonamiento, respuestas de chat
    │   (una sola key)    │    Modelo: gemini-2.0-flash
    └─────────────────────┘
              ↓
    ┌─────────────────────┐
    │   Ollama (local)    │  ← Embeddings: indexación y búsqueda semántica
    │   nomic-embed-text  │    768 dims · sin cuota · sin internet
    └─────────────────────┘
```

---

## Cambios en el código

| Archivo | Cambio |
|---------|--------|
| `backend/app/config.py` | `gemini_api_key_gerencial` + `gemini_api_key_administrativo` → `gemini_api_key`. Añadidos `ollama_base_url` y `ollama_embed_model`. |
| `backend/app/agents/lightrag_service.py` | `_embed_func` reemplazada: de `gemini-embedding-001` (3072 dims) a Ollama HTTP (`/api/embed`, 768 dims). `_llm_func` usa `settings.gemini_api_key`. |
| `backend/app/agents/worker.py` | `settings.gemini_api_key_gerencial` → `settings.gemini_api_key` |
| `backend/app/routers/agentes.py` | `_get_agente_administrativo()` usa `settings.gemini_api_key` |
| `backend/app/routers/zymo.py` | `_get_zymo()` usa `settings.gemini_api_key` |
| `backend/app/routers/gerencial.py` | `_generar_descripcion_zymo()` usa `settings.gemini_api_key` |
| `backend/.env.example` | Actualizado: una key + variables Ollama documentadas |

---

## Variables de entorno

### Antes
```env
GEMINI_API_KEY_GERENCIAL=AIza...
GEMINI_API_KEY_ADMINISTRATIVO=AIza...
```

### Ahora
```env
GEMINI_API_KEY=AIza...

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

---

## Instalación de Ollama en el servidor

### 1. Instalar

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Se instala como servicio systemd y arranca automáticamente.

### 2. Verificar

```bash
systemctl status ollama
curl http://localhost:11434
# Respuesta esperada: {"version":"..."}
```

### 3. Descargar el modelo de embeddings

```bash
x
# ~274 MB
```

Verificar:
```bash
ollama list
# NAME                    SIZE
# nomic-embed-text:latest 274 MB
```

### 4. (Opcional) Exponer Ollama en red local

Si el backend y Ollama corren en servidores distintos:

```bash
sudo systemctl edit ollama
```

Agregar:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

```bash
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

Y en `.env`:
```env
OLLAMA_BASE_URL=http://192.168.x.x:11434
```

---

## Re-indexación tras la migración

El modelo de embeddings cambió (de 3072 → 768 dims), por lo tanto el índice anterior es **incompatible** y debe regenerarse.

### Paso 1: Borrar el índice anterior

```bash
rm -rf /app/data/lightrag/
```

### Paso 2: Confirmar que Ollama responde

```bash
curl http://localhost:11434/api/embed \
  -d '{"model":"nomic-embed-text","input":["prueba"]}'
# Debe retornar {"embeddings":[[...]]}
```

### Paso 3: Correr el indexador

```bash
cd /app
python indexar_rag.py
```

El script procesa todos los `.md`, `.txt`, `.pdf` y `.docx` de las carpetas de documentos y reconstruye el grafo LightRAG usando Ollama para los embeddings.

### Paso 4: Verificar en la intranet

Documentos → Buscar → cualquier término. Si devuelve resultados del grafo, el índice está operativo.

---

## Notas técnicas

- **`nomic-embed-text`** produce vectores de 768 dimensiones con contexto de hasta 8192 tokens.
- LightRAG llama a `_embed_func` con batches de textos. La implementación usa `/api/embed` (API v2 de Ollama) que acepta el campo `input` como array, procesando todo el batch en una sola llamada HTTP.
- **Servidor sin GPU:** `nomic-embed-text` corre en CPU sin problema — es un modelo pequeño (274 MB) diseñado para eso. Ollama detecta la ausencia de GPU automáticamente. La indexación será más lenta que con GPU, pero funcional. Para consultas individuales la latencia en CPU es de ~50–200 ms, completamente aceptable.
- El timeout del cliente httpx es de **300 s** para acomodar batches grandes en CPU.
- Los embeddings ya no consumen cuota de Gemini; el LLM (razonamiento y extracción de entidades del grafo) sí sigue usando la API key de Gemini.
