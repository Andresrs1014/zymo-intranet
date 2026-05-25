# Plan de Implementación — Gestión de Tareas 2.0

## 1. Arquitectura Final

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Docker Compose Network                            │
│                                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐  │
│  │ frontend │   │   backend    │   │ helix-backend│   │task-backend │  │
│  │ React    │   │   FastAPI    │   │ Node+Express │   │Node+Express │  │
│  │ :81      │   │   :8001      │   │   :3001      │   │  :3002      │  │
│  └────┬─────┘   └──────┬───────┘   └──────────────┘   └─────┬──────┘  │
│       │                 │                                     │         │
│       │   HTTP          │  JWT (shared secret)                │         │
│       ├─────────────────┼─────────────────────────────────────┤         │
│       │                 │                                     │         │
│       │                 │  ┌─────────────────┐                │         │
│       │                 │  │  /api/agentes/  │◄───────────────┤ async   │
│       │                 │  │  zymo (IA)      │                │ HTTP    │
│       │                 │  └─────────────────┘                │         │
│       │                 │                                     │         │
│  ┌────┴─────┐     ┌────┴──────┐                        ┌─────┴──────┐  │
│  │          │     │ SQLite    │                        │  task-db   │  │
│  │ Browser  │     │ backend/  │                        │ PostgreSQL │  │
│  │ (nueva   │     │ data/     │                        │ :5434      │  │
│  │ pestaña) │     │           │                        │            │  │
│  └──────────┘     └───────────┘                        └────────────┘  │
│                                                                         │
│  ┌──────────────┐                                                       │
│  │   helix-db   │                                                       │
│  │  PostgreSQL  │                                                       │
│  │   :5433      │                                                       │
│  └──────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Flujo de comunicación:**
- Browser abre nueva pestaña → carga frontend React (`/tareas-v2`)
- Frontend llama `task-backend:3002/api/*` con JWT obtenido de FastAPI login
- `task-backend` valida JWT con mismo secreto que FastAPI
- Para IA: `task-backend` → HTTP POST async → `backend:8001/api/agentes/zymo`
- Para escalamiento WhatsApp: `task-backend` node-cron → HTTP POST → `backend:8001/api/whatsapp`

---

## 2. Schema Prisma Completo

**Archivo:** `task-backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ─────────────────────────────────────────────────────

enum Priority {
  baja
  media
  alta
  critica
}

enum TeamMemberRole {
  member
  co_gestor
}

enum ListType {
  estado
  etiqueta
  plataforma
  prioridad_agenda
}

enum ActivityAction {
  creacion
  cambio_estado
  edicion
  eliminacion
  asignacion
  adjunto_subido
  adjunto_eliminado
}

enum TaskAcceptanceStatus {
  pendiente
  aceptada
  rechazada
}

// ─── TEAMS ─────────────────────────────────────────────────────

model Team {
  id            Int          @id @default(autoincrement())
  name          String       @db.VarChar(120)
  ownerUserId   Int          @map("owner_user_id")
  isActive      Boolean      @default(true) @map("is_active")
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  members       TeamMember[]
  tasks         Task[]
  events        Event[]
  listConfigs   ListConfig[]

  @@map("teams")
}

model TeamMember {
  id        Int            @id @default(autoincrement())
  teamId    Int            @map("team_id")
  team      Team           @relation(fields: [teamId], references: [id], onDelete: Cascade)
  userId    Int            @map("user_id")
  role      TeamMemberRole @default(member)
  isActive  Boolean        @default(true) @map("is_active")
  createdAt DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([teamId, userId])
  @@index([userId])
  @@map("team_members")
}

// ─── TASKS ─────────────────────────────────────────────────────

model Task {
  id                    Int                   @id @default(autoincrement())
  teamId                Int                   @map("team_id")
  team                  Team                  @relation(fields: [teamId], references: [id], onDelete: Restrict)
  subidoPorId           Int                   @map("subido_por_id")
  subidoPorNombre       String                @map("subido_por_nombre") @db.VarChar(120)
  asignadoAId           Int?                  @map("asignado_a_id")
  asignadoANombre       String?               @map("asignado_a_nombre") @db.VarChar(120)
  titulo                String                @db.VarChar(250)
  descripcionTecnica    String?               @map("descripcion_tecnica") @db.Text
  descripcionGerencial  String?               @map("descripcion_gerencial") @db.Text
  impacto               String?               @db.Text
  etiqueta              String                @db.VarChar(60)
  plataforma            String                @db.VarChar(60)
  estado                String                @db.VarChar(60)
  prioridad             Priority              @default(media)
  fecha                 DateTime              @db.Date
  horaInicio            DateTime?             @map("hora_inicio") @db.Timestamptz
  horaCierre            DateTime?             @map("hora_cierre") @db.Timestamptz
  tiempoTotalMinutos    Int?                  @map("tiempo_total_minutos")
  tiempoEstimadoMinutos Int?                  @map("tiempo_estimado_minutos")
  modalidad             String?               @db.VarChar(30)
  sede                  String?               @db.VarChar(60)
  aceptacion            TaskAcceptanceStatus  @default(pendiente)
  version               Int                   @default(1)
  createdAt             DateTime              @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime              @updatedAt @map("updated_at") @db.Timestamptz

  attachments           Attachment[]
  activityLogs          ActivityLog[]

  @@index([teamId, estado])
  @@index([teamId, fecha])
  @@index([asignadoAId])
  @@index([subidoPorId])
  @@map("tasks")
}

// ─── ATTACHMENTS ───────────────────────────────────────────────

model Attachment {
  id           Int      @id @default(autoincrement())
  taskId       Int      @map("task_id")
  task         Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  filename     String   @db.VarChar(255)
  filePath     String   @map("file_path") @db.VarChar(500)
  mimeType     String   @map("mime_type") @db.VarChar(100)
  sizeBytes    Int      @map("size_bytes")
  uploadedById Int      @map("uploaded_by_id")
  uploadedAt   DateTime @default(now()) @map("uploaded_at") @db.Timestamptz

  @@index([taskId])
  @@map("attachments")
}

// ─── ACTIVITY LOG ──────────────────────────────────────────────

model ActivityLog {
  id         Int            @id @default(autoincrement())
  taskId     Int            @map("task_id")
  task       Task           @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId     Int            @map("user_id")
  userNombre String         @map("user_nombre") @db.VarChar(120)
  accion     ActivityAction
  detalle    String?        @db.VarChar(1000)
  campos     Json?          // { field: { old, new } }
  fecha      DateTime       @default(now()) @db.Timestamptz

  @@index([taskId, fecha])
  @@map("activity_logs")
}

// ─── EVENTS (AGENDA) ──────────────────────────────────────────

model Event {
  id              Int                @id @default(autoincrement())
  teamId          Int                @map("team_id")
  team            Team               @relation(fields: [teamId], references: [id], onDelete: Cascade)
  ownerUserId     Int                @map("owner_user_id")
  titulo          String             @db.VarChar(200)
  descripcion     String?            @db.Text
  plataforma      String?            @db.VarChar(60)
  prioridad       String?            @db.VarChar(30)
  modalidad       String?            @db.VarChar(30)
  sede            String?            @db.VarChar(60)
  fecha           DateTime           @db.Date
  horaInicio      String             @map("hora_inicio") @db.VarChar(5) // "HH:MM"
  duracionMinutos Int                @default(60) @map("duracion_minutos")
  creadoPorId     Int                @map("creado_por_id")
  creadoPorNombre String             @map("creado_por_nombre") @db.VarChar(120)
  createdAt       DateTime           @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime           @updatedAt @map("updated_at") @db.Timestamptz

  participants    EventParticipant[]

  @@index([teamId, fecha])
  @@map("events")
}

model EventParticipant {
  id             Int      @id @default(autoincrement())
  eventId        Int      @map("event_id")
  event          Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId         Int      @map("user_id")
  userNombre     String   @map("user_nombre") @db.VarChar(120)
  hasConflict    Boolean  @default(false) @map("has_conflict")
  conflictDetail String?  @map("conflict_detail") @db.VarChar(300)
  confirmado     Boolean  @default(false)

  @@unique([eventId, userId])
  @@index([userId, eventId])
  @@map("event_participants")
}

// ─── LIST CONFIGS ──────────────────────────────────────────────

model ListConfig {
  id                    Int      @id @default(autoincrement())
  teamId                Int      @map("team_id")
  team                  Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  listType              ListType @map("list_type")
  value                 String   @db.VarChar(60)
  label                 String   @db.VarChar(120)
  color                 String?  @db.VarChar(30)
  sortOrder             Int      @default(0) @map("sort_order")
  isActive              Boolean  @default(true) @map("is_active")
  isFinal               Boolean  @default(false) @map("is_final")
  isCanceled            Boolean  @default(false) @map("is_canceled")
  isInitialAssignment   Boolean  @default(false) @map("is_initial_assignment")
  createdAt             DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([teamId, listType, value])
  @@index([teamId, listType])
  @@map("list_configs")
}
```

