# ZYMO — Plan Maestro de Desarrollo
> Generado: 2026-04-19  
> Para: Claude Code — Desarrollo desde cero  
> Branch: master — Repo: Andresrs1014/zymo-intranet  
> Hacer `git pull` antes de tocar cualquier archivo

---

## Contexto del proyecto

ZYMO Intranet es un sistema interno para Grupo ZYMO (IMCCARGO, LOGIMAT, IMCDEPÓSITO), empresa de logística colombiana. Stack actual: FastAPI + SQLModel + PostgreSQL + React 19 + TypeScript + Tailwind + TanStack Query + Docker. Ya existe y funciona en producción en `zymointranet.com`.

Lo que se va a construir en este plan es completamente nuevo encima de lo que existe — no se toca nada del código actual salvo agregar rutas y roles.

---

## Arquitectura de agentes

```
┌─────────────────────────────────────────────────────┐
│                    API KEY 1 (Gemini)                │
│         ZYMO Core — Módulo Gerencial                 │
│    Gerente General / Andrea Reyes / Andrés           │
└─────────────────┬───────────────────────────────────┘
                  │ pregunta cada 2 horas
                  ▼
┌─────────────────────────────────────────────────────┐
│                    API KEY 2 (Gemini)                │
│         Agente Administrativo — Sonia Gómez          │
│    Sub-agentes: OC/Compras, Documentos RAG           │
└─────────────────────────────────────────────────────┘
```

**API Key 1** → Cuenta Google #1 → Para ZYMO Core y módulo gerencial  
**API Key 2** → Cuenta Google #2 → Para Agente Administrativo y sub-agentes  
Cada cuenta tiene 1M tokens/día gratis → Total: 2M tokens/día gratis

---

## Variables de entorno nuevas a agregar en .env

```env
# Base de datos
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/zymo

# Agentes - API Keys separadas
GEMINI_API_KEY_GERENCIAL=key_cuenta_google_1
GEMINI_API_KEY_ADMINISTRATIVO=key_cuenta_google_2

# Perplexity (noticias IA para el gerente)
PERPLEXITY_API_KEY=key_perplexity

# Agentes config
AGENT_CHECK_INTERVAL_MINUTES=120
AGENT_DOCS_DIR=/app/data/agent_docs
AGENT_LOGS_DIR=/app/data/agent_logs
AGENT_MEMORY_DIR=/app/data/agent_memory
```

---

## Dependencias nuevas — agregar a requirements.txt

```
asyncpg>=0.29.0
psycopg2-binary>=2.9.0
google-generativeai>=0.8.0
chromadb>=0.5.0
sentence-transformers>=3.0.0
apscheduler>=3.10.0
httpx>=0.27.0
```

---

## Estructura de carpetas nueva

```
backend/app/
├── agents/
│   ├── __init__.py
│   ├── base.py                    # Clase base de todos los agentes
│   ├── zymo_core.py               # Orquestador principal - API Key 1
│   ├── administrativo.py          # Agente de Sonia - API Key 2
│   ├── worker.py                  # Proceso persistente (scheduler)
│   └── tools/
│       ├── __init__.py
│       ├── oc_tools.py            # Consultas a schema: oc (PostgreSQL)
│       ├── doc_tools.py           # Búsqueda en documentos RAG
│       ├── memory_tools.py        # Memoria persistente por usuario
│       ├── intranet_tools.py      # KPIs y métricas globales
│       └── perplexity_tools.py    # Noticias de IA para el gerente
├── routers/
│   ├── agentes.py                 # Endpoints de agentes (NUEVO)
│   └── gerencial.py               # Endpoints módulo gerencial (NUEVO)
└── data/
    ├── agent_docs/                # PDFs e instructivos subidos
    ├── agent_logs/                # Markdowns de historial de sesiones
    ├── agent_memory/              # Memoria persistente JSON por usuario
    └── chroma_db/                 # Base vectorial ChromaDB
```

