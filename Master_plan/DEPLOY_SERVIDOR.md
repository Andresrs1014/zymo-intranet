# Guía de Deploy — Sistema de Agentes ZYMO
> Para: Andrés — ejecutar en el servidor Ubuntu 24.04
> Actualizar este archivo cada vez que se agreguen servicios nuevos

---

## Estado actual del servidor (antes de agentes)

```
Servidor Ubuntu 24.04 — i5 / 16GB RAM / 500GB SSD
├── Docker: backend (puerto 8001) + frontend (puerto 81)
├── Cloudflare DNS: zymointranet.com → IP del servidor
├── nginx (dentro del contenedor frontend): proxy /api/* → backend:8001
└── Volumen: backend_data → /app/data (persiste entre deploys)
```

---

## PASO 1 — Obtener las API Keys (hacer primero, antes de tocar el servidor)

### Gemini (GRATIS — 1M tokens/día por cuenta)

1. Ir a **aistudio.google.com** con la **cuenta Google #1** (para ZYMO Core / gerencia)
   - Clic en "Get API Key" → "Create API key"
   - Copiar la key → es `GEMINI_API_KEY_GERENCIAL`

2. Repetir con la **cuenta Google #2** (para Agente Administrativo / Sonia)
   - Otra cuenta Google, mismo proceso
   - Copiar la key → es `GEMINI_API_KEY_ADMINISTRATIVO`

### Perplexity (para noticias IA del gerente — se implementa en Semana 2)
- Ir a **perplexity.ai/settings/api**
- Crear cuenta si no existe → "Generate" API key
- Copiar → es `PERPLEXITY_API_KEY` (puede quedar vacío por ahora)

---

## PASO 2 — Modificar el `.env` en el servidor

Conectarse al servidor por SSH y editar `~/zymo-intranet/backend/.env`:

```bash
ssh usuario@IP_DEL_SERVIDOR
cd ~/zymo-intranet/backend
nano .env
```

Agregar al final del archivo (mantener todo lo que ya existe):

```env
# ── Agentes IA ────────────────────────────────────────────────────────────────
AGENTS_DATABASE_URL=sqlite:///./data/agents.db

# API Keys de Gemini — dos cuentas Google separadas (1M tokens/día c/u gratis)
GEMINI_API_KEY_GERENCIAL=AIza...pegar_aqui_key_cuenta_1
GEMINI_API_KEY_ADMINISTRATIVO=AIza...pegar_aqui_key_cuenta_2

# Perplexity — solo para noticias IA del módulo gerencial (puede quedar vacío)
PERPLEXITY_API_KEY=

# Configuración de agentes
AGENT_CHECK_INTERVAL_MINUTES=120
AGENT_DOCS_DIR=/app/data/agent_docs
AGENT_LOGS_DIR=/app/data/agent_logs
AGENT_MEMORY_DIR=/app/data/agent_memory
LIGHTRAG_WORKING_DIR=/app/data/lightrag
```

---

## PASO 3 — Crear las carpetas de datos en el servidor

Las carpetas viven dentro del volumen Docker `backend_data` → montado en `/app/data`.
Crearlas desde el host así:

```bash
# Desde el servidor, dentro del contenedor backend
docker exec -it zymo-intranet-backend-1 mkdir -p \
  /app/data/agent_docs/administrativo \
  /app/data/agent_docs/sgc \
  /app/data/agent_docs/general \
  /app/data/agent_logs/administrativo \
  /app/data/agent_logs/zymo \
  /app/data/agent_logs/reportes \
  /app/data/agent_memory \
  /app/data/lightrag
```

> **Nota:** El nombre del contenedor puede ser diferente.
> Verificar con `docker ps` y buscar el que tiene "backend" en el nombre.

---

## PASO 4 — Hacer el rebuild del backend

```bash
cd ~/zymo-intranet

# Bajar el backend
docker compose down backend

# Rebuild con las nuevas dependencias (lightrag-hku, google-generativeai, etc.)
docker compose build backend

# Levantar todo
docker compose up -d

# Verificar que levantó bien
docker compose logs -f backend
```

