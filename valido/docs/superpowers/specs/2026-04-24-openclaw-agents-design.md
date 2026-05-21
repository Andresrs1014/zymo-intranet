# OpenClaw — Plan de Integración como Capa de Agentes Paralela
**Fecha:** 2026-04-24
**Tipo:** Capa paralela — sin modificar agentes Python existentes
**Servidor:** Ubuntu + Docker Compose (mismo servidor que la intranet)
**Contexto:** OpenClaw corre junto a la intranet como interfaz adicional de agentes. Los agentes Python (zymo_core.py, administrativo.py, worker APScheduler) permanecen sin cambios.

---

## Resumen Ejecutivo

OpenClaw se despliega como un servicio Docker adicional en el mismo servidor, accesible en `agentes.zymointranet.com`. Lee los archivos `.md` del cerebro de los agentes (MENTE_AGENTE_ADMINISTRATIVO, ZYMO_CEREBRO_CORE) montados como volúmenes read-only, y puede llamar a los endpoints del backend FastAPI a través de la red interna Docker. Usa Gemini como LLM primario (API key propia, separada de la intranet) y Groq free tier como fallback. Todo el tráfico pasa por nginx con el mismo nivel de seguridad del blindaje existente.

---

## Arquitectura Global

```
Internet
   │
   ▼
nginx (existente + nuevo bloque de subdominio)
   ├── zymointranet.com/        → Frontend React (sin cambios)
   ├── zymointranet.com/api/    → FastAPI backend (sin cambios)
   └── agentes.zymointranet.com → OpenClaw (nuevo)
                                      │
                    ┌─────────────────┴──────────────────┐
                    │                                    │
              Gemini API key                     Groq API key (gratis)
              (primario)                         (fallback)
                    │
                    ▼
         Docker: openclaw container
              │
              ├── /workspace/brain/ (read-only mounts)
              │     ├── administrativo/   ← MENTE_AGENTE_ADMINISTRATIVO/
              │     ├── zymo/             ← ZYMO_CEREBRO_CORE/
              │     └── master_plan.md   ← ZYMO_MASTER_PLAN_v2.1.md
              │
              └── http://backend:8000/api/* (red interna Docker)

[Sin cambios — corren en paralelo]
FastAPI backend + zymo-worker (APScheduler) + AgentFloatingWindow frontend
```

---

## LLM — Opciones y Selección

### Opción primaria: Gemini API (Google AI Studio)

