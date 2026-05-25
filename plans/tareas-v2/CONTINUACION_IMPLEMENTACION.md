# Gestión de Tareas V2 — Continuación de Implementación

> Este documento existe para que cualquier agente (Gemini, Claude Sonnet, etc.) pueda continuar
> la implementación exactamente desde donde se dejó, sin perder contexto.

---

## Estado actual (2026-05-25)

### ¿Qué está terminado?

**Backend (`task-backend/`)** — 100% implementado y montado en `app.ts`:

| Servicio / Router | Estado |
|---|---|
| `src/services/teamService.ts` | ✅ completo |
| `src/routers/teams.ts` | ✅ completo |
| `src/services/stateMachine.ts` | ✅ completo |
| `src/services/taskService.ts` | ✅ completo (optimistic lock, audit log) |
| `src/routers/tasks.ts` | ✅ completo |
| `src/services/attachmentService.ts` | ✅ completo (multer, 20 MB, UUID) |
| `src/routers/attachments.ts` | ✅ dos routers exportados |
| `src/services/eventService.ts` | ✅ completo (conflict detection) |
| `src/routers/events.ts` | ✅ completo |
| `src/services/dashboardService.ts` | ✅ completo (groupBy, no N+1) |
| `src/routers/dashboard.ts` | ✅ completo |
| `src/services/listConfigService.ts` | ✅ completo (auto-seed defaults) |
| `src/routers/listConfigs.ts` | ✅ completo (mergeParams: true) |
| `src/services/exportService.ts` | ✅ completo (ExcelJS + PDFKit) |
| `src/routers/exports.ts` | ✅ completo |
| `src/services/aiService.ts` | ✅ completo (fire-and-forget enrich + suggestions) |
| `src/routers/ai.ts` | ✅ completo |
| `src/jobs/escalation.ts` | ✅ completo (horario laboral + cooldown 24h) |
| `src/jobs/scheduler.ts` | ✅ completo (cron hourly) |
| `src/app.ts` | ✅ todos los routers montados |

**Frontend (`frontend/src/`)** — 100% implementado:

| Archivo | Estado |
|---|---|
| `lib/taskApi.ts` | ✅ axios instance con auth interceptor |
| `context/TaskContext.tsx` | ✅ completo |
| `types/task.ts` | ✅ completo |
| `components/tareas/TaskToast.tsx` | ✅ completo |
| `components/tareas/TaskSidebar.tsx` | ✅ completo |
| `components/tareas/TaskTopbar.tsx` | ✅ completo |
| `components/tareas/TaskShell.tsx` | ✅ completo (ErrorBoundary) |
| `components/tareas/TaskDialog.tsx` | ✅ completo (create/edit, AI chips, optimistic lock) |
| `components/tareas/views/ListView.tsx` | ✅ completo (filtros, paginación) |
| `components/tareas/views/BoardView.tsx` | ✅ completo (@dnd-kit drag & drop) |
| `components/tareas/views/CalendarView.tsx` | ✅ completo |
| `components/tareas/views/DashboardView.tsx` | ✅ completo (Recharts) |
| `components/tareas/views/PeopleView.tsx` | ✅ completo |
| `components/tareas/views/SettingsView.tsx` | ✅ completo |
| `hooks/useTaskTeams.ts` | ✅ completo |
| `hooks/useTasks.ts` | ✅ completo |
| `hooks/useTaskEvents.ts` | ✅ completo |
| `hooks/useTaskDashboard.ts` | ✅ completo |
| `hooks/useTaskV2Attachments.ts` | ✅ completo |
| `hooks/useTaskLists.ts` | ✅ completo |
| `hooks/useTaskV2Exports.ts` | ✅ completo |
| `hooks/useTaskAI.ts` | ✅ completo (800ms debounce) |
| `pages/tareas/TaskPage.tsx` | ✅ completo (view router + TaskDialog) |
| `App.tsx` | ✅ ruta `/tareas-v2` agregada |
| `components/layout/Sidebar.tsx` | ✅ link "Tareas V2" abre en nueva pestaña |