```
frontend/src/
├── pages/
│   ├── gerencial/
│   │   ├── GerencialPage.tsx      # Dashboard principal gerencia
│   │   ├── GerencialGerente.tsx   # Vista del gerente general
│   │   ├── GerencialAndrea.tsx    # Vista de Andrea Reyes
│   │   └── GerencialAndres.tsx    # Vista de Andrés (dev)
│   └── administrativo/
│       └── AsistenteIA.tsx        # Panel del agente de Sonia
├── components/
│   └── agent/
│       ├── AgentFloatingWindow.tsx  # Ventana flotante del agente
│       ├── AgentStatusBar.tsx       # Barra de estado minimizada
│       └── AgentMessageStream.tsx   # Stream de respuesta en tiempo real
└── hooks/
    ├── useAgent.ts                  # Hook para interactuar con agentes
    └── useGerencial.ts              # Hook para datos gerenciales
```

---

## Base de datos nueva — schema: agents (PostgreSQL)

Crear `backend/app/agent_database.py` siguiendo el patrón de `oc_database.py`.

```python
# Tablas requeridas:

# Sesiones del agente con cada usuario
agent_sessions:
  id: UUID PK
  user_id: int  # referencia a schema: intranet (PostgreSQL) sin FK
  user_email: str
  agente: str   # "zymo_core" | "administrativo" | "documentos"
  inicio: datetime
  fin: datetime | None
  resumen: str | None
  tokens_usados: int

# Cada acción que tomó el agente
agent_actions:
  id: UUID PK
  session_id: UUID FK
  tipo: str     # "respuesta" | "busqueda" | "sugerencia" | "reporte"
  input: str
  output: str
  timestamp: datetime
  modelo_usado: str
  tokens: int

# Memoria persistente por usuario (clave-valor)
agent_memory:
  id: UUID PK
  user_email: str
  clave: str
  valor: str    # JSON serializado
  updated_at: datetime

# Documentos indexados en RAG
agent_documentos:
  id: UUID PK
  nombre: str
  ruta: str
  tipo: str     # "procedimiento" | "instructivo" | "politica"
  area: str     # "administrativo" | "sgc" | "general"
  indexado_at: datetime
  chunks_count: int
  subido_por_id: int

# Tareas de Andrés para ZYMO
dev_tareas:
  id: UUID PK
  titulo: str
  descripcion_tecnica: str
  descripcion_gerencial: str | None  # ZYMO la genera
  impacto: str | None                # ZYMO evalúa el impacto
  tiempo_horas: float | None
  fecha: date
  estado: str   # "completada" | "en_progreso" | "bloqueada"
  created_at: datetime

# Reportes automáticos de ZYMO
zymo_reportes:
  id: UUID PK
  tipo: str     # "ronda_2h" | "diario" | "semanal" | "alerta"
  contenido: str  # JSON con el reporte
  destinatario: str  # "gerente" | "andrea" | "andres"
  leido: bool
  created_at: datetime
```

---

## PARTE 1 — Agente de Documentos (RAG)
**Construir primero — todos los demás lo necesitan**

### Qué hace
- Recibe PDFs, Word, imágenes de procedimientos e instructivos
- Los divide en chunks de ~500 tokens con overlap de 50
- Los convierte en embeddings con sentence-transformers
- Los guarda en ChromaDB
- Busca por similitud semántica cuando alguien pregunta algo

### Endpoints
```
POST /api/agentes/documentos/subir
  - Recibe: archivo + metadatos (nombre, tipo, area)
  - Procesa: extrae texto, genera embeddings, guarda en ChromaDB
  - Responde: {id, chunks_generados, status}

GET /api/agentes/documentos/buscar?q=texto&area=administrativo
  - Busca en ChromaDB por similitud
  - Responde: [{documento, fragmento, relevancia, ruta}]

GET /api/agentes/documentos/listar
  - Lista todos los documentos indexados con metadata
  
DELETE /api/agentes/documentos/{id}
  - Elimina documento de ChromaDB y de agent_documentos
```

### Lógica de búsqueda
```python
def buscar_documentos(query: str, area: str = None, top_k: int = 3):
    # 1. Convertir query a embedding
    # 2. Buscar en ChromaDB por cosine similarity
    # 3. Filtrar por área si se especifica
    # 4. Retornar top_k chunks más relevantes con metadata
    # 5. Guardar búsqueda en agent_actions para historial
```