---

## 3. Lista de Tareas de Implementación

### FASE 1: Infraestructura (secuencial)

---

#### T-001: Scaffold del proyecto task-backend

**Archivos a crear:**
- `task-backend/package.json`
- `task-backend/tsconfig.json`
- `task-backend/Dockerfile`
- `task-backend/.dockerignore`
- `task-backend/src/app.ts`
- `task-backend/src/config/env.ts`
- `task-backend/src/config/prisma.ts`
- `task-backend/prisma/schema.prisma`

**Spec:**
Crear proyecto Node.js + TypeScript + Express + Prisma, replicando la estructura de `helix-backend`. El servidor arranca en puerto 3002, expone `/health` sin auth, y aplica `authenticate` middleware a `/api/*`.

**Criterios de aceptación:**
- `npm install` exitoso
- `npx tsc --noEmit` sin errores
- `npm run dev` arranca y responde `GET /health` con `{ status: "ok", service: "task-backend" }`
- Docker build exitoso

**Dependencias:** Ninguna

---

#### T-002: Docker Compose — servicios task-db y task-backend

**Archivos a crear/modificar:**
- `docker-compose.yml` (agregar 2 servicios + 2 volumes)

**Spec:**
Agregar `task-db` (PostgreSQL 15-alpine, puerto 5434, healthcheck) y `task-backend` (build: `./task-backend`, puerto 3002, depends_on task-db healthy). Variables de entorno via environment block.

**Criterios de aceptación:**
- `docker compose up task-db task-backend` arranca ambos contenedores
- `task-backend` conecta a `task-db` y responde `/health`
- Puerto 5434 accesible desde host
- `prisma migrate deploy` ejecuta sin error dentro del contenedor

**Dependencias:** T-001

---

#### T-003: Prisma schema + primera migración

**Archivos a crear:**
- `task-backend/prisma/schema.prisma` (schema completo de sección 2)
- `task-backend/prisma/migrations/` (generado)
- `task-backend/prisma/seed.ts` (seed de datos default para listas)

**Spec:**
Definir todos los modelos del schema Prisma (sección 2). Ejecutar `prisma migrate dev --name init`. Crear seed que inserta ListConfig defaults para un team de test: 5 estados (pendiente, en_progreso, revision, completada, cancelada), 5 etiquetas, 3 plataformas.

**Criterios de aceptación:**
- Migración crea todas las tablas con FK, índices y constraints
- `prisma generate` produce client sin errores
- Seed inserta registros verificables con `psql`
- Enum constraints funcionan (insertar prioridad inválida falla)

**Dependencias:** T-001

---

#### T-004: Middleware de autenticación y utilidades base

**Archivos a crear:**
- `task-backend/src/middleware/auth.ts`
- `task-backend/src/middleware/errorHandler.ts`
- `task-backend/src/utils/permissions.ts`
- `task-backend/src/utils/pagination.ts`
- `task-backend/src/utils/validators.ts`
- `task-backend/src/types/express.d.ts`

