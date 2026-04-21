# Sesión 2026-04-21 — Día 3: Control de Tiempos OC + Agente Administrativo
> Claude Code — Reporte de sesión completo
> Branch: master

---

## Decisión clave — no se creó `oc_tiempos_estado`

El Master Plan v2 indicaba crear una tabla nueva `oc_tiempos_estado`. **Se descartó** porque `HistorialEstado` ya existe, ya está siendo poblada por cada cambio de estado en solicitudes.py, y tiene todo lo necesario (solicitud_id, estado_anterior, estado_nuevo, fecha, usuario). Crear otra tabla habría sido duplicar datos.

**Beneficio:** cero migración de base de datos, cero riesgo de romper algo existente.

---

## Archivos creados

### `backend/app/agents/tools/oc_tools.py`
5 funciones que Gemini puede invocar como tools:

| Función | Qué hace |
|---------|---------|
| `consultar_solicitudes_oc(estado, limite)` | Lista solicitudes recientes por estado |
| `consultar_cotizaciones_pendientes()` | Cotizaciones sin aprobar + horas esperando |
| `ver_kpis_oc()` | Resumen ejecutivo con alertas automáticas |
| `ver_tiempos_proceso_oc(limite)` | Promedios por etapa + detección de etapas lentas |
| `ver_timeline_solicitud(id)` | Timeline completo de una solicitud específica |

**Lógica de alertas en `ver_kpis_oc()`:**
- `nueva > 5` → alerta de solicitudes sin asignar
- `cotizaciones_pendientes > 0` → siempre alerta
- `pendiente_aprobacion > 3` → alerta de cuello de botella

**Tiempos límite por etapa** (en `_TIEMPO_LIMITE_HORAS`):
```
nueva → en_cotizacion:           4h
en_cotizacion → pendiente:      48h
pendiente → aprobada:           24h
aprobada → oc_enviada:           8h
oc_enviada → oc_en_plataforma:  24h
oc_en_plataforma → entregada:  168h (7 días)
entregada → cerrada:            48h
```

### `backend/app/agents/administrativo.py`
Clase `AgenteAdministrativo` que extiende `BaseAgent`.

- Usa `GEMINI_API_KEY_ADMINISTRATIVO` (fallback a GERENCIAL si no está configurada)
- System prompt en español colombiano con identidad clara de Sonia's assistant
- `generar_bienvenida(nombre)` — mensaje personalizado al login
- `responder_con_contexto(mensaje, historial)` — detecta si la pregunta es sobre OC y enriquece el contexto con datos reales antes de llamar a Gemini

---

## Archivos modificados

### `backend/app/routers/agentes.py`
5 endpoints nuevos bajo `/api/agentes/administrativo/*`:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/agentes/administrativo/estado` | KPIs y alertas para la ventana flotante |
| POST | `/api/agentes/administrativo/chat` | Chat streaming SSE con el agente |
| POST | `/api/agentes/administrativo/bienvenida` | Mensaje personalizado al login |
| GET | `/api/agentes/administrativo/sugerencias` | Sugerencias en tiempo real (el scheduler viene en Día 5) |

**El chat usa SSE (Server-Sent Events):**
```
data: {"chunk": "Hola Sonia"}\n\n
data: {"chunk": ", tienes 3"}\n\n
data: {"done": true}\n\n
```
El header `X-Accel-Buffering: no` desactiva el buffering de nginx automáticamente.

### `backend/app/routers/oc/kpis.py`
Nuevo endpoint:
- `GET /api/oc/kpis/tiempos` — promedios de tiempo por etapa, últimas 100 solicitudes

### `backend/app/routers/oc/solicitudes.py`
Nuevo endpoint:
- `GET /api/oc/solicitudes/{id}/tiempos` — timeline completo de una solicitud con duración por etapa

---

## Estado del plan maestro (actualizado)

### ✅ Completado
- **Día 1:** Infraestructura base (agent_database, base.py, config, requirements)
- **Día 2:** Agente de Documentos RAG (lightrag_service, doc_tools, router)
- **Día 3:** Control de Tiempos OC + Agente Administrativo

### ❌ Pendiente
- **Día 4:** Frontend (AgentFloatingWindow, AgentStatusBar, stream SSE, useAgent.ts)
- **Día 5:** ZYMO Core + worker.py (APScheduler) + docker-compose zymo-worker
- **Semana 2:** Módulo Gerencial completo + piloto Sonia + PWA

---

## Notas para el Día 4 (Frontend)

### Leer antes de tocar
- `frontend/src/App.tsx` — agregar rutas de agente con cuidado
- Revisar cómo está implementado el sistema de auth en el frontend (hooks de usuario)

### El stream SSE en React
```typescript
// Patrón para consumir el SSE del backend
const eventSource = new EventSource('/api/agentes/administrativo/chat', {
  // No es GET, necesitas un fetch con ReadableStream
});

// Mejor usar fetch + ReadableStream:
const response = await fetch('/api/agentes/administrativo/chat', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ mensaje }),
});
const reader = response.body.getReader();
// Leer chunks y acumular
```

### Componentes a crear (según Master Plan)
```
frontend/src/components/agent/
  ├── AgentFloatingWindow.tsx  — ventana principal (draggable, minimizable)
  ├── AgentStatusBar.tsx       — barra minimizada con badge de notificaciones
  └── AgentMessageStream.tsx  — renderiza el stream de respuesta en tiempo real

frontend/src/hooks/
  ├── useAgent.ts              — lógica de fetch + SSE + historial
  └── useGerencial.ts          — datos del módulo gerencial (Semana 2)
```

### Estado del agente según rol
```typescript
// En App.tsx o en el layout raíz:
// rol "compras" | "administrativo" → agente = "administrativo"
// rol "gerente" | "admin" | "dev" → agente = "zymo" (Día 5)
```

### API de bienvenida — llamar al login
```typescript
// Cuando el usuario se autentica, llamar:
POST /api/agentes/administrativo/bienvenida
// → retorna { mensaje, alertas, cotizaciones_pendientes }
// Mostrar en AgentStatusBar minimizada con badge si hay alertas
```

---

## Cosas que NO se implementaron intencionalmente

1. **Sugerencias persistentes** — el endpoint `/sugerencias` retorna datos en tiempo real. Las sugerencias persistentes (generadas por APScheduler cada 30 min) van en el Día 5 con el worker.

2. **`oc_tiempos_estado`** — se usa `HistorialEstado` existente en su lugar.

3. **Tool use de Gemini (function calling)** — el agente actualmente enriquece el contexto manualmente antes de llamar a Gemini (`responder_con_contexto`). El function calling nativo de Gemini (donde Gemini decide qué tool llamar) se puede implementar en iteraciones futuras si el comportamiento actual no es suficiente para Sonia.

---

*Fecha: 2026-04-21 | Branch: master | Próximo: Día 4 — Frontend AgentFloatingWindow*