---

## PARTE 2 — Agente Administrativo (Sonia)
**API Key 2 — Cuenta Google #2**

### Identidad del agente
```
Nombre: Asistente Administrativo ZYMO
Usuario principal: Sonia Gómez — Directora Administrativa
Áreas que conoce: OC/Compras, SGC, SIG, T&C, Mantenimiento
Tono: Profesional, directo, proactivo
Idioma: Español colombiano
```

### Tools disponibles (lo que puede hacer)
```python
# PUEDE:
consultar_solicitudes_oc(estado=None, limite=10)
consultar_cotizaciones_pendientes()
buscar_documento(query, area="administrativo")
crear_sugerencia(texto, prioridad)
ver_kpis_oc()
ver_tiempos_proceso_oc()        # NUEVO — tiempos por etapa
registrar_accion_en_markdown()  # Guarda en agent_logs

# NO PUEDE (permisos bloqueados):
aprobar_cotizaciones()          # Solo Sonia manualmente
eliminar_registros()
acceder_datos_otras_areas()
enviar_emails_sin_confirmacion()
```

### Bienvenida personalizada al login
```
Cuando Sonia inicia sesión:
1. Detectar login por JWT (user.email == sonia.gomez@zymo.com)
2. Consultar: OCs pendientes de aprobación, cotizaciones nuevas, 
   tareas del día, alertas de tiempo excedido
3. Mostrar en ventana flotante minimizada:
   "Hola Sonia, soy tu asistente IA. 
    Hoy tienes: X cotizaciones por aprobar, Y solicitudes nuevas.
    [Ver detalle]"
```

### Sugerencias automáticas en segundo plano
```
Cada 30 minutos verificar:
- ¿Hay cotizaciones sin revisar hace más de 48h? → Alerta
- ¿Alguna OC lleva más tiempo del promedio en su estado? → Sugerencia
- ¿Hay proveedor con múltiples OCs históricas? → Sugerencia de negociación
- ¿Algún proceso está bloqueado? → Notificación
```

### Endpoints
```
POST /api/agentes/administrativo/chat
  - Recibe: {mensaje, session_id}
  - Procesa: Gemini API Key 2 con tools
  - Responde: {respuesta, acciones_tomadas, stream: true}

GET /api/agentes/administrativo/sugerencias
  - Retorna sugerencias activas no descartadas

POST /api/agentes/administrativo/sugerencia/{id}/descartar
  - Marca sugerencia como descartada

GET /api/agentes/administrativo/estado
  - Resumen del área para la ventana flotante al login
```

---

## PARTE 3 — Control de Tiempos OC (nuevo en módulo existente)

### Qué medir
Cada transición de estado en `oc_solicitudes` debe registrar el tiempo que tardó:

```
nueva → en_cotizacion:           tiempo de asignación
en_cotizacion → pendiente_aprobacion:  tiempo de cotización  
pendiente_aprobacion → aprobada:       tiempo de aprobación
aprobada → oc_enviada:                 tiempo de generación OC
oc_enviada → oc_en_plataforma:         tiempo de ingreso plataforma
oc_en_plataforma → entregada:          tiempo de entrega
entregada → cerrada:                   tiempo de cierre
```

### Cambios en schema: oc (PostgreSQL)
```python
# Agregar tabla nueva:
oc_tiempos_estado:
  id: UUID PK
  solicitud_id: UUID FK
  estado_desde: str
  estado_hasta: str
  duracion_horas: float
  usuario_id: int
  timestamp: datetime

# Agregar a SolicitudOC model:
tiempo_total_horas: float | None  # calculado al cerrar
```

### Endpoints nuevos en router OC
```
GET /api/oc/kpis/tiempos
  - Promedio de tiempo por etapa
  - Solicitudes que exceden el promedio
  - Ranking de auxiliares por velocidad de gestión

GET /api/oc/solicitudes/{id}/tiempos
  - Timeline completo de una solicitud específica
```

---