**Spec:**
- `auth.ts`: Copia exacta del patrón de helix-backend, valida Bearer JWT con HS256 y mismo `JWT_SECRET` de FastAPI. Payload: `{ sub, email, full_name, role }`.
- `errorHandler.ts`: Express error handler global con logging y respuesta JSON estandarizada.
- `permissions.ts`: Funciones `requireManageAccess(userId, teamId)`, `requireMembership(userId, teamId)`, `isAdmin(role)`. Queries a `TeamMember` para validar pertenencia y rol.
- `pagination.ts`: Helper que parsea `page`, `limit` de query params y retorna `{ skip, take, page, limit }`.
- `validators.ts`: Zod schemas reutilizables (paginación, IDs, etc).

**Criterios de aceptación:**
- Token válido de FastAPI pasa auth middleware
- Token inválido retorna 401
- `requireManageAccess` retorna owner/co_gestor/admin correctamente
- `requireMembership` rechaza usuarios no miembros del team

**Dependencias:** T-001, T-003

---

### FASE 2: CRUD de Equipos (secuencial)

---

#### T-005: Router y servicio de Teams

**Archivos a crear:**
- `task-backend/src/services/teamService.ts`
- `task-backend/src/routers/teams.ts`

**Spec:**
Endpoints:
- `GET /api/teams/my-teams` — Equipos donde el usuario es miembro activo
- `GET /api/teams/managed` — Equipos donde es owner o co_gestor
- `POST /api/teams` — Crear equipo (solo admin o usuario sin equipo propio)
- `PATCH /api/teams/:id` — Renombrar equipo (solo owner)
- `GET /api/teams/:id/members` — Listar miembros activos
- `GET /api/teams/:id/available-users` — Usuarios de la intranet NO en el equipo (llama a FastAPI `GET /api/usuarios`)
- `POST /api/teams/:id/members` — Agregar miembro (valida que no sea miembro ya)
- `DELETE /api/teams/:id/members/:userId` — Soft-delete miembro
- `POST /api/teams/:id/members/:userId/promote` — Promover a co_gestor (solo owner)
- `POST /api/teams/:id/members/:userId/demote` — Degradar a member (solo owner)

Servicio: `getOrCreateTeam(userId)` auto-crea equipo si el usuario tiene `tool_task_manage` y no tiene equipo.

**Criterios de aceptación:**
- Owner puede CRUD miembros
- Co_gestor puede agregar/remover miembros pero NO promover/degradar
- Member no puede acceder endpoints de gestión
- Soft-delete setea `isActive=false`, no borra registro
- `available-users` llama a FastAPI y filtra correctamente

**Dependencias:** T-004

---

### FASE 3: CRUD de Tareas (secuencial)

---

#### T-006: Servicio de tareas — lógica core

**Archivos a crear:**
- `task-backend/src/services/taskService.ts`
- `task-backend/src/services/stateMachine.ts`

**Spec:**

`stateMachine.ts`:
- Exporta `validateTransition(currentState, newState, listConfigs, userRole)` que verifica transiciones permitidas:
  - Member: puede mover a cualquier estado excepto cancelado (solo manager)
  - Manager/Co_gestor: cualquier transición
  - Si estado actual es `isFinal` o `isCanceled` → solo manager puede reabrir
- Exporta `getInitialState(listConfigs)` y `getFinalState(listConfigs)`

`taskService.ts`:
- `createTask(data, userId)` — Valida: titulo.trim().length >= 3, etiqueta/plataforma/estado existen en ListConfig del team, asignado pertenece al team. Inserta task con `version=1`. Registra ActivityLog. Si hay asignado != creador → marca `aceptacion=pendiente`.
- `updateTask(taskId, data, userId, expectedVersion)` — Optimistic locking: `WHERE id = taskId AND version = expectedVersion`, incrementa version. Valida transición de estado via stateMachine. Auto-cierra hora_cierre si llega a estado final. Registra ActivityLog con campos cambiados (old/new JSON).
- `deleteTask(taskId, userId)` — Solo admin o owner del team.
- `getTask(taskId, userId)` — Con adjuntos y último log.
- `listTasks(teamId, filters, pagination)` — Filtros: search, estado, etiqueta, plataforma, fecha_desde, fecha_hasta, responsable_id, prioridad. Retorna paginado con total.

**Criterios de aceptación:**
- Optimistic locking: dos updates concurrentes con misma version → uno falla con 409 Conflict
- Titulo con espacios se trimea; titulo < 3 chars rechazado con 422
- Transición inválida retorna 422 con mensaje descriptivo
- ActivityLog registra cambios de TODOS los campos modificados con valores old/new
- Auto-close hora_cierre funciona cuando tarea llega a estado final
- Asignado no perteneciente al team → 422

**Dependencias:** T-005, T-003

---

#### T-007: Router de tareas

**Archivos a crear:**
- `task-backend/src/routers/tasks.ts`

**Spec:**
Endpoints:
- `POST /api/tasks` — Crear tarea
- `GET /api/tasks` — Listar tareas paginadas (filtra por teamId del usuario)
- `GET /api/tasks/:id` — Detalle con adjuntos y logs
- `PATCH /api/tasks/:id` — Editar (body incluye `version` para optimistic lock)
- `DELETE /api/tasks/:id` — Eliminar (admin/owner)
- `GET /api/tasks/:id/history` — ActivityLog de la tarea
- `PATCH /api/tasks/:id/accept` — Aceptar/rechazar tarea asignada

Todos validan membership al team de la tarea. Manager endpoints (editar cualquier tarea del equipo) son los mismos pero el servicio verifica permisos internamente.

**Criterios de aceptación:**
- Pagination headers: `X-Total-Count`, `X-Page`, `X-Limit`
- Filtros combinables (AND logic)
- Search busca en titulo y descripcion_tecnica (case insensitive)
- 404 si tarea no existe o no pertenece al workspace del usuario
- `version` mismatch retorna 409

**Dependencias:** T-006

---

#### T-008: Adjuntos por tarea

**Archivos a crear:**
- `task-backend/src/services/attachmentService.ts`
- `task-backend/src/routers/attachments.ts`

