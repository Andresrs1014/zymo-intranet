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

## Re-indexación paso a paso

El modelo de embeddings cambió (de Gemini 3072 dims → Ollama 768 dims), por lo tanto el índice anterior es **incompatible** y debe regenerarse desde cero.

### Paso 1: Entrar al contenedor backend

```bash
docker exec -it zymo-backend bash
```

> Si el backend no corre en Docker, entra directamente al servidor y activa el entorno virtual:
> ```bash
> cd ~/apps/zymo-intranet/backend
> source .venv/bin/activate
> ```

### Paso 2: Confirmar que Ollama está corriendo y el modelo está descargado

```bash
curl http://localhost:11434
# Respuesta esperada: {"version":"..."}

ollama list
# Debe aparecer nomic-embed-text en la lista
```

Si `nomic-embed-text` no aparece:
```bash
ollama pull nomic-embed-text
```

### Paso 3: Verificar que Ollama genera embeddings correctamente

```bash
curl http://localhost:11434/api/embed \
  -d '{"model":"nomic-embed-text","input":["prueba de conexión"]}'
# Debe retornar: {"embeddings":[[0.023..., -0.011..., ...]]}
```

Si este paso falla, no continúes — el indexador también fallará.

### Paso 4: Copiar los documentos a las carpetas de indexación

El script lee de `/tmp/docs_zymo` y `/tmp/docs_zymo_administrativo`. Asegúrate de que los archivos `.md` estén ahí:

```bash
ls /tmp/docs_zymo/
ls /tmp/docs_zymo_administrativo/
```

Si las carpetas están vacías o no existen, cópialos:
```bash
mkdir -p /tmp/docs_zymo /tmp/docs_zymo_administrativo
cp /ruta/de/tus/docs/*.md /tmp/docs_zymo/
```

### Paso 5: Correr el indexador

```bash
cd /app
python indexar_rag.py
```

El script hace automáticamente:
1. Detecta si existe un índice previo y lo **elimina** antes de empezar
2. Lee todos los `.md` de las dos carpetas
3. Por cada archivo: extrae el texto y lo inserta en LightRAG
4. LightRAG llama a Ollama para generar los embeddings de cada chunk

**Salida esperada:**
```
====================================================
  ZYMO RAG — Indexación de documentos
====================================================

LightRAG dir : /app/data/lightrag
Docs dir     : /tmp/docs_zymo
Docs dir     : /tmp/docs_zymo_administrativo

[!] Intento previo detectado — limpiando antes de indexar...
  Directorio /app/data/lightrag eliminado.
  Directorio /app/data/lightrag recreado limpio.

Iniciando indexación...
   5 archivos en /tmp/docs_zymo
   3 archivos en /tmp/docs_zymo_administrativo

Total a indexar: 8 archivos
----------------------------------------------------
  [ 1/ 8] ->    proceso_compras.md (12,430 chars)...
  [ 1/ 8] OK    proceso_compras.md
  ...
----------------------------------------------------

Resultado:  8 OK  |  0 FAIL  |  0 SKIP

[✓] Indexación completada exitosamente.
```

> **En CPU sin GPU la indexación es más lenta.** Un archivo de ~10 000 chars puede tardar 5–15 segundos. Es normal, no es un error.

### Paso 6: Verificar en la intranet

Abrir la intranet → módulo de documentos → Buscar con cualquier término relacionado a los documentos indexados. Si devuelve resultados del grafo, el índice está operativo.

### Solución de problemas comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Connection refused` al conectar con Ollama | Ollama no está corriendo | `systemctl start ollama` |
| `model not found` | El modelo no fue descargado | `ollama pull nomic-embed-text` |
| `Timeout` durante indexación | Batch muy grande en CPU | Normal si el archivo es grande, el timeout es 300 s |
| `No se encontraron archivos .md` | Carpetas vacías o ruta incorrecta | Verificar paso 4 |
| Script termina con `FAIL` en algún archivo | Error en LightRAG o Gemini | Revisar logs y reintentar ese archivo manualmente |

---

## Notas técnicas

- **`nomic-embed-text`** produce vectores de 768 dimensiones con contexto de hasta 8192 tokens.
- LightRAG llama a `_embed_func` con batches de textos. La implementación usa `/api/embed` (API v2 de Ollama) que acepta el campo `input` como array, procesando todo el batch en una sola llamada HTTP.
- **Servidor sin GPU:** `nomic-embed-text` corre en CPU sin problema — es un modelo pequeño (274 MB) diseñado para eso. Ollama detecta la ausencia de GPU automáticamente. La indexación será más lenta que con GPU, pero funcional. Para consultas individuales la latencia en CPU es de ~50–200 ms, completamente aceptable.
- El timeout del cliente httpx es de **300 s** para acomodar batches grandes en CPU.
- Los embeddings ya no consumen cuota de Gemini; el LLM (razonamiento y extracción de entidades del grafo) sí sigue usando la API key de Gemini.