## PARTE 4 — ZYMO Core (Orquestador)
**API Key 1 — Cuenta Google #1**  
**Worker persistente — corre 24/7 en Docker**

### Qué hace
```
1. Cada 2 horas → pregunta al Agente Administrativo:
   "¿Cómo van las tareas? ¿Alguna alerta?"
   
2. Sintetiza la respuesta en lenguaje ejecutivo

3. Guarda reporte en zymo_reportes

4. Si hay alerta crítica → notificación inmediata al gerente

5. Está disponible 24/7 para recibir preguntas del gerente y de Andrés
```

### Tools disponibles
```python
# PUEDE:
preguntar_agente_administrativo(query)
ver_metricas_intranet()           # KPIs globales de toda la plataforma
ver_estado_docker()               # Estado de contenedores
buscar_noticias_ia(query)         # Perplexity API
leer_tareas_andres()              # dev_tareas de la DB
generar_reporte_ejecutivo()       # Para el gerente
leer_todos_markdowns_historial()  # Para contexto acumulado
```

### Worker (proceso persistente)
```python
# backend/app/agents/worker.py
# Usar APScheduler para tareas programadas

scheduler.add_job(ronda_supervisora, 'interval', hours=2)
scheduler.add_job(reporte_diario, 'cron', hour=8, minute=0)
scheduler.add_job(reporte_semanal, 'cron', day_of_week='mon', hour=7)
scheduler.add_job(verificar_alertas, 'interval', minutes=15)
```

### Docker — nuevo servicio en docker-compose.yml
```yaml
zymo-worker:
  build: ./backend
  command: python -m app.agents.worker
  environment:
    - GEMINI_API_KEY_GERENCIAL=${GEMINI_API_KEY_GERENCIAL}
  volumes:
    - backend_data:/app/data
  restart: always
  depends_on:
    - backend
```

### Endpoints
```
POST /api/zymo/chat
  - Solo accesible para roles: gerente, admin, dev
  - Recibe: {mensaje, session_id}
  - Stream de respuesta

GET /api/zymo/reportes
  - Lista reportes generados, paginados

GET /api/zymo/reportes/ultimo
  - El reporte más reciente para mostrar al login del gerente

GET /api/zymo/estado-intranet
  - Snapshot actual de toda la plataforma
```

---

## PARTE 5 — Ventana Flotante del Agente (Frontend)

### Comportamiento
```
Estado: minimizado (por defecto al login)
  → Muestra: barra pequeña abajo a la derecha con nombre del agente
             + indicador si está procesando algo
             + badge con notificaciones pendientes

Estado: expandido (al hacer clic o cuando el agente termina una tarea)
  → Muestra: panel lateral derecho ~400px de ancho
             sin bloquear el contenido principal
             con el stream de respuesta en tiempo real
             botón para minimizar

Estado: procesando en segundo plano
  → Barra minimizada muestra spinner
  → Cuando termina: "✓ Tarea completada — ver resultado"
```

### Componente AgentFloatingWindow.tsx
```typescript
// Props:
interface AgentFloatingWindowProps {
  agente: "administrativo" | "zymo"
  usuarioEmail: string
  visible: boolean
}

// Estados internos:
type WindowState = "minimized" | "expanded" | "processing"

// Features:
// - Draggable (se puede mover en la pantalla)
// - Persistent (no desaparece al navegar entre páginas)
// - Stream real-time de respuestas via SSE o WebSocket
// - Historial de la sesión actual scrolleable
// - Input de texto + botón enviar
// - Indicador "trabajando en segundo plano..."
```

### Integración en App.tsx
```typescript
// El componente vive en el layout raíz
// Se monta una sola vez y persiste entre navegación
// Se activa según el rol del usuario:
//   - rol "compras" o "administrativo" → AgentFloatingWindow agente="administrativo"
//   - rol "gerente" o "admin" o "dev" → AgentFloatingWindow agente="zymo"
```

---

## PARTE 6 — Módulo Gerencial (desde cero)

