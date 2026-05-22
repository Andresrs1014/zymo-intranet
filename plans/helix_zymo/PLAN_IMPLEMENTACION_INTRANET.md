# Plan de Implementación: Helix Zymo en la Intranet Zymo
**Versión definitiva — decisiones arquitectónicas confirmadas**

---

## Decisiones Arquitectónicas (Acordadas)

| Decisión | Valor |
|---|---|
| Módulo en intranet | `Planeación` (sección nueva en sidebar) |
| Backend | Node.js + Express + TypeScript propio (contenedor nuevo) |
| Base de datos | PostgreSQL propio (contenedor nuevo) |
| ORM | Prisma |
| Auth | JWT de secreto compartido con la intranet FastAPI |
| Agentes IA | Node.js → HTTP interno → FastAPI intranet |
| Frontend | Dentro del React existente de la intranet |
| UI fidelidad | Idéntica al template HTML/CSS/JS, refactorizada en React |
| Lógica | Todas las funciones flotantes del template → hooks y servicios tipados |

---

## Arquitectura Final

```
┌──────────────────────────────────────────────────────────────────┐
│           FRONTEND INTRANET (React + TS — existente)             │
│                                                                  │
│  Sidebar: ... | Planeación > Helix Zymo  ← nuevo                │
│                                                                  │
│  /planeacion/helix  → HelixPage.tsx  → llama a helix-backend    │
│  /resto-intranet    → páginas existentes → llama a backend       │
└──────────────────────────────────────────────────────────────────┘
         │  (JWT intranet)                │  (JWT intranet)
         ▼                               ▼
┌─────────────────────┐       ┌──────────────────────────────────┐
│  helix-backend      │       │  backend (FastAPI — existente)   │
│  Node.js + Express  │──────▶│  /api/agentes/helix  ← nuevo     │
│  Puerto 3001        │ HTTP  │  Puerto 8001                     │
│  (contenedor nuevo) │ int.  │  (contenedor existente)          │
└─────────────────────┘       └──────────────────────────────────┘
         │                                │
         ▼                               ▼
┌─────────────────────┐       ┌──────────────────────────────────┐
│  helix-db           │       │  backend_data / DB intranet      │
│  PostgreSQL         │       │  (volumen existente)             │
│  Puerto 5433        │       └──────────────────────────────────┘
│  (contenedor nuevo) │
└─────────────────────┘
```

### Red Docker
Todos los contenedores comparten la misma red Docker Compose. `helix-backend` accede a
`backend:8001` vía nombre de servicio. Ningún puerto de `helix-db` se expone externamente.

---

## Auth: JWT de Secreto Compartido

El usuario inicia sesión en la intranet → recibe JWT firmado por FastAPI.
El frontend envía ese mismo JWT en cada request a `helix-backend`.
Node.js lo verifica con el mismo `JWT_SECRET` que tiene FastAPI.

```typescript
// helix-backend/src/middleware/auth.ts
import jwt from "jsonwebtoken";

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload;  // { id, email, nombre, rol, ... }
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}
```

```yaml
# docker-compose.yml — helix-backend env
environment:
  - JWT_SECRET=${JWT_SECRET}   # mismo valor que usa el backend FastAPI
```

**Implicación:** Los `responsables` de actividades en Helix son los usuarios de la intranet.
El `req.user.id` identifica al usuario actual sin llamadas adicionales.

---

## Agentes IA: Node.js → FastAPI Interno

Node.js empaca el contexto de Helix y llama al endpoint de agentes del FastAPI existente.
El agente Python procesa con todo su stack (Ollama/OpenAI, memoria, contexto empresa) y devuelve.

