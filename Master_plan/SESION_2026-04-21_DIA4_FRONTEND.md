# Sesión 2026-04-21 — Día 4: Frontend Agente Flotante
> Claude Code — Reporte de sesión completo
> Branch: master

---

## Archivos creados

### `frontend/src/hooks/useAgent.ts`
Hook central del agente. Responsabilidades:
- Estado del chat: `messages`, `isStreaming`, `bienvenida`, `error`
- `cargarBienvenida()` → POST `/api/agentes/administrativo/bienvenida` — se llama al montar
- `sendMessage(texto)` → POST `/api/agentes/administrativo/chat` con fetch + ReadableStream (SSE)
- Parsea líneas `data: {chunk: "..."}` y acumula en el último mensaje del agente en tiempo real
- `cancelStream()` → AbortController para interrumpir el stream
- **Por qué fetch y no axios**: axios no soporta streaming nativo. fetch + ReadableStream es el estándar para SSE en POST.

### `frontend/src/components/agent/AgentMessageStream.tsx`
Componente de un solo mensaje en el chat.
- Burbuja izquierda (agente, gris) o derecha (usuario, azul)
- Cursor parpadeante en el último mensaje del agente mientras streama

### `frontend/src/components/agent/AgentFloatingWindow.tsx`
Ventana flotante principal — dos estados en un solo componente:

**Minimizado:** barra pequeña bottom-right
- Badge rojo con conteo de alertas (alertas OC + cotizaciones pendientes)
- Indicador verde pulsante cuando está streaming en segundo plano
- Click → expande

**Expandido:** panel 380×560px
- Header azul arrastrable (drag con mousedown/mousemove/mouseup en document)
- Posición: `bottom:20 right:20` por defecto. Al arrastrar cambia a `top/left` absoluto
- Alertas de bienvenida visibles cuando hay mensajes recientes
- Lista de mensajes con scroll automático al último
- Input multilínea (Enter envía, Shift+Enter = salto de línea)
- Botón "Detener" visible durante streaming

---

## Archivos modificados

### `frontend/src/App.tsx`
- Import de `AgentFloatingWindow`
- Nuevo componente `AgentLayer` (fuera del árbol de Routes) que lee el rol del usuario
- `<AgentLayer />` montado una vez, persiste entre navegación
- Visible para roles: `admin`, `administrativo`, `compras`, `directivo`

---

## Estado del plan maestro (actualizado)

### ✅ Completado
- **Día 1:** Infraestructura base
- **Día 2:** Agente de Documentos RAG
- **Día 3:** Control de Tiempos OC + Agente Administrativo
- **Día 4:** Frontend flotante (hook + 2 componentes + integración App.tsx)

### ❌ Pendiente
- **Día 5:** ZYMO Core + worker.py (APScheduler) + docker-compose zymo-worker
- **Semana 2:** Módulo Gerencial + piloto Sonia + PWA

---

## Notas técnicas para el Día 5

### AgentLayer no tiene BrowserRouter context
`AgentLayer` está fuera de `<Routes>` pero dentro de `<BrowserRouter>`. Si necesita navigation hooks en el futuro, ya tiene acceso.

### Para ZYMO Core (Día 5)
Cuando se implemente el agente gerencial, agregar a `AgentLayer`:
```typescript
// Agentes según rol:
// compras/administrativo/directivo → "administrativo" (Gemini Key 2)
// admin/gerente/dev → "zymo" (Gemini Key 1)
const agente = ROLES_GERENCIAL.has(user.role) ? "zymo" : "administrativo"
```
El backend de ZYMO Core irá en `/api/zymo/chat` — crear nuevo endpoint y nuevo case en `useAgent.ts`.

### Drag en móvil
El drag actual usa mouse events. Para soporte táctil en móvil (PWA), agregar touch events:
`onTouchStart`, `onTouchMove`, `onTouchEnd` con `e.touches[0]`. Implementar en la fase PWA (Semana 2).

### Historial de sesión
El historial se pasa al backend en cada mensaje para que Gemini tenga contexto de la conversación. Limitación: si hay muchos mensajes, el prompt puede crecer. En iteraciones futuras, truncar a los últimos N mensajes.

---

## Extras implementados fuera del plan de agentes (misma sesión)

- **SLA en dropdown de prioridad** (`NuevaSolicitudPage.tsx`): opciones muestran "Alta — primera respuesta en 4 horas" etc.
- **Badge SLA en tarjetas** (`MisSolicitudesPage.tsx`): muestra tiempo restante o "SLA vencido" cuando la solicitud está en estado `nueva`
- **Restricción cambio de prioridad**: solo `admin` y `administrativo` pueden cambiar la prioridad (backend 403 + frontend oculta el control para directivo y compras)

---

*Fecha: 2026-04-21 | Branch: master | Próximo: Día 5 — ZYMO Core + worker + docker-compose*