### Roles y acceso
```python
# Solo visible para estos roles (agregar a permisos existentes):
ROLES_GERENCIAL = {"gerente", "admin", "dev"}

# Rutas protegidas:
/gerencial/*  → require_gerencial dependency
```

### Vista Gerente General
```
Dashboard principal con:
├── KPIs en tiempo real de toda la intranet
│   ├── OCs activas / pendientes / cerradas esta semana
│   ├── Usuarios activos hoy
│   ├── Estado de cada módulo (OC, SGC, Financiero, etc.)
│   └── Alertas activas
├── Último reporte de ZYMO (generado automáticamente)
├── Feed de actividad reciente de todas las áreas
├── Sección "IA en el mercado" — noticias via Perplexity
│   └── Actualización diaria automática
└── Chat con ZYMO (ventana flotante)
```

### Vista Andrea Reyes (Directora de Desarrollo)
```
Dashboard enfocado en el equipo de dev:
├── Tareas de Andrés — listado visual con estados
│   ├── Completadas esta semana
│   ├── En progreso
│   └── Bloqueadas
├── Tiempos de implementación por tarea
├── Impacto de cada cambio (ZYMO lo explica en lenguaje ejecutivo)
│   Ejemplo: "Andrés corrigió el formateo de valores monetarios.
│             Impacto: los auxiliares de compras ya no ingresan
│             valores incorrectos en las facturas — elimina
│             reprocesos estimados en 2h/semana."
├── Gráficos de progreso del proyecto (muy visual)
│   ├── Burndown de módulos
│   ├── Velocidad de desarrollo por semana
│   └── Comparativa planeado vs real
└── Chat con ZYMO para consultas técnicas
```

### Vista Andrés (Dev)
```
Panel de registro de trabajo:
├── Formulario "¿Qué hice hoy?"
│   ├── Título técnico (para el registro)
│   ├── Descripción técnica detallada
│   ├── Tiempo invertido (horas)
│   └── Estado: completado / en progreso / bloqueado
├── ZYMO genera automáticamente:
│   ├── Descripción en lenguaje de negocio
│   └── Evaluación de impacto ("Este cambio salva X horas/semana")
├── Historial de todas las tareas registradas
├── Métricas personales:
│   ├── Horas por módulo esta semana
│   ├── Tareas completadas vs planeadas
│   └── Velocidad promedio por tipo de tarea
└── Acceso directo a logs de ZYMO y estado del servidor
```

### Endpoints gerenciales
```
GET /api/gerencial/kpis
  - KPIs globales de toda la plataforma en tiempo real

GET /api/gerencial/actividad
  - Feed de actividad reciente de todas las áreas

POST /api/gerencial/tareas-dev
  - Andrés registra una tarea completada

GET /api/gerencial/tareas-dev
  - Lista tareas con descripción gerencial generada por ZYMO

GET /api/gerencial/noticias-ia
  - Últimas noticias de IA via Perplexity (cache de 24h)

GET /api/gerencial/estado-servidor
  - Estado de contenedores Docker, uso de recursos
```

---

## PARTE 7 — Sistema de Markdowns (memoria para futura IA)

### Qué se guarda automáticamente por cada sesión

```markdown
# Sesión {agente} — {fecha} — {usuario}
**Duración:** X minutos
**Tokens usados:** X

## Contexto del usuario al inicio
- OCs pendientes: X
- Alertas activas: X
- Último login: hace X horas

## Conversación resumida
[Resumen de lo que se habló, no transcript completo]

## Acciones tomadas por el agente
- {timestamp} {tipo_accion}: {descripcion}

## Sugerencias generadas
- [ACEPTADA/IGNORADA/PENDIENTE] {texto_sugerencia}

## Campos autocompletados
- {campo} en {formulario}: sugerido "{valor}" → {aceptado/rechazado}

## Patrones detectados
- {descripcion_patron}

## Resultado final
{resumen_ejecutivo_de_la_sesion}
```

### Dónde se guardan
```
/app/data/agent_logs/
├── administrativo/
│   ├── 2026-04-19_sonia.gomez_001.md
│   └── 2026-04-20_sonia.gomez_001.md
├── zymo/
│   ├── 2026-04-19_gerente_001.md
│   └── 2026-04-19_andres_001.md
└── reportes/
    ├── 2026-04-19_reporte_2h.md
    └── 2026-04-19_reporte_diario.md
```