**Spec:**
- `POST /api/tasks/:id/attachments` — Upload multer, max 20MB, extensiones permitidas (jpg, jpeg, png, gif, pdf, docx, xlsx, pptx, zip, txt, csv). Guarda con UUID rename en `uploads/tasks/{taskId}/`.
- `GET /api/tasks/:id/attachments` — Listar adjuntos de tarea
- `GET /api/attachments/:attachmentId/download` — Stream del archivo con Content-Disposition
- `DELETE /api/attachments/:attachmentId` — Elimina archivo de disco + registro DB

**Criterios de aceptación:**
- Archivo > 20MB rechazado con 413
- Extensión no permitida → 422
- Eliminar adjunto borra físicamente el archivo de disco
- Solo miembros del team de la tarea pueden subir/ver/eliminar
- ActivityLog registra subida y eliminación de adjuntos

**Dependencias:** T-007

---

### FASE 4: Calendario/Agenda (paralelo con Fase 5)

---

#### T-009: Servicio y router de eventos

**Archivos a crear:**
- `task-backend/src/services/eventService.ts`
- `task-backend/src/routers/events.ts`

**Spec:**
- `POST /api/events` — Crear evento con participantes. Detecta conflictos: por cada participante busca eventos del mismo día, calcula solapamiento de horarios, marca `hasConflict` + `conflictDetail`.
- `GET /api/events?fecha=YYYY-MM-DD&teamId=X` — Eventos por fecha. Managers ven todos del team; members ven solo donde participan.
- `PATCH /api/events/:id` — Editar evento (titulo, descripcion, hora, duración). Re-detecta conflictos.
- `DELETE /api/events/:id` — Eliminar evento (solo owner del evento o manager)
- `PATCH /api/events/:id/participants` — Body: `{ add: [userId], remove: [userId] }`. Re-detecta conflictos.
- `PATCH /api/events/:id/confirm` — Participante confirma asistencia

**Criterios de aceptación:**
- Conflictos detectados correctamente (solapamiento parcial y total)
- Conflictos se recalculan al modificar evento o participantes
- Fecha en formato ISO, horas en UTC, conversión solo en frontend
- Solo manager/co_gestor/owner del evento pueden editar/eliminar
- Confirmación solo funciona para el usuario autenticado

**Dependencias:** T-005

---

### FASE 5: Dashboard y KPIs (paralelo con Fase 4)

---

#### T-010: Servicio de KPIs y dashboard

**Archivos a crear:**
- `task-backend/src/services/dashboardService.ts`
- `task-backend/src/routers/dashboard.ts`

**Spec:**
- `GET /api/dashboard/team-kpis?teamId=X&desde=&hasta=` — KPIs: total tareas, completadas, en progreso, bloqueadas, horas totales, promedio diario, usuarios activos.
- `GET /api/dashboard/person-summaries?teamId=X&desde=&hasta=` — Por persona: nombre, tareas, horas, distribución de estados.
- `GET /api/dashboard/charts?teamId=X&desde=&hasta=` — Series: por responsable (bar), horas por día (line), por estado (pie), por etiqueta (bar), evolución completadas (line).
- `GET /api/dashboard/without-entry-today?teamId=X` — Miembros sin tarea registrada hoy.
- `GET /api/dashboard/my-kpis?teamId=X` — KPIs personales del usuario autenticado.

**Criterios de aceptación:**
- Todos los endpoints aceptan filtros de rango de fecha
- Solo manager/co_gestor acceden a team-kpis, person-summaries, charts
- `my-kpis` accesible para cualquier miembro
- Queries optimizadas con GROUP BY (no N+1)
- Respuesta en < 500ms para equipos de hasta 50 miembros

**Dependencias:** T-007

---

#### T-011: Exportación Excel y PDF

**Archivos a crear:**
- `task-backend/src/services/exportService.ts`
- `task-backend/src/routers/exports.ts`

**Spec:**
- `GET /api/exports/excel?teamId=X&...filtros` — Genera .xlsx con `exceljs`. Columnas: Responsable, Titulo, Fecha, Etiqueta, Plataforma, Tiempo, Estado, Prioridad.
- `GET /api/exports/pdf?teamId=X&...filtros` — Genera PDF con `pdfkit`. Mismo contenido que Excel en formato tabular.

Ambos respetan los mismos filtros que `/api/tasks` (search, estado, etiqueta, plataforma, fecha_desde, fecha_hasta, responsable_id).

**Criterios de aceptación:**
- Excel descargable y abre correctamente en Excel/LibreOffice
- PDF descargable y legible
- Content-Disposition correcto con filename con fecha
- Solo manager/co_gestor pueden exportar

**Dependencias:** T-007

---

### FASE 6: Configuración de Listas (paralelo con Fase 4/5)

---

#### T-012: Servicio y router de ListConfig

**Archivos a crear:**
- `task-backend/src/services/listConfigService.ts`
- `task-backend/src/routers/listConfigs.ts`

**Spec:**
- `GET /api/teams/:teamId/lists` — Retorna listas agrupadas por listType. Si no existen, auto-seed defaults.
- `POST /api/teams/:teamId/lists` — Crear item. Body: `{ listType, value, label, color?, sortOrder? }`. Value slug único por team+listType.
- `PATCH /api/teams/:teamId/lists/:listType/:value` — Actualizar label, color, sortOrder, isActive.
- `DELETE /api/teams/:teamId/lists/:listType/:value` — Soft-delete (isActive=false).
- `PATCH /api/teams/:teamId/lists/estado/:value/special` — Body: `{ isFinal?, isCanceled?, isInitialAssignment? }`. Solo 1 de cada tipo por team (desmarca el anterior).

**Default seeds (auto-creados):**
- Estados: `pendiente` (initial), `en_progreso`, `revision`, `completada` (final), `cancelada` (canceled)
- Etiquetas: `desarrollos`, `actualizaciones`, `auditorias`, `implementacion_okr`, `tareas_diarias`
- Plataformas: `intranet`, `crm`, `erp`

**Criterios de aceptación:**
- Solo 1 estado final, 1 cancelado, 1 initial por team
- Marcar uno como especial desmarca el anterior automáticamente
- Value duplicado → 409 Conflict
- Soft-deleted items no aparecen en GET (filtro isActive=true)
- Solo manager/co_gestor pueden modificar