---

## ✅ TODO IMPLEMENTADO (2026-05-25)

Todos los archivos del plan están completos. Ver tabla arriba.

Las siguientes piezas finales fueron completadas en esta sesión:
- `pages/tareas/TaskPage.tsx` — entry point, view router, nueva tarea dialog
- `App.tsx` — ruta `/tareas-v2`
- `Sidebar.tsx` — link externo "Tareas V2" con icono hover
- `frontend/nginx.conf` — proxy `/tareas-api/` → task-backend:3002
- `frontend/.env.production` — `VITE_TASK_API_URL`, `VITE_TASKS_V1_DEPRECATED`
- `docker-compose.yml` — `CORS_ORIGIN` en task-backend, `TASKS_V1_DISABLED` en backend
- `backend/app/routers/herramientas_tareas.py` — guard 410 con `TASKS_V1_DISABLED`
- `GestionTareasPage.tsx` — banner deprecación con `VITE_TASKS_V1_DEPRECATED`
- `task-backend/scripts/migrate-v1-to-v2.py` — script migración SQLite→PostgreSQL
- `components/tareas/TaskDialog.tsx` — reset de form al abrir para nueva tarea
- `components/tareas/views/ListView.tsx` — edit task al click en fila

---

## Pendiente si se retoma el trabajo

### T-025: Script de migración V1 → V2

**Archivo a crear:** `task-backend/scripts/migrate-v1-to-v2.py`

**Objetivo:** Migrar datos existentes de la BD SQLite de Gestión de Tareas V1
a la nueva BD PostgreSQL de V2.

**Orden de inserción (respetar FK):**
1. Teams (crear un equipo por cada área/proyecto de V1)
2. TeamMembers (mapear usuarios de V1 a members)
3. ListConfigs (los valores de estado/etiqueta/plataforma de V1)
4. Tasks (todos los campos, sin las relaciones opcionales primero)
5. ActivityLog (historial de cambios)
6. Attachments (copiar archivos físicos + registrar en DB)

**Variables de entorno necesarias:**
```
V1_SQLITE_PATH=/ruta/a/tasks_v1.db
V2_DATABASE_URL=postgresql://tareas_user:tareas_pass@localhost:5434/tareas_db
V2_UPLOADS_DIR=/ruta/a/uploads/v2
```

**Notas técnicas:**
- Usar `psycopg2` o `asyncpg` para PG, `sqlite3` built-in para SQLite
- Mapear `status` de V1 a `estado` de V2 usando la tabla de ListConfigs creada
- Preservar `createdAt` / `updatedAt` de los registros originales
- Ejecutar en transacción: rollback completo si falla cualquier paso
- Al final, imprimir resumen: N tasks migradas, N attachments, N errores

---

### T-026: Deprecación de V1

**Objetivo:** Deshabilitar los endpoints V1 y mostrar banner en frontend V1.

#### Backend V1 (Python FastAPI)

**Archivo:** `backend/app/routers/herramientas/tareas.py` (o donde estén los endpoints V1)

Agregar al inicio de cada endpoint V1:
```python
import os
from fastapi import HTTPException

TASKS_V1_DISABLED = os.getenv("TASKS_V1_DISABLED", "false").lower() == "true"

# Al inicio de cada endpoint:
if TASKS_V1_DISABLED:
    raise HTTPException(status_code=410, detail="Gestión de Tareas V1 ha sido migrado a V2. Usa /tareas-v2.")
```

**Variable de entorno a agregar en `docker-compose.yml`:**
```yaml
backend:
  environment:
    TASKS_V1_DISABLED: "false"  # cambiar a "true" después de migración
```

#### Frontend V1