API key separada de la que usa la intranet. Se obtiene en [aistudio.google.com](https://aistudio.google.com).

- Modelo: `gemini/gemini-2.0-flash`
- Costo: pay-per-token (separado del presupuesto actual de la intranet)
- Límite free tier AI Studio: 15 RPM, 1M tokens/día — suficiente para uso interno

### Opción fallback: Groq (gratuita, sin tarjeta de crédito)

- Modelo: `groq/llama-3.3-70b-versatile`
- Costo: $0 — free tier permanente
- Límite: 14,400 requests/día, 131,072 tokens/min
- Calidad: Llama 3.3 70B es comparable a GPT-4 para seguir instrucciones complejas
- Velocidad: más rápido que Gemini en respuesta por ser optimizado para inferencia

### Por qué dos proveedores

Si Gemini agota cuota diaria o tiene un outage, OpenClaw cae automáticamente a Groq sin interrupción del servicio. Groq tiene modelos capaces de leer los `.md` del cerebro y seguir el workflow de compras sin degradación significativa.

### Nota sobre Google AI Pro (licencia de chat)

La suscripción Google AI Pro ($20/mes de gemini.google.com) es un producto de consumo separado de la Gemini API de developer. Algunas herramientas como OpenCode implementan OAuth de Google para consumir modelos a través de esa suscripción. Se deja como investigación futura una vez que OpenClaw esté corriendo — si lo soporta, se activaría sin cambiar el resto del plan.

---

## Docker Compose — Nuevo Servicio

Agregar al `docker-compose.yml` existente **sin modificar los servicios actuales**:

```yaml
openclaw:
  image: ghcr.io/openclaw/openclaw:latest
  container_name: zymo-openclaw
  restart: unless-stopped
  environment:
    - OPENCLAW_PORT=3000
    - GEMINI_API_KEY=${OPENCLAW_GEMINI_API_KEY}
    - GROQ_API_KEY=${OPENCLAW_GROQ_API_KEY}
  volumes:
    - openclaw_data:/root/.openclaw
    - ./Master_plan/MENTE_AGENTE_ADMINISTRATIVO:/root/.openclaw/workspace/brain/administrativo:ro
    - ./Master_plan/ZYMO_CEREBRO_CORE:/root/.openclaw/workspace/brain/zymo:ro
    - ./Master_plan/ZYMO_MASTER_PLAN_v2.1.md:/root/.openclaw/workspace/brain/master_plan.md:ro
  networks:
    - zymo-internal
  # Sin "ports:" expuestos al host — nginx es el único punto de entrada

volumes:
  openclaw_data:
```

**Notas críticas:**
- Los volúmenes de brain se montan con `:ro` (read-only) — OpenClaw puede leer los `.md` pero nunca modificarlos
- El contenedor comparte la red `zymo-internal` con el backend — puede llamar `http://backend:8000` sin exposición al exterior
- Sin puerto expuesto al host — solo nginx llega a OpenClaw

---

## nginx — Nuevo Bloque de Subdominio

Agregar en `nginx.conf` junto a la config existente:

```nginx
# OpenClaw — Subdominio de agentes
server {
    listen 443 ssl;
    server_name agentes.zymointranet.com;

    ssl_certificate /etc/letsencrypt/live/agentes.zymointranet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agentes.zymointranet.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Rate limiting — mismo nivel que el resto de la intranet
    limit_req zone=api burst=30 nodelay;
    limit_req_status 429;

    # Headers de seguridad
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    server_tokens off;

    location / {
        proxy_pass http://openclaw:3000;
        proxy_http_version 1.1;
        # WebSocket — requerido para el chat en tiempo real de OpenClaw
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}

# HTTP → HTTPS redirect para el subdominio
server {
    listen 80;
    server_name agentes.zymointranet.com;
    return 301 https://$host$request_uri;
}
```

**Por qué WebSocket:** OpenClaw usa streaming de texto en tiempo real para las respuestas del agente. Sin el header `Upgrade`, el chat aparecería en blanco o con errores de conexión.

---

## Configuración OpenClaw

**Archivo:** `/root/.openclaw/openclaw.json` (dentro del contenedor, persistido en volumen Docker)

```json
{
  "agent": {
    "model": "gemini/gemini-2.0-flash",
    "fallback_model": "groq/llama-3.3-70b-versatile"
  },
  "auth": {
    "enabled": true,
    "users": [
      { "email": "gerente@zymointranet.com", "role": "admin" },
      { "email": "andres@zymointranet.com", "role": "admin" },
      { "email": "sonia@zymointranet.com", "role": "user" }
    ]
  },
  "workspace": "/root/.openclaw/workspace",
  "sandbox": {
    "enabled": true,
    "network_allow": [
      "generativelanguage.googleapis.com",
      "api.groq.com",
      "backend:8000"
    ],
    "network_deny_all_others": true
  }
}
```

**Puntos críticos de configuración:**

- `auth.enabled: true` — sin esto OpenClaw es público para cualquiera que llegue al subdominio
- `sandbox.network_allow` — lista blanca estricta: Gemini, Groq, y el backend interno. OpenClaw **no puede** llegar a internet general ni a otros servicios internos
- `network_deny_all_others: true` — todo lo que no esté en la lista blanca está bloqueado

---

## Variables de Entorno

Agregar al `.env` del servidor (nunca committear al repo):

```env
# ── OpenClaw (separadas de las variables de la intranet) ──────────────────
OPENCLAW_GEMINI_API_KEY=AIza...           # API key propia de OpenClaw — Google AI Studio
OPENCLAW_GROQ_API_KEY=gsk_...            # Free tier Groq — sin costo
```

**Cómo obtener las keys:**
- Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create API key
- Groq: [console.groq.com](https://console.groq.com) → Create API key (gratis, sin tarjeta)

---

## Cómo OpenClaw usa el cerebro de los agentes

Al recibir una conversación, OpenClaw tiene acceso completo al workspace `/root/.openclaw/workspace/brain/`. El sistema de cada agente se configura apuntando a los archivos correspondientes:

### Agente ZYMO (para gerente y admin)
- Lee: `/workspace/brain/zymo/` + `/workspace/brain/master_plan.md`
- Puede llamar: `GET http://backend:8000/api/gerencial/kpis`, `/api/zymo/reportes`, etc.
- Tono y reglas: definidos en los `.md` del ZYMO_CEREBRO_CORE

### Agente Administrativo (para Sonia y compras)
- Lee: `/workspace/brain/administrativo/`
- Puede llamar HTTP al backend, p. ej. KPIs y listado OC:
  - `GET http://backend:8000/api/oc/kpis` — incluye `reporte_tiempos`: **`texto_para_informe`** (párrafo listo para reportar demoras del proceso), **`metricas`** (tiempos en días con descripciones), y la **sugerencia** de complementar con `GET /api/oc/kpis/tiempos` (promedios por transición en horas y alertas).
  - `GET http://backend:8000/api/oc/kpis/tiempos` — desglose por etapa del flujo (horas); usar junto con `reporte_tiempos` para informes completos.
  - `GET http://backend:8000/api/oc/solicitudes?skip=0&limit=50` — **no** devuelve un array raíz: el JSON es **`{ "items": [ ...solicitudes ], "total": <entero> }`**. Para la siguiente página usar `skip=50`, `skip=100`, etc., hasta agotar `total`. Filtros opcionales: `estado`, `plataforma` (mismos valores que la intranet).
- Workflow de 9 estados definido en los `.md` de MENTE_AGENTE_ADMINISTRATIVO

**Regla de oro:** Si OpenClaw necesita un dato en tiempo real (estado de una solicitud, KPIs actuales), llama al backend. Si necesita contexto de negocio (qué significa cada estado, cómo debe responder), lo lee de los `.md`. Los `.md` son el cerebro; la BD es la fuente de verdad.

---

## SSL — Nuevo Subdominio

El certbot existente se extiende para cubrir el subdominio:

```bash
certbot --nginx -d zymointranet.com -d agentes.zymointranet.com
```

**Requisito previo:** El DNS de `agentes.zymointranet.com` debe apuntar a la misma IP del servidor antes de correr certbot.

---

## Orden de Implementación (sin fallos)

```
Fase 1 — DNS y prerequisitos
  1. Agregar registro DNS: agentes.zymointranet.com → IP del servidor
  2. Verificar que el registro propagó (nslookup agentes.zymointranet.com)
  3. Obtener API keys: Gemini AI Studio + Groq

Fase 2 — Configuración local
  4. Agregar OPENCLAW_GEMINI_API_KEY y OPENCLAW_GROQ_API_KEY al .env del servidor
  5. Agregar el servicio openclaw al docker-compose.yml
  6. Crear openclaw.json con auth y sandbox configurados

Fase 3 — nginx y SSL
  7. Agregar el bloque de subdominio en nginx.conf
  8. Verificar config: nginx -t
  9. Recargar nginx: nginx -s reload (sin reiniciar)
  10. Obtener certificado SSL: certbot --nginx -d agentes.zymointranet.com

Fase 4 — Levantar OpenClaw
  11. docker compose pull openclaw
  12. docker compose up -d openclaw
  13. Verificar logs: docker compose logs -f openclaw

Fase 5 — Verificación
  14. Abrir https://agentes.zymointranet.com → debe pedir login
  15. Login con email configurado → debe entrar al canvas de OpenClaw
  16. Verificar que los archivos .md del brain están accesibles en workspace
  17. Probar conversación: "¿Qué solicitudes hay en estado nueva?"
  18. Verificar que OpenClaw llama a backend:8000 correctamente
  19. Verificar que no puede llegar a otros dominios (sandbox funcionando)
  20. Confirmar que la intranet principal (zymointranet.com) no tuvo impacto
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| DNS no propagado al correr certbot → certificado falla | Media | Verificar con nslookup antes del paso 10 |
| OpenClaw no soporta `fallback_model` nativamente | Media | Si no lo soporta, configurar solo Gemini; Groq se activa manualmente cambiando el modelo |
| Imagen Docker de OpenClaw no está en ghcr.io | Media | Verificar tag correcto en github.com/openclaw/openclaw → Releases |
| OpenClaw necesita más configuración de auth de la documentada | Alta | OpenClaw es proyecto activo — revisar README del repo antes de implementar |
| WebSocket bloqueado por algún firewall intermedio | Baja | Si hay problemas de conexión, agregar `proxy_buffering off` en nginx |
| OpenClaw escala a recursos no autorizados | Baja | Sandbox con `network_deny_all_others: true` lo contiene |
| Nuevo subdominio no cubierto por fail2ban | Media | Agregar jail de nginx para `agentes.zymointranet.com` igual que el dominio principal |
| API key de OpenClaw commiteada por accidente | Baja | `.env` en `.gitignore` — verificar antes de cualquier commit |

---

## Checklist de Verificación Final

- [ ] DNS `agentes.zymointranet.com` apunta al servidor
- [ ] Certificado SSL válido para el subdominio
- [ ] Login en OpenClaw funciona con emails configurados
- [ ] Archivos `.md` del brain visibles en workspace de OpenClaw
- [ ] OpenClaw puede llamar a `backend:8000` (datos en tiempo real)
- [ ] OpenClaw NO puede llegar a internet general (sandbox activo)
- [ ] Rate limiting activo en el subdominio
- [ ] Headers de seguridad presentes en respuestas
- [ ] Intranet principal sin impacto (mismos tiempos de respuesta)
- [ ] API keys en `.env`, no en el repo ni en docker-compose.yml
- [ ] fail2ban cubre el nuevo subdominio

---

## Lo que NO cambia

| Componente | Estado |
|-----------|--------|
| `backend/app/agents/zymo_core.py` | Sin cambios |
| `backend/app/agents/administrativo.py` | Sin cambios |
| `backend/app/agents/worker.py` (APScheduler) | Sin cambios |
| `frontend/src/components/agent/AgentFloatingWindow.tsx` | Sin cambios |
| `.env` variables existentes de la intranet | Sin cambios |
| Base de datos SQLite existente | Sin cambios |
| nginx config actual (zymointranet.com) | Sin cambios — solo se agrega bloque nuevo |

---

## Archivos que se Modifican en Implementación

| Archivo | Cambio |
|---------|--------|
| `docker-compose.yml` | Agregar servicio `openclaw` y volumen `openclaw_data` |
| `nginx/nginx.conf` | Agregar bloque server para `agentes.zymointranet.com` |
| `.env` (servidor) | Agregar `OPENCLAW_GEMINI_API_KEY` y `OPENCLAW_GROQ_API_KEY` |
| `.openclaw/openclaw.json` (nuevo) | Config de auth, modelo, sandbox |
| DNS (registrar) | Nuevo registro A para `agentes.zymointranet.com` |

---

*Versión: 1.0 | Fecha: 2026-04-24 | Enfoque: Capa paralela sin modificar agentes existentes*