**Dependencias:** T-005

---

### FASE 7: Integración IA (paralelo con Fase 8)

---

#### T-013: Servicio de IA y endpoints

**Archivos a crear:**
- `task-backend/src/services/aiService.ts`
- `task-backend/src/routers/ai.ts`

**Spec:**

`aiService.ts`:
- `enrichTaskAsync(taskId)` — Fire-and-forget: POST a `INTRANET_API_URL/api/agentes/zymo` con `{ titulo, descripcion_tecnica, etiqueta, plataforma }`. Cuando responde, actualiza task con `descripcion_gerencial` e `impacto`. No bloquea el request original.
- `getSuggestions(titulo)` — POST síncrono a FastAPI `/api/agentes/zymo/sugerencias` con `{ titulo }`. Retorna `{ etiqueta_sugerida, plataforma_sugerida, tiempo_estimado_minutos }`.

`ai.ts` router:
- `POST /api/ai/suggestions` — Body: `{ titulo }`. Retorna sugerencias IA inline.
- Hook interno: se llama desde taskService.createTask y taskService.updateTask cuando cambia titulo/descripcion.

**Criterios de aceptación:**
- Si FastAPI no responde o falla → log error, no afecta la tarea (graceful degradation)
- Timeout de 10s para enrichTaskAsync, 5s para suggestions
- Suggestions endpoint responde en < 6s (timeout del frontend)
- Si IA no disponible, suggestions retorna `{ available: false }`

**Dependencias:** T-007

---

### FASE 8: Escalamiento Automático (paralelo con Fase 7)

---

#### T-014: Job scheduler de escalamiento

**Archivos a crear:**
- `task-backend/src/jobs/scheduler.ts`
- `task-backend/src/jobs/escalation.ts`

**Spec:**

`escalation.ts`:
- Cada hora busca tareas con `estado != final/cancelado` que no han sido actualizadas en > 48h.
- Para cada tarea encontrada:
  - Enviar alerta WhatsApp via `POST INTRANET_API_URL/api/whatsapp/send` al manager del equipo
  - Mensaje: "La tarea '{titulo}' asignada a {asignado} lleva > 2 días sin actualización."
  - Registrar en ActivityLog con acción especial

`scheduler.ts`:
- Inicia cron job `"0 */1 * * *"` (cada hora)
- Llama a escalation check

**Criterios de aceptación:**
- Solo alerta una vez por tarea por período de 24h (evita spam)
- Si WhatsApp API falla → log error, no crashea el scheduler
- Tareas sin asignado no se escalan (solo asignadas)
- Respeta horario laboral: solo entre 7am-7pm UTC-5

**Dependencias:** T-007

---

### FASE 9: Frontend — Shell y Navegación

---

#### T-015: TaskShell, TaskSidebar, TaskTopbar

**Archivos a crear:**
- `frontend/src/pages/tareas/TaskPage.tsx`
- `frontend/src/components/tareas/TaskShell.tsx`
- `frontend/src/components/tareas/TaskSidebar.tsx`
- `frontend/src/components/tareas/TaskTopbar.tsx`
- `frontend/src/components/tareas/TaskToast.tsx`
- `frontend/src/context/TaskContext.tsx`
- `frontend/src/lib/taskTokens.ts`

**Spec:**
Replicar exactamente el patrón de `HelixPage.tsx` / `HelixShell.tsx`:
- `TaskPage` envuelve en `TaskProvider` > `TaskShell` > contenido según `activeView`
- `TaskShell`: grid layout con sidebar + main area
- `TaskSidebar`: navegación entre vistas (Tablero, Lista, Calendario, Dashboard, Personas, Configuración)
- `TaskTopbar`: selector de equipo activo, nombre usuario, breadcrumb
- `TaskContext`: estado global (activeView, activeTeamId, user, filters)
- `taskTokens.ts`: importa `design-tokens.json` y exporta como CSS custom properties

**Criterios de aceptación:**
- Shell renderiza sin errores con sidebar y topbar
- Click en sidebar cambia activeView y renderiza placeholder
- Error boundary captura errores de vistas hijas
- Tokens de diseño aplicados (colores, tipografía, bordes, sombras de design-tokens.json)
- Responsive: sidebar colapsable en < 768px

**Dependencias:** Ninguna en backend (puede ir en paralelo con Fases 2-8)

---

#### T-016: Hooks y API client para task-backend

**Archivos a crear:**
- `frontend/src/hooks/useTaskApi.ts`
- `frontend/src/hooks/useTaskTeams.ts`
- `frontend/src/hooks/useTasks.ts`
- `frontend/src/hooks/useTaskEvents.ts`
- `frontend/src/hooks/useTaskDashboard.ts`
- `frontend/src/hooks/useTaskAttachments.ts`
- `frontend/src/hooks/useTaskLists.ts`
- `frontend/src/hooks/useTaskExports.ts`
- `frontend/src/hooks/useTaskAI.ts`

**Spec:**
- `useTaskApi.ts`: Axios instance con baseURL `VITE_TASK_API_URL` (default `http://localhost:3002`), interceptor que agrega Bearer token del authContext existente.
- Cada hook file exporta queries y mutations TanStack Query con tipado TypeScript.
- Patrón idéntico a los hooks existentes en `frontend/src/hooks/useWorkTasks.ts` pero apuntando a task-backend.

**Criterios de aceptación:**
- Todos los hooks tipados con interfaces de request/response
- Mutations invalidan queries correctas tras success
- Error handling uniforme (toast en catch)
- Hooks exportan `isLoading`, `error`, `data` consistentemente

**Dependencias:** T-015 (contexto de auth), T-007 (endpoints disponibles)

---

### FASE 10: Frontend — Vistas Principales

---

#### T-017: Vista Lista (tabla paginada)

**Archivos a crear:**
- `frontend/src/components/tareas/views/ListView.tsx`
- `frontend/src/components/tareas/TaskDataTable.tsx`
- `frontend/src/components/tareas/TaskFiltersBar.tsx`