**Qué esperar en los logs al levantar:**
```
[seed] Roles verificados.
[seed] Áreas y sedes verificadas.
INFO: Application startup complete.
```

**Si aparece error de LightRAG:** significa que `lightrag-hku` no se instaló bien.
Ver sección "Problemas comunes" al final.

---

## PASO 5 — Verificar que los endpoints nuevos responden

Desde el servidor (o con curl desde tu máquina):

```bash
# Test de salud
curl https://zymointranet.com/health

# Test de lista de documentos (debe retornar [])
curl -H "Authorization: Bearer TU_TOKEN" \
     https://zymointranet.com/api/agentes/documentos/listar
```

Para obtener el token: hacer login normal en la intranet y copiar el Bearer del navegador (DevTools → Network → cualquier request → Headers → Authorization).

---

## PASO 6 — Subir los archivos .md de conocimiento (ZYMO_CEREBRO_COMPRAS)

Una vez que el backend esté corriendo, subir los `.md` de Obsidian al agente:

**Opción A — Desde la UI** (cuando esté el frontend del agente):
- Usar el endpoint `/api/agentes/documentos/subir`

**Opción B — Directo al servidor** (mientras no hay UI):
```bash
# Copiar los .md desde tu PC al servidor
scp -r ruta/local/ZYMO_CEREBRO_COMPRAS/*.md usuario@IP:/tmp/docs_zymo/

# Moverlos al volumen Docker
docker exec -it zymo-intranet-backend-1 mkdir -p /app/data/agent_docs/administrativo
docker cp /tmp/docs_zymo/. zymo-intranet-backend-1:/app/data/agent_docs/administrativo/
```

**Indexar manualmente** (mientras no hay endpoint automático de re-indexación):
```bash
docker exec -it zymo-intranet-backend-1 python3 -c "
import asyncio
from app.agents.lightrag_service import indexar_texto
from pathlib import Path

async def indexar_todo():
    docs_dir = Path('/app/data/agent_docs')
    archivos = list(docs_dir.rglob('*.md')) + list(docs_dir.rglob('*.txt'))
    print(f'Indexando {len(archivos)} archivos...')
    for f in archivos:
        texto = f.read_text(encoding='utf-8', errors='ignore')
        ok = await indexar_texto(texto)
        print(f'  [{\"OK\" if ok else \"FAIL\"}] {f.name}')

asyncio.run(indexar_todo())
"
```

> **Tiempo estimado:** ~30-60 segundos por archivo (LightRAG llama a Gemini para extraer entidades). Para 20 archivos: ~10-20 minutos. Hacer en horario donde Sonia no use el sistema.

---

## Cloudflare — ¿Qué cambiar?

### ✅ NO se necesita nada nuevo para Días 1-2

El endpoint `/api/agentes/*` ya está cubierto por la regla nginx existente:
```nginx
location ~ ^/(api|auth|users|roles|areas|sedes)(/|$) {
    proxy_pass http://backend:8001;
```
El patrón `api` captura `/api/agentes/...`. **Nada que tocar en Cloudflare ni en nginx.**

### ⚠️ Verificar que Cloudflare NO cachea los endpoints de agentes

En el dashboard de Cloudflare → Caching → Cache Rules:
- Asegurarse de que `/api/*` esté con `Cache: Bypass` o `No-store`
- Si no hay una regla así, crear:
  - **Si:** URI Path starts with `/api`
  - **Entonces:** Cache → Bypass

### 📋 Cambios futuros que SÍ requerirán Cloudflare

| Cuando se implemente | Qué hacer en Cloudflare |
|---------------------|------------------------|
| **Día 5 — ZYMO Worker** | Nada (el worker es interno, sin puerto público) |
| **LightRAG Web UI** (opcional, para ver el grafo) | Nuevo DNS: `rag.zymointranet.com` → IP servidor, proxied. Puerto 9621 expuesto en docker-compose |
| **Semana 2 — Módulo Gerencial** | Nada (son rutas bajo `/api/gerencial/*` y `/gerencial` en el frontend, ya cubiertos) |
| **PWA — hacer instalable en móvil** | Agregar header en Cloudflare: `Service-Worker-Allowed: /` para el dominio raíz |