**Archivo:** `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

Agregar banner informativo al inicio del return:
```tsx
{import.meta.env.VITE_TASKS_V1_DEPRECATED === "true" && (
  <div style={{
    background: "#fffbeb",
    border: "1px solid #fbbf24",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 13,
  }}>
    <span style={{ fontSize: 18 }}>⚠</span>
    <span>
      Esta versión está siendo deprecada.{" "}
      <a href="/tareas-v2" target="_blank" style={{ color: "#ef3340", fontWeight: 700 }}>
        Usar Tareas V2
      </a>
    </span>
  </div>
)}
```

**Variable a agregar en `frontend/.env.production`:**
```
VITE_TASKS_V1_DEPRECATED=false
```

---

### Verificaciones pendientes antes de producción

1. **`frontend/.env.production`** — asegurarse de que tenga:
   ```
   VITE_TASK_API_URL=https://intranet.zymo.com.co/tareas-api
   ```
   (o la URL real del task-backend en producción)

2. **`docker-compose.yml`** — verificar que `task-backend` tenga `CORS_ORIGIN`:
   ```yaml
   task-backend:
     environment:
       CORS_ORIGIN: "https://intranet.zymo.com.co"
   ```

3. **Nginx / reverse proxy** — agregar upstream para el task-backend en el puerto 3002:
   ```nginx
   location /tareas-api/ {
     proxy_pass http://task-backend:3002/;
   }
   ```

4. **Dependencias de npm** — confirmar que están instaladas en `frontend/package.json`:
   - `@dnd-kit/core` y `@dnd-kit/sortable`
   - `recharts`

   Y en `task-backend/package.json`:
   - `exceljs`
   - `pdfkit`
   - `node-cron`
   - `multer`
   - `@types/multer`
   - `@types/pdfkit`

---

## Arquitectura técnica resumida

```
Navegador → /tareas-v2 (React SPA)
              ↓ VITE_TASK_API_URL
task-backend (Node + Express + TypeScript, puerto 3002)
              ↓ Prisma ORM
task-db (PostgreSQL 15, puerto 5434, db: tareas_db)
              ↓ fire-and-forget AI calls
FastAPI backend (puerto 8000) → /api/agentes/zymo
```

### JWT compartido
El task-backend verifica JWT con el mismo `JWT_SECRET` / `SECRET_KEY` que el FastAPI backend.
No hay doble login. El token del frontend Zymo es válido en ambos backends.

### Rutas del task-backend
```
GET/POST   /api/teams/
GET        /api/teams/my-teams
GET        /api/teams/managed
PATCH      /api/teams/:id
GET        /api/teams/:id/members
GET        /api/teams/:id/available-users
POST/DELETE /api/teams/:id/members
POST       /api/teams/:id/members/:userId/promote
POST       /api/teams/:id/members/:userId/demote
GET        /api/teams/:teamId/lists
POST       /api/teams/:teamId/lists
PATCH      /api/teams/:teamId/lists/:listType/:value
PATCH      /api/teams/:teamId/lists/:value/special
GET/POST   /api/tasks/
GET/PATCH/DELETE /api/tasks/:id
GET        /api/tasks/:id/history
PATCH      /api/tasks/:id/accept
GET/POST   /api/tasks/:taskId/attachments
GET        /api/attachments/:attachmentId/download
DELETE     /api/attachments/:attachmentId
GET/POST   /api/events/
PATCH/DELETE /api/events/:id
PATCH      /api/events/:id/participants
POST       /api/events/:id/confirm
GET        /api/dashboard/kpis
GET        /api/dashboard/persons
GET        /api/dashboard/charts
GET        /api/dashboard/no-entry-today
GET        /api/dashboard/my-kpis
GET        /api/exports/excel
GET        /api/exports/pdf
POST       /api/ai/suggestions
POST       /api/ai/enrich/:taskId
```

---

## Cómo retomar el trabajo

1. Leer este documento completo
2. Verificar el estado del código con `git log --oneline -20`
3. Empezar por T-025 (migration script) ya que es independiente del frontend
4. Luego T-026 (deprecación V1) que es cambio mínimo en dos archivos
5. Finalmente las verificaciones de producción (env vars, nginx, npm deps)

El código ya funcional **no debe modificarse** salvo para corrección de bugs
encontrados durante las pruebas de integración.