---

## Orden de implementación

```
SEMANA 1:

Día 1:
  [ ] Conseguir API Key Gemini cuenta #1 y #2 (aistudio.google.com)
  [ ] Agregar variables al .env
  [ ] Instalar dependencias nuevas (requirements.txt)
  [ ] Crear estructura de carpetas agents/
  [ ] Crear agent_database.py con todas las tablas
  [ ] Crear agents/base.py con clase base

Día 2:
  [ ] Construir Agente de Documentos completo (RAG)
  [ ] Crear endpoints /api/agentes/documentos/*
  [ ] Probar subida y búsqueda con un procedimiento real

Día 3:
  [ ] Agregar tabla oc_tiempos_estado a schema: oc (PostgreSQL)
  [ ] Implementar registro de tiempos en cada cambio de estado
  [ ] Endpoints /api/oc/kpis/tiempos y /api/oc/solicitudes/{id}/tiempos
  [ ] Construir Agente Administrativo con tools de OC
  [ ] Endpoint /api/agentes/administrativo/chat

Día 4:
  [ ] Frontend: AgentFloatingWindow.tsx
  [ ] Frontend: AgentStatusBar.tsx minimizada
  [ ] Frontend: Stream de respuesta en tiempo real (SSE)
  [ ] Integrar ventana flotante en App.tsx según rol

Día 5:
  [ ] Construir ZYMO Core con tools de supervisión
  [ ] Crear worker.py con APScheduler
  [ ] Agregar servicio zymo-worker al docker-compose.yml
  [ ] Sistema de Markdowns automático

SEMANA 2:

Día 1-2:
  [ ] Módulo Gerencial backend — todos los endpoints
  [ ] Vista Gerente General (frontend)
  [ ] Vista Andrea Reyes (frontend)
  [ ] Vista Andrés (frontend)

Día 3:
  [ ] Integración Perplexity API para noticias IA
  [ ] ZYMO genera descripción gerencial de tareas dev
  [ ] Prueba piloto con Sonia — ventana flotante

Día 4-5:
  [ ] Ajustes según feedback de Sonia
  [ ] Prueba con el gerente
  [ ] PWA — hacer la intranet instalable en móvil
  [ ] Panel de estado del servidor en móvil
```

---

## Notas críticas para Claude Code

1. **Siempre `git pull` antes de cualquier cambio**

2. **No tocar estos archivos existentes sin leerlos completo primero:**
   - `backend/app/routers/oc/documentos.py` — lógica compleja de generación OC
   - `backend/app/models/oc.py` — agregar campos sin romper migraciones
   - `frontend/src/App.tsx` — agregar rutas con cuidado

3. **Las 3 DBs siguen separadas** — schema: agents (PostgreSQL) no tiene FK constraints hacia schema: oc (PostgreSQL) ni schema: intranet (PostgreSQL). Es intencional.

4. **El worker de Docker** debe reiniciarse automáticamente (`restart: always`) — si cae, ZYMO deja de funcionar.

5. **Stream de respuestas** — usar SSE (Server-Sent Events) para el streaming del agente, no WebSocket. Es más simple y FastAPI lo soporta nativamente con `StreamingResponse`.

6. **Gemini SDK** — usar `google-generativeai`, no la REST API directa. El SDK maneja reintentos y rate limiting automáticamente.

7. **ChromaDB** — inicializar con `persist_directory="/app/data/chroma_db"` para que los vectores sobrevivan reinicios de Docker.

8. **Los Markdowns son sagrados** — cada sesión del agente debe guardarse sin excepción. Son los datos de entrenamiento del futuro modelo ZYMO propio.

9. **No crear tests automatizados** — el servidor no tiene recursos para eso en esta etapa. Las pruebas son manuales con Sonia como piloto.

10. **Perplexity API** — usar solo para el módulo de noticias IA del gerente. No para los agentes operativos — Gemini es suficiente y más barato.