```typescript
// helix-backend/src/services/aiService.ts
export async function chatWithAgent(question: string, context: HelixContext) {
  const response = await fetch(`${process.env.INTRANET_API_URL}/api/agentes/helix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": process.env.INTERNAL_KEY!,
    },
    body: JSON.stringify({ question, context }),
  });
  return response.json();
}
```

```python
# backend FastAPI — nuevo endpoint en agentes.py
@router.post("/agentes/helix")
async def agente_helix(payload: HelixChatPayload, x_internal_key: str = Header(...)):
    if x_internal_key != settings.INTERNAL_KEY:
        raise HTTPException(403)
    # Usa el agente existente pasando el contexto de Helix
    return await run_helix_agent(payload.question, payload.context)
```

---

## Adiciones al docker-compose.yml

```yaml
# Agregar a docker-compose.yml existente:

  helix-backend:
    build:
      context: ./helix-backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgresql://helix:helixpass@helix-db:5432/helixdb
      - JWT_SECRET=${JWT_SECRET}
      - INTRANET_API_URL=http://backend:8001
      - INTERNAL_KEY=${INTERNAL_KEY}
      - UPLOAD_DIR=/app/uploads
    volumes:
      - helix_uploads:/app/uploads
    depends_on:
      - helix-db
    restart: unless-stopped

  helix-db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=helix
      - POSTGRES_PASSWORD=helixpass
      - POSTGRES_DB=helixdb
    volumes:
      - helix_db_data:/var/lib/postgresql/data
    restart: unless-stopped
    # Sin expose de puertos — solo accesible internamente

volumes:
  helix_db_data:
  helix_uploads:
```

---

## Estructura de Archivos

### helix-backend (Node.js)
```
helix-backend/
├── src/
│   ├── config/
│   │   ├── env.ts                 # Variables de entorno tipadas
│   │   └── prisma.ts              # Cliente Prisma singleton
│   ├── middleware/
│   │   ├── auth.ts                # Verificación JWT compartido
│   │   └── validate.ts            # Validación con zod
│   ├── routers/
│   │   ├── subproyectos.ts
│   │   ├── actividades.ts
│   │   ├── comentarios.ts
│   │   ├── evidencias.ts
│   │   ├── encuestas.ts
│   │   ├── alertas.ts
│   │   ├── dashboard.ts
│   │   ├── reportes.ts
│   │   └── ai.ts
│   ├── services/
│   │   ├── dashboardService.ts    # Cálculo de KPIs y métricas
│   │   ├── roiService.ts          # ROI, margen, predicción
│   │   ├── alertaService.ts       # Generación de mensajes alerta
│   │   ├── aiService.ts           # Llamada al FastAPI agentes
│   │   └── pdfService.ts          # Reporte PDF con Puppeteer
│   ├── jobs/
│   │   └── scheduler.ts           # node-cron: alertas automáticas
│   ├── utils/
│   │   ├── formatters.ts          # formatMoney, formatDate, daysBetween
│   │   ├── taskFilters.ts         # overdueTasks, blockedTasks, riskTasks
│   │   └── constants.ts           # COLUMNS, PRIORITIES, STATUSES
│   └── app.ts                     # Express app
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                    # seedTeam, seedSubprojects, seedTasks
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Frontend (dentro del React existente)
```
frontend/src/
├── pages/planeacion/
│   └── helix/
│       └── HelixPage.tsx          # Página contenedor
├── components/planeacion/
│   └── helix/
│       ├── HelixShell.tsx         # Shell: sidebar Helix + workspace
│       ├── HelixProvider.tsx      # Scope CSS + contexto global Helix
│       ├── topbar/
│       │   └── HelixTopbar.tsx    # Header con alertas y "Nueva tarea"
│       ├── sidebar/
│       │   └── HelixSidebar.tsx   # Nav (Panel, Scrum, Gantt...) + equipo
│       ├── dashboard/
│       │   ├── DashboardView.tsx
│       │   ├── MetricsGrid.tsx    # KPI cards
│       │   ├── SprintHealth.tsx   # Salud sprint + próximos hitos
│       │   ├── BlockersPanel.tsx  # Bloqueos y dependencias
│       │   ├── StatisticsPanel.tsx
│       │   ├── FlowPanel.tsx      # Flujograma por subproyecto
│       │   ├── AIAnalysis.tsx     # Panel análisis IA
│       │   ├── WorkloadPanel.tsx  # Carga por responsable
│       │   └── BadgesPanel.tsx    # Insignias cumplimiento
│       ├── board/
│       │   ├── BoardView.tsx
│       │   ├── BoardToolbar.tsx   # Filtros: buscar, responsable, subproyecto
│       │   ├── KanbanBoard.tsx    # Columnas drag & drop
│       │   ├── KanbanColumn.tsx
│       │   └── TaskCard.tsx       # Tarjeta de actividad
│       ├── gantt/
│       │   ├── GanttView.tsx
│       │   ├── GanttScale.tsx     # Escala de días
│       │   └── GanttChart.tsx     # Barras con avance y dependencias
│       ├── reports/
│       │   ├── ReportsView.tsx
│       │   ├── StatusReport.tsx   # Textarea de estado listo
│       │   ├── FollowupList.tsx   # Seguimientos sugeridos
│       │   └── RoiGrid.tsx        # ROI por subproyecto
│       ├── businessCase/
│       │   └── BusinessCaseView.tsx
│       ├── support/
│       │   ├── SupportView.tsx
│       │   ├── AIChat.tsx         # Chat IA de gestión
│       │   ├── InstructionPanel.tsx
│       │   └── SatisfactionSurvey.tsx
│       ├── settings/
│       │   ├── SettingsView.tsx
│       │   ├── ResponsiblesPanel.tsx
│       │   ├── SubprojectsPanel.tsx
│       │   ├── AutoAlertsPanel.tsx
│       │   └── ActivityRegistry.tsx
│       └── dialogs/
│           ├── TaskDialog.tsx     # Modal crear/editar actividad
│           ├── WhatsAppDialog.tsx # Alertas WhatsApp
│           └── WhatsAppObservationDialog.tsx
├── hooks/planeacion/
│   └── helix/
│       ├── useHelixActividades.ts
│       ├── useHelixSubproyectos.ts
│       ├── useHelixDashboard.ts
│       ├── useHelixAlertas.ts
│       ├── useHelixAI.ts
│       └── useHelixFilters.ts     # Filtros del Scrum Board (estado local)
├── lib/
│   └── helixApi.ts                # Cliente fetch hacia helix-backend:3001
├── styles/
│   └── helix.css                  # Design tokens Helix (ver PLAN_DESIGN_TOKENS)
└── types/
    └── helix.ts                   # Tipos compartidos TypeScript
```