**Spec:**
- Tabla paginada con columnas: Responsable (avatar + nombre), Titulo, Fecha, Etiqueta (badge), Plataforma (badge), Tiempo, Estado (badge con color), Prioridad.
- FiltersBar: search input, select estado, select etiqueta, select plataforma, date range picker, select responsable.
- Paginación: botones prev/next, indicador "Mostrando X-Y de Z".
- Click en fila abre TaskDetailSheet.
- Sorting por columna (click header).

**Criterios de aceptación:**
- Carga paginada funcional (page/limit en query params)
- Filtros se combinan correctamente
- Loading skeleton mientras carga
- Empty state cuando no hay resultados
- Responsive: tabla scroll horizontal en mobile

**Dependencias:** T-016

---

#### T-018: Vista Tablero (Scrum board)

**Archivos a crear:**
- `frontend/src/components/tareas/views/BoardView.tsx`
- `frontend/src/components/tareas/board/BoardColumn.tsx`
- `frontend/src/components/tareas/board/TaskCard.tsx`

**Spec:**
- Columnas dinámicas según estados configurados del team (de ListConfig)
- Drag & drop entre columnas cambia estado de la tarea (PATCH con version)
- TaskCard muestra: titulo, asignado (avatar), prioridad (badge), etiqueta, tiempo
- Columnas con conteo de tareas
- Optimistic update al drag, revert si falla

**Criterios de aceptación:**
- Drag & drop funcional con `@dnd-kit/core`
- Transición inválida (según stateMachine) muestra toast de error y revierte
- Optimistic locking: si version mismatch, muestra mensaje "Tarea modificada por otro usuario" y refresca
- Columnas scrollables verticalmente
- Performance aceptable con 100+ tareas

**Dependencias:** T-016, T-012 (necesita ListConfig para columnas)

---

#### T-019: Vista Calendario

**Archivos a crear:**
- `frontend/src/components/tareas/views/CalendarView.tsx`
- `frontend/src/components/tareas/calendar/DaySchedule.tsx`
- `frontend/src/components/tareas/calendar/EventCard.tsx`
- `frontend/src/components/tareas/calendar/CreateEventSheet.tsx`

**Spec:**
- Calendario mensual con `react-day-picker` (ya presente en proyecto)
- Click en día muestra eventos del día en panel lateral
- EventCard: titulo, hora, duración, participantes (avatars), badge conflicto si aplica
- Botón "+ Evento" abre CreateEventSheet
- CreateEventSheet: formulario con titulo, hora, duración, participantes (multi-select de miembros del team), plataforma, prioridad, modalidad, sede

**Criterios de aceptación:**
- Días con eventos marcados con dot indicator
- Conflictos visibles con icono de warning y tooltip con detalle
- Crear evento refresca la vista
- Participante puede confirmar asistencia desde EventCard
- Editar participantes recalcula conflictos

**Dependencias:** T-016, T-009

---

#### T-020: Vista Dashboard (KPIs y gráficas)

**Archivos a crear:**
- `frontend/src/components/tareas/views/DashboardView.tsx`
- `frontend/src/components/tareas/dashboard/KpiCards.tsx`
- `frontend/src/components/tareas/dashboard/Charts.tsx`
- `frontend/src/components/tareas/dashboard/PersonSummaryCards.tsx`
- `frontend/src/components/tareas/dashboard/NoEntryAlert.tsx`

**Spec:**
- KPI cards: Total tareas, Completadas, En progreso, Bloqueadas, Horas totales
- Gráficas con Recharts (ya en el proyecto): bar chart por responsable, line chart horas/día, pie chart por estado, bar chart por etiqueta, line chart evolución completadas
- Person summaries: cards con avatar, nombre, tareas, horas, mini bar de distribución de estados
- Alert: banner amarillo "X miembros sin registro hoy" con lista expandible
- Filtro de rango de fechas en topbar de dashboard

**Criterios de aceptación:**
- Solo visible para manager/co_gestor
- Gráficas renderizadas con datos reales del backend
- Loading skeletons por sección
- Rango de fechas filtra todas las secciones
- Responsive: cards stack en mobile

**Dependencias:** T-016, T-010

---

#### T-021: Vista Personas

**Archivos a crear:**
- `frontend/src/components/tareas/views/PeopleView.tsx`
- `frontend/src/components/tareas/people/PersonCard.tsx`
- `frontend/src/components/tareas/people/PersonTaskList.tsx`

**Spec:**
- Grid de cards por miembro del equipo
- Cada card: avatar, nombre, rol badge, tareas count, horas, estado distribution mini-bars
- Click en card expande panel con tareas recientes de esa persona
- Filtro por estado y rango de fechas

**Criterios de aceptación:**
- Solo visible para manager/co_gestor
- Cards ordenadas por actividad (más tareas primero)
- Click abre detalle inline (no modal)
- Muestra indicador si persona no tiene registro hoy

**Dependencias:** T-016, T-010

---

#### T-022: Vista Configuración

**Archivos a crear:**
- `frontend/src/components/tareas/views/SettingsView.tsx`
- `frontend/src/components/tareas/settings/TeamMembersConfig.tsx`
- `frontend/src/components/tareas/settings/ListsConfig.tsx`

**Spec:**
- Tab 1 — Equipo: Nombre editable, lista de miembros con avatar/nombre/rol/actions (promover, degradar, remover), botón "+ Agregar miembro" con dialog de búsqueda.
- Tab 2 — Listas: Tabs secundarios por listType (Estados, Etiquetas, Plataformas). Cada lista muestra items con drag para reorder, toggle activo/inactivo, editar label/color, marcar estado especial.

**Criterios de aceptación:**
- Solo accesible por manager/co_gestor
- Promover/degradar solo visible para owner
- Reorder via drag & drop actualiza sortOrder
- Confirmación antes de remover miembro
- Estados especiales (final/canceled/initial) con indicador visual
- Validación: no puede haber 0 estados activos

**Dependencias:** T-016, T-005, T-012

---

#### T-023: TaskDialog (crear/editar tarea)

**Archivos a crear:**
- `frontend/src/components/tareas/TaskDialog.tsx`
- `frontend/src/components/tareas/TaskDetailSheet.tsx`
- `frontend/src/components/tareas/AISuggestionsBadge.tsx`