---

## Docker Compose — Cambios futuros planeados

El `docker-compose.yml` actual solo tiene `backend` y `frontend`. En el **Día 5** habrá que agregar:

```yaml
# Agregar al docker-compose.yml cuando se implemente el Día 5:

  zymo-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: python -m app.agents.worker
    env_file:
      - ./backend/.env
    volumes:
      - backend_data:/app/data
    restart: always
    depends_on:
      - backend

  # Solo si se quiere ver el grafo LightRAG visualmente (opcional):
  # zymo-lightrag:
  #   image: hkunlp/lightrag:latest
  #   ports:
  #     - "9621:9621"
  #   volumes:
  #     - backend_data:/app/data
  #   restart: unless-stopped
```

---

## nginx.conf — ¿Qué cambiar?

### Ahora mismo: NADA

El patrón `/api` ya cubre todo.

### Futuro — Stream SSE (Día 4, agente con streaming)

El SSE (Server-Sent Events) requiere que nginx **no bufferice** la respuesta. Cuando se implemente el streaming del agente, agregar en `frontend/nginx.conf`:

```nginx
# Agregar DENTRO del location de /api:
location ~ ^/(api|auth|users|roles|areas|sedes)(/|$) {
    proxy_pass http://backend:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;

    # Agregar estas líneas para SSE:
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
}
```

---

## Problemas comunes

### "lightrag-hku installation failed" en el build

```bash
# Verificar dentro del contenedor
docker exec -it zymo-intranet-backend-1 pip show lightrag-hku
docker exec -it zymo-intranet-backend-1 python3 -c "from lightrag import LightRAG; print('OK')"
```

Si falla, puede ser versión de Python o conflicto de dependencias:
```bash
docker exec -it zymo-intranet-backend-1 pip install lightrag-hku --upgrade
```

### "RuntimeError: no running event loop" en LightRAG

Ya está resuelto en el código (`_get_lock()` crea el lock dentro del event loop). Si aparece este error es porque algo está invocando `get_rag()` fuera de un contexto async.

### LightRAG inicializa pero no indexa

Verificar que las API keys de Gemini sean válidas:
```bash
docker exec -it zymo-intranet-backend-1 python3 -c "
import google.generativeai as genai
genai.configure(api_key='TU_KEY_AQUI')
model = genai.GenerativeModel('gemini-2.0-flash')
import asyncio
r = asyncio.run(model.generate_content_async('Di hola'))
print(r.text)
"
```

### El volumen `backend_data` no persiste entre rebuilds

Verificar que el volumen existe:
```bash
docker volume ls | grep backend
```
Si aparece `zymo-intranet_backend_data` (o similar), los datos están seguros. El rebuild del contenedor no toca los volúmenes.

---

## Checklist de deploy (Días 1-2)

```
[ ] Conseguir API Key Gemini cuenta #1 → GEMINI_API_KEY_GERENCIAL
[ ] Conseguir API Key Gemini cuenta #2 → GEMINI_API_KEY_ADMINISTRATIVO
[ ] Editar backend/.env con las keys nuevas
[ ] docker compose down backend
[ ] docker compose build backend    ← instala lightrag-hku y google-generativeai
[ ] docker compose up -d
[ ] Verificar logs: "Application startup complete"
[ ] curl /api/agentes/documentos/listar → debe retornar []
[ ] Crear carpetas de datos dentro del contenedor (Paso 3)
[ ] Subir .md de ZYMO_CEREBRO_COMPRAS al servidor (Paso 6)
[ ] Indexar los .md con el script del Paso 6
[ ] Verificar con curl /api/agentes/documentos/buscar?q=cotizacion
```

---

*Última actualización: 2026-04-21 | Cubre: Días 1-2 del plan de agentes*
*Actualizar cuando se implemente Día 5 (worker) y cuando se agregue LightRAG Web UI*