---

## Schema Prisma (helix-backend)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model HelixSubproyecto {
  id              Int               @id @default(autoincrement())
  nombre          String
  objetivo        String?
  cliente         String?
  inversionEst    Float             @default(0)
  retornoEsp      Float             @default(0)
  activo          Boolean           @default(true)
  actividades     HelixActividad[]
  alertas         HelixAlerta[]
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}

model HelixActividad {
  id                  Int                  @id @default(autoincrement())
  subproyectoId       Int
  subproyecto         HelixSubproyecto     @relation(fields: [subproyectoId], references: [id])
  responsableId       Int                  // ID del usuario de la intranet
  responsableNombre   String               // Desnormalizado para evitar JOIN cross-service
  responsableInitials String
  responsableColor    String               @default("#5461c8")
  nombre              String
  estado              String               @default("Backlog")
  prioridad           String               @default("Media")
  fechaInicio         DateTime
  fechaFin            DateTime
  avance              Int                  @default(0)
  puntos              Int                  @default(3)
  costoInversion      Float                @default(0)
  costoOptimizacion   Float                @default(0)
  costoEjecucion      Float                @default(0)
  bloqueada           Boolean              @default(false)
  dependenciaId       Int?
  dependencia         HelixActividad?      @relation("Dependencia", fields: [dependenciaId], references: [id])
  dependientes        HelixActividad[]     @relation("Dependencia")
  completadaEn        DateTime?
  comentarios         HelixComentario[]
  evidencias          HelixEvidencia[]
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
}