**Spec:**
- Modal/Sheet con formulario completo: titulo, descripcion tecnica, etiqueta (select de ListConfig), plataforma (select), estado (select), prioridad (enum), asignado (select de miembros), fecha, hora inicio, hora cierre, tiempo estimado, modalidad, sede.
- Al escribir titulo (debounce 800ms) → llama a `/api/ai/suggestions` → muestra badges de sugerencia (etiqueta, plataforma, tiempo estimado). Click en badge la aplica al campo.
- Modo edición: pre-carga datos, incluye `version` hidden para optimistic lock.
- Adjuntos: drag & drop zone debajo del formulario, lista de adjuntos existentes.
- Historial: tab con ActivityLog de la tarea.

**Criterios de aceptación:**
- Validación client-side (titulo min 3 chars, fecha requerida, etc)
- Sugerencias IA aparecen como chips clicables
- Si IA no disponible, no muestra nada (graceful)
- Version mismatch al guardar → mensaje "La tarea fue modificada" + recarga
- Submit deshabilitado durante mutation loading

**Dependencias:** T-016, T-013, T-008

---

### FASE 11: Integración Final

---

#### T-024: Link en sidebar de la intranet

**Archivos a modificar:**
- `frontend/src/components/Sidebar.tsx` (o equivalente del sidebar principal)
- `frontend/src/App.tsx` o router principal

**Spec:**
- El link "Gestión de Tareas" existente se actualiza para abrir en `target="_blank"` apuntando a `/tareas-v2`
- Ruta `/tareas-v2` renderiza `TaskPage`
- Sin label "blank" — ícono de "open in new tab" sutil al hover

**Criterios de aceptación:**
- Click abre la app de tareas V2 correctamente en nueva pestaña
- Auth se mantiene (token disponible en la nueva ruta)
- No afecta rutas existentes de la intranet

**Dependencias:** T-015

---

#### T-025: Script de migración SQLite → PostgreSQL

**Archivos a crear:**
- `task-backend/scripts/migrate-v1-to-v2.py`
- `task-backend/scripts/requirements-migration.txt`

**Spec:**

```python
# migrate-v1-to-v2.py
import sqlite3
import psycopg2
from datetime import datetime, timezone

SQLITE_PATH = "/app/data/intranet.db"  # backend/data/intranet.db
PG_DSN = "postgresql://task:taskpass@task-db:5434/taskdb"

def main():
    src = sqlite3.connect(SQLITE_PATH)
    dst = psycopg2.connect(PG_DSN)

    # ORDEN DE MIGRACIÓN (respeta FK):
    # 1. teams (de task_teams)
    # 2. team_members (de task_team_members)
    # 3. list_configs (de task_list_configs)
    # 4. tasks (de work_tasks WHERE scope='desarrollo_innovacion')
    # 5. attachments (de task_attachments)
    # 6. activity_logs (de task_activity_log)
    # 7. events (de task_events)
    # 8. event_participants (de task_event_participants)

    migrate_teams(src, dst)
    migrate_team_members(src, dst)
    migrate_list_configs(src, dst)
    migrate_tasks(src, dst)
    migrate_attachments(src, dst)
    migrate_activity_logs(src, dst)
    migrate_events(src, dst)
    migrate_event_participants(src, dst)

    dst.commit()
    print_counts(dst)

def to_utc(dt_str):
    """Convierte datetime string a UTC timezone-aware"""
    if dt_str is None:
        return None
    dt = datetime.fromisoformat(dt_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def reset_sequence(conn, table):
    """Reset autoincrement sequence a max(id)+1"""
    conn.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 0)+1, false) FROM {table}")

def map_prioridad(val):
    mapping = {"baja": "baja", "media": "media", "alta": "alta", "critica": "critica"}
    return mapping.get((val or "media").lower().strip(), "media")

def map_accion(val):
    mapping = {"creacion": "creacion", "cambio_estado": "cambio_estado", "edicion": "edicion"}
    return mapping.get(val, "edicion")
```

**Criterios de aceptación:**
- Script ejecutable: `python migrate-v1-to-v2.py`
- Migra todas las 8 tablas en orden de FK
- Fechas convertidas a UTC
- Sequences reseteadas correctamente
- Registros huérfanos (FK inválida) loggeados y skipeados
- Idempotente: puede correr múltiples veces (truncate before insert)
- Print de estadísticas al final (counts por tabla)

**Dependencias:** T-003 (schema debe existir)

---

#### T-026: Desactivar V1

**Archivos a modificar:**
- `backend/app/routers/herramientas_tareas.py` (agregar flag de desactivación)
- `frontend/src/components/herramientas/tareas/GestionTareasPage.tsx` (banner de redirección)

**Spec:**
- Variable de entorno `TASKS_V1_DISABLED=true`
- Si activa: todos los endpoints de V1 retornan 410 Gone con mensaje "Este módulo fue migrado a Tareas 2.0"
- Frontend V1: mostrar banner fijo "Este módulo fue reemplazado. Accede a Tareas 2.0" con link
- NO eliminar código V1 aún (solo desactivar)

**Criterios de aceptación:**
- Con flag activo: API V1 retorna 410
- Frontend V1 muestra banner con link a V2
- Con flag inactivo: V1 funciona normalmente (rollback seguro)
- No hay data loss ni modificación de tablas SQLite

**Dependencias:** T-025 (migración debe ser exitosa primero)

---

## 4. Orden de Ejecución