model HelixComentario {
  id          Int            @id @default(autoincrement())
  actividadId Int
  actividad   HelixActividad @relation(fields: [actividadId], references: [id], onDelete: Cascade)
  autorId     Int
  autorNombre String
  texto       String
  canal       String         @default("web")  // "web" | "whatsapp"
  createdAt   DateTime       @default(now())
}

model HelixEvidencia {
  id          Int            @id @default(autoincrement())
  actividadId Int
  actividad   HelixActividad @relation(fields: [actividadId], references: [id], onDelete: Cascade)
  nombre      String
  tipoArchivo String
  tamanio     Int
  ruta        String
  createdAt   DateTime       @default(now())
}

model HelixEncuesta {
  id           Int      @id @default(autoincrement())
  usuarioId    Int
  usuarioNombre String
  rol          String
  satisfaccion Int
  facilidad    Int
  utilidad     Int
  nps          Int
  comentario   String?
  createdAt    DateTime @default(now())
}

model HelixAlerta {
  id               Int              @id @default(autoincrement())
  subproyectoId    Int?
  subproyecto      HelixSubproyecto? @relation(fields: [subproyectoId], references: [id])
  cambio           String
  actividadId      Int?
  actividadNombre  String?
  destinatarios    Json             // Array de { nombre, email, phone }
  canal            String           // "email" | "whatsapp" | "auto"
  createdAt        DateTime         @default(now())
}

model HelixAIConversacion {
  id          Int      @id @default(autoincrement())
  usuarioId   Int
  mensajes    Json     // [{ role: "user"|"assistant", content: string, ts: string }]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## Endpoints API (helix-backend)

```
# Subproyectos
GET    /api/subproyectos
POST   /api/subproyectos
PUT    /api/subproyectos/:id
DELETE /api/subproyectos/:id

# Actividades
GET    /api/actividades                       ?subproyectoId, estado, responsableId, bloqueada
POST   /api/actividades
GET    /api/actividades/:id
PUT    /api/actividades/:id
DELETE /api/actividades/:id
PATCH  /api/actividades/:id/estado
PATCH  /api/actividades/:id/avance

# Comentarios
GET    /api/actividades/:id/comentarios
POST   /api/actividades/:id/comentarios

# Evidencias
GET    /api/actividades/:id/evidencias
POST   /api/actividades/:id/evidencias        (multipart)
DELETE /api/evidencias/:id

# Dashboard
GET    /api/dashboard                         ?subproyectoId
GET    /api/dashboard/flujo
GET    /api/dashboard/insignias

# ROI
GET    /api/subproyectos/:id/roi

# Alertas
GET    /api/alertas
POST   /api/alertas
GET    /api/alertas/automaticas               (vencidas, bloqueadas, riesgo, por vencer)

# Encuestas
POST   /api/encuestas
GET    /api/encuestas/resumen

# Chat IA
POST   /api/ai/chat
GET    /api/ai/conversacion

# Reportes
GET    /api/reportes/estado                   (texto listo para comité)
GET    /api/reportes/seguimientos
GET    /api/reportes/pdf                      (descarga PDF)

# Usuarios disponibles (para selector de responsable)
GET    /api/usuarios                          → llama a backend FastAPI interno
```

---

## Mapeo Template → React: Funciones Flotantes → Servicios Tipados

El `app.js` del template tiene ~800+ líneas de funciones globales flotantes.
En la implementación React, cada función tiene su lugar:

| Función flotante (app.js) | Destino en React |
|---|---|
| `saveTasks`, `saveTeam`, etc. | Eliminadas — la API del backend persiste |
| `normalizeTask`, `normalizeSubproject` | `src/types/helix.ts` — tipos + `zodSchema` |
| `formatMoney`, `formatDate`, `daysBetween` | `src/lib/helixFormatters.ts` |
| `overdueTasks`, `blockedTasks`, `riskTasks`, `alertTasks` | `src/lib/helixFilters.ts` (funciones puras) |
| `dashboardTasks`, `dashboardSubprojectLabel` | `useHelixDashboard.ts` |
| `automaticAlertItems` | `useHelixAlertas.ts` |
| `renderBoard`, `renderKanbanColumn` | `KanbanBoard.tsx`, `KanbanColumn.tsx` |
| `renderGantt` | `GanttChart.tsx` |
| `renderMetricsGrid` | `MetricsGrid.tsx` |
| `renderAIAnalysis` | `AIAnalysis.tsx` (llama hook) |
| `renderWorkloadList` | `WorkloadPanel.tsx` |
| `renderBadges` | `BadgesPanel.tsx` |
| `renderROIGrid` | `RoiGrid.tsx` |
| `generateStatusReport` | `reportesService.ts` → endpoint backend |
| `buildWhatsAppMessage` | `alertaService.ts` en Node.js |
| `showToast` | Toast de shadcn/ui (`useToast`) |
| `openTaskDialog` | Estado local en `TaskDialog.tsx` |
| Variables globales de filtro | `useHelixFilters.ts` (estado React) |
| `localStorage.*` | Todos eliminados — datos en PostgreSQL |

---

## UI: Fidelidad con el Template

La UI final debe ser **visualmente idéntica** al template HTML/CSS/JS, con estas mejoras:

### Se conserva exactamente
- Layout `app-shell`: sidebar 280px + workspace flex
- Sidebar oscuro con gradiente `#2b2f36 → #3c414a → #171a1f`
- Topbar con gradiente rojo/gris y botones de alerta
- Todas las vistas: Panel, Scrum, Gantt, Estados, Valor, Soporte, Config
- Design tokens de `styles.css` → migrados a `helix.css` (ver PLAN_DESIGN_TOKENS)
- Fuente Montserrat, escala tipográfica, sombras, border-radius
- Dialogs: crear/editar actividad, WhatsApp alertas, observación WhatsApp
- Toast de notificación

### Se mejora (no se cambia el look)
- Drag & drop real en el Kanban (usando `@dnd-kit/core`)
- Gantt con scroll horizontal real (CSS Grid calculado dinámicamente)
- Formularios con validación Zod en tiempo real
- Loading states en cada panel mientras carga la API
- Paginación en activity registry
- Upload de evidencias con preview y barra de progreso
- El chat IA muestra estado `typing...` mientras procesa

### Se agrega (no existía en el template)
- El sidebar de Helix se integra dentro del shell de la intranet
  (opción A: Helix reemplaza el sidebar de la intranet cuando está activo;
  opción B: un sub-nav de Helix dentro del layout de la intranet — definir con el usuario)

---

## Integración en el Sidebar de la Intranet

```tsx
// En el sidebar existente de la intranet, agregar sección:

<SidebarSection title="Planeación">
  <SidebarItem
    icon={<HelixIcon />}
    label="Helix Zymo"
    href="/planeacion/helix"
  />
</SidebarSection>
```

Cuando el usuario navega a `/planeacion/helix`, la vista completa de Helix
(con su propio sidebar interno) ocupa el área de contenido principal.

---

## Fases de Implementación

### Fase 1 — Infraestructura y CRUD Core (Semana 1-2)
1. Crear `helix-backend/` con Express + TypeScript + Prisma configurado
2. Agregar `helix-backend` y `helix-db` al `docker-compose.yml`
3. Migraciones y seed (subproyectos, actividades de prueba)
4. Middleware de auth JWT compartido
5. Endpoints CRUD: subproyectos, actividades, comentarios
6. Frontend: `HelixShell`, `HelixSidebar`, `HelixTopbar`, `HelixProvider`
7. Vistas: **Scrum Board** (KanbanBoard + drag & drop) y **Configuración** (responsables + subproyectos)
8. Hook `useHelixActividades`, `useHelixSubproyectos`, `helixApi.ts`

**Entregable:** Scrum Board funcional con datos reales desde PostgreSQL.

---

### Fase 2 — Gantt y Dashboard (Semana 3)
1. Vista **Gantt**: escala temporal, barras con avance, dependencias, botón "Hoy"
2. Vista **Panel (Dashboard)**:
   - `MetricsGrid`: KPIs (totales, completadas, vencidas, bloqueadas, puntos, avance global)
   - `SprintHealth`: distribución de estados + próximos hitos
   - `BlockersPanel`: bloqueos y dependencias activas
   - `StatisticsPanel`: promedio, mediana, desviación por responsable y subproyecto
   - `FlowPanel`: flujograma de actividades por subproyecto
   - `WorkloadPanel`: carga por responsable
   - `BadgesPanel`: insignias de cumplimiento
3. `dashboardService.ts` en Node.js calcula todas las métricas server-side
4. Hook `useHelixDashboard.ts`

**Entregable:** Dashboard completo + Gantt navegable.

---

### Fase 3 — ROI, Alertas y Reporte Gerencial (Semana 4)
1. `roiService.ts`: ROI, margen, predicción, clasificación por subproyecto
2. Vista **Estados**: estado listo para comité + seguimientos sugeridos + ROI grid
3. Vista **Valor** (Business Case): comparación vs otras herramientas
4. `alertaService.ts`: generación de mensajes WhatsApp y email por responsable
5. Alertas automáticas: vencidas, próximas a vencer (≤2 días), bloqueadas, riesgo alto
6. Dialogs: `WhatsAppDialog`, `WhatsAppObservationDialog`
7. Historial de alertas (últimas 30)
8. `node-cron` job: revisión automática cada hora + notificación de alertas

**Entregable:** Módulo ejecutivo completo.

---

### Fase 4 — Chat IA, Soporte y Encuesta (Semana 5)
1. Endpoint en FastAPI: `/api/agentes/helix` (con `X-Internal-Key`)
2. `aiService.ts` en Node.js: llama al FastAPI con contexto de actividades
3. Vista **Soporte**: `AIChat.tsx` con historial persistido, quick prompts
4. `InstructionPanel.tsx`: descarga instructivos + upload de propios
5. `SatisfactionSurvey.tsx`: encuesta NPS + métricas de respuestas
6. Hook `useHelixAI.ts`

**Entregable:** Chat IA funcional + módulo de soporte completo.

---

### Fase 5 — PDF y Pulido (Semana 6)
1. `pdfService.ts`: genera PDF del reporte gerencial con Puppeteer
2. Endpoint `GET /api/reportes/pdf`
3. Loading states en todos los paneles
4. Validaciones Zod en todos los formularios con mensajes inline
5. Optimización de queries Prisma (include mínimo, índices)
6. Toast de éxito/error en todas las acciones
7. Evidencias: preview de imagen, barra de progreso en upload

**Entregable:** Helix completo, pulido y listo para uso.

---

## Dependencias

### helix-backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18",
    "@types/express": "^4.17",
    "prisma": "^5",
    "@prisma/client": "^5",
    "jsonwebtoken": "^9",
    "@types/jsonwebtoken": "^9",
    "multer": "^1.4",
    "node-cron": "^3",
    "zod": "^3",
    "puppeteer": "^21",
    "cors": "^2",
    "dotenv": "^16"
  },
  "devDependencies": {
    "typescript": "^5",
    "ts-node-dev": "^2",
    "@types/node": "^20",
    "@types/multer": "^1",
    "@types/node-cron": "^3"
  }
}
```

### frontend (agregar a package.json si no están)
```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```
Recharts y shadcn/ui ya están en la intranet.

---

## Variables de Entorno

### helix-backend/.env
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://helix:helixpass@helix-db:5432/helixdb
JWT_SECRET=           # mismo que backend FastAPI
INTRANET_API_URL=http://backend:8001
INTERNAL_KEY=         # clave compartida para llamadas internas
UPLOAD_DIR=./uploads
```

### backend FastAPI — agregar a .env
```
INTERNAL_KEY=         # mismo valor que helix-backend
HELIX_CONTEXT_ENABLED=true
```