```
SEMANA 1 — Infraestructura + Backend Core
├── T-001 (scaffold)               ← PRIMERO
├── T-002 (docker-compose)         ← requiere T-001
├── T-003 (prisma schema)          ← requiere T-001
├── T-004 (middleware)             ← requiere T-001, T-003
└── T-015 (frontend shell)         ← PARALELO (no depende de backend)

SEMANA 2 — CRUD Principal
├── T-005 (teams router)           ← requiere T-004
├── T-006 (task service)           ← requiere T-005
├── T-007 (task router)            ← requiere T-006
├── T-012 (list config)            ← PARALELO con T-006, requiere T-005
└── T-016 (hooks frontend)         ← PARALELO, requiere T-015

SEMANA 3 — Features Secundarios (TODOS PARALELOS entre sí)
├── T-008 (adjuntos)               ← requiere T-007
├── T-009 (eventos/agenda)         ← requiere T-005
├── T-010 (dashboard KPIs)         ← requiere T-007
├── T-011 (exportación)            ← requiere T-007
├── T-013 (IA service)             ← requiere T-007
└── T-014 (scheduler)              ← requiere T-007

SEMANA 4 — Frontend Vistas (TODOS PARALELOS entre sí)
├── T-017 (vista lista)            ← requiere T-016
├── T-018 (vista tablero)          ← requiere T-016, T-012
├── T-019 (vista calendario)       ← requiere T-016, T-009
├── T-020 (vista dashboard)        ← requiere T-016, T-010
├── T-021 (vista personas)         ← requiere T-016, T-010
├── T-022 (vista configuración)    ← requiere T-016, T-005, T-012
└── T-023 (task dialog)            ← requiere T-016, T-013, T-008

SEMANA 5 — Integración y Cierre
├── T-024 (link intranet)          ← requiere T-015
├── T-025 (migración SQLite→PG)    ← requiere T-003
└── T-026 (desactivar V1)          ← requiere T-025
```

---

## 5. Cambios en docker-compose.yml

Agregar después del servicio `helix-db`:

```yaml
  task-backend:
    build:
      context: ./task-backend
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    env_file:
      - ./backend/.env
    environment:
      - NODE_ENV=production
      - PORT=3002
      - DATABASE_URL=postgresql://${TASK_DB_USER:-task}:${TASK_DB_PASSWORD}@task-db:5432/${TASK_DB_NAME:-taskdb}
      - INTRANET_API_URL=http://backend:8001
      - UPLOAD_DIR=/app/uploads
    volumes:
      - task_uploads:/app/uploads
    depends_on:
      task-db:
        condition: service_healthy
    restart: unless-stopped

  task-db:
    image: postgres:15-alpine
    ports:
      - "5434:5432"
    environment:
      - POSTGRES_USER=${TASK_DB_USER:-task}
      - POSTGRES_PASSWORD=${TASK_DB_PASSWORD}
      - POSTGRES_DB=${TASK_DB_NAME:-taskdb}
    volumes:
      - task_db_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${TASK_DB_USER:-task} -d ${TASK_DB_NAME:-taskdb}"]
      interval: 5s
      timeout: 5s
      retries: 10
```

Agregar a `volumes:`:
```yaml
  task_db_data:
  task_uploads:
```

---

## 6. Variables de Entorno Necesarias

### Para `task-backend`:

| Variable | Valor default | Descripción |
|----------|---------------|-------------|
| `NODE_ENV` | `development` | Entorno |
| `PORT` | `3002` | Puerto del servidor |
| `DATABASE_URL` | `postgresql://task:taskpass@task-db:5432/taskdb` | Conexión PG |
| `JWT_SECRET` | (heredado de `backend/.env` SECRET_KEY) | Mismo secreto que FastAPI |
| `INTRANET_API_URL` | `http://backend:8001` | URL interna de FastAPI |
| `INTERNAL_KEY` | `task-internal-key-dev` | Key para llamadas internas |
| `UPLOAD_DIR` | `./uploads` | Directorio de adjuntos |
| `CORS_ORIGIN` | `http://localhost:81` | Origen permitido CORS |
| `AI_TIMEOUT_MS` | `10000` | Timeout para llamadas IA async |
| `ESCALATION_HOURS` | `48` | Horas sin update antes de escalar |
| `ESCALATION_START_HOUR` | `7` | Hora inicio ventana escalamiento (UTC-5) |
| `ESCALATION_END_HOUR` | `19` | Hora fin ventana escalamiento (UTC-5) |

### Para `task-db` (Docker environment):

| Variable | Valor default | Descripción |
|----------|---------------|-------------|
| `TASK_DB_USER` | `task` | Usuario PostgreSQL |
| `TASK_DB_PASSWORD` | (requerido) | Password PostgreSQL |
| `TASK_DB_NAME` | `taskdb` | Nombre de la base de datos |

### Para `frontend` (Vite env):

| Variable | Valor default | Descripción |
|----------|---------------|-------------|
| `VITE_TASK_API_URL` | `http://localhost:3002` | URL del task-backend |

---

## 7. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Migración pierde datos | CRÍTICO | Ejecutar en modo dry-run primero. Backup SQLite previo. Comparar counts post-migración. |
| Optimistic locking frustra usuarios | MEDIO | UX clara: "Tarea actualizada por otro, recargando..." con auto-refresh |
| IA no disponible | BAJO | Graceful degradation total. Suggestions opcionales. enrichTask async no bloquea. |
| Performance dashboard con muchas tareas | MEDIO | Índices en (team_id, estado) y (team_id, fecha). Pagination obligatoria. Cache 30s staleTime. |
| JWT desincronizado con FastAPI | ALTO | Mismo env file. Health check verifica token decode. |
| WhatsApp API rate limit | BAJO | Max 1 alerta por tarea/24h. Exponential backoff. |

---

## 8. Criterios de Éxito del Proyecto

- [ ] Todos los endpoints responden correctamente con auth válida
- [ ] CRUD completo de tareas con optimistic locking funcional
- [ ] Drag & drop en board ejecuta transiciones de estado
- [ ] Adjuntos se suben/descargan/eliminan correctamente (max 20MB)
- [ ] Dashboard muestra KPIs y gráficas con datos reales
- [ ] Calendario muestra eventos con detección de conflictos
- [ ] Configuración de listas persiste y se refleja en formularios
- [ ] Sugerencias IA aparecen al escribir titulo
- [ ] Escalamiento WhatsApp se dispara para tareas >48h sin update
- [ ] Migración SQLite→PG transfiere 100% de datos válidos
- [ ] V1 desactivada sin data loss
- [ ] Performance: < 200ms respuesta promedio en endpoints CRUD
- [ ] 0 bugs críticos de los 51 documentados en auditoría V1
