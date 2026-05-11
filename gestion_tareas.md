# Gestión de Tareas — Documentación del Sistema

> Módulo: `desarrollo_innovacion` | Stack: FastAPI + SQLModel + React 19 + TanStack Query

---

## 1. Base de Datos — Modelos

### WorkTask (`work_tasks`)
Tabla central que almacena cada tarea registrada.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | Identificador único |
| `scope` | str | `"desarrollo_innovacion"` (indexed) |
| `team_id` | int \| null | Referencia al equipo |
| `subido_por_id` | int | ID del usuario creador |
| `subido_por_nombre` | str | Nombre capturado al momento de creación (desnormalizado) |
| `fecha` | date | Fecha de la tarea (default: hoy) |
| `hora_inicio` | datetime \| null | Inicio de la tarea |
| `hora_cierre` | datetime \| null | Cierre de la tarea |
| `tiempo_total_minutos` | int \| null | Duración calculada automáticamente |
| `etiqueta` | str | Categoría de la tarea (ver opciones abajo) |
| `plataforma` | str | Sistema al que aplica (ver opciones abajo) |
| `titulo` | str (max 250) | Título corto |
| `descripcion_tecnica` | str | Descripción detallada |
| `estado` | str | Estado actual de la tarea |
| `created_at` | datetime | Fecha de creación del registro |
| `updated_at` | datetime | Última modificación |

**Valores válidos:**
- `etiqueta`: `desarrollos`, `actualizaciones`, `auditorias`, `implementacion_okr`, `tareas_diarias`
- `plataforma`: `logimat1`, `logimat2`, `imccargo`, `imcdeposito`, `transversal`
- `estado`: `completada`, `en_progreso`, `bloqueada`

### TaskTeam (`task_teams`)
Contenedor de equipo por scope. Existe **uno solo** por scope (patrón get_or_create).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `scope` | str | Scope del equipo |
| `name` | str | Nombre del equipo |
| `owner_user_id` | int \| null | Responsable del equipo |
| `is_active` | bool | Estado activo |

### TaskTeamMember (`task_team_members`)
Membresía de usuarios al equipo. Usa soft-delete con `is_active`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `team_id` | int | Referencia al TaskTeam |
| `user_id` | int | ID del usuario |
| `is_active` | bool | Activo / inactivo (soft delete) |

### TaskEvent (`task_events`)
Eventos de calendario del equipo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `scope` | str | Scope del evento |
| `team_id` | int \| null | Equipo relacionado |
| `titulo` | str | Título del evento |
| `descripcion` | str \| null | Descripción opcional |
| `fecha` | date | Fecha del evento |
| `hora_inicio` | str | Formato `"HH:MM"` |
| `duracion_minutos` | int | Duración (default 60) |
| `creado_por_id` | int | ID del creador |
| `creado_por_nombre` | str | Nombre desnormalizado |

### TaskEventParticipant (`task_event_participants`)
Participantes por evento, con detección de conflictos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `event_id` | int | Referencia al evento |
| `user_id` | int | ID del participante |
| `user_nombre` | str | Nombre desnormalizado |
| `has_conflict` | bool | Si hay conflicto de horario |
| `conflict_detail` | str \| null | Descripción del conflicto |

### TaskActivityLog (`task_activity_log`)
Auditoría de cada cambio en una tarea.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `task_id` | int | Referencia a la tarea |
| `user_id` | int | Quién realizó la acción |
| `user_nombre` | str | Nombre desnormalizado |
| `accion` | str | `creacion`, `cambio_estado`, `edicion` |
| `detalle` | str \| null | Descripción del cambio (max 400) |
| `fecha` | datetime | Cuándo ocurrió |

---

## 2. API Endpoints

**Base:** `/api/herramientas/tareas`

### Endpoints de Usuario (requiere `tool_task_submit_dev`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/mis-tareas` | Tareas propias paginadas con filtros |
| POST | `/` | Crear nueva tarea |
| PATCH | `/{task_id}` | Editar tarea propia |
| GET | `/mis-metricas` | KPIs personales |
| GET | `/{task_id}/historial` | Historial de actividad de una tarea |

**Parámetros de filtro para `/mis-tareas`:**
`page`, `limit`, `search`, `estado`, `etiqueta`, `plataforma`, `fecha_exacta`, `fecha_desde`, `fecha_hasta`

### Endpoints de Manager (requiere `tool_task_manage_dev`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/equipo` | Tareas del equipo (sin paginar) |
| GET | `/equipo/tareas-paginadas` | Tareas del equipo paginadas |
| GET | `/equipo/kpis` | KPIs del equipo |
| GET | `/equipo/personas` | Resumen por persona |
| GET | `/equipo/graficas` | Datos para gráficas (5 series) |
| GET | `/equipo/sin-registro-hoy` | Miembros sin tarea hoy |
| GET | `/equipo/export/excel` | Descarga Excel con filtros activos |
| GET | `/equipo/export/pdf` | Descarga PDF con filtros activos |

### Endpoints de Configuración de Equipo (requiere `tool_task_manage_dev`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/equipo/config/miembros` | Listar miembros activos |
| GET | `/equipo/config/usuarios-disponibles` | Usuarios disponibles para agregar |
| POST | `/equipo/config/miembros` | Agregar miembro al equipo |
| DELETE | `/equipo/config/miembros/{user_id}` | Desactivar miembro (soft delete) |

### Endpoints de Agenda

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/agenda` | Crear evento de calendario |
| GET | `/agenda/{fecha}` | Obtener eventos de una fecha (`YYYY-MM-DD`) |

**Nota:** El sistema detecta conflictos de horario automáticamente al crear eventos.

### Endpoints de Admin (requiere `role == "admin"`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/admin/asignar-tool` | Asignar herramienta a usuario |
| GET | `/admin/user-tools/{user_id}` | Ver herramientas activas de usuario |
| DELETE | `/admin/revocar-tool` | Revocar herramienta |

**Tool keys disponibles:**
- `tool_task_submit_dev` — Puede crear y gestionar sus propias tareas
- `tool_task_manage_dev` — Puede gestionar equipo, ver dashboards

---

## 3. Servicios Backend

**Ubicación:** `backend/app/services/`

### `work_task_service.py`
CRUD principal de tareas y métricas personales.
- Valida etiqueta, plataforma y estado
- Calcula `tiempo_total_minutos` desde hora_inicio y hora_cierre
- Registra actividad en `TaskActivityLog` en cada operación
- Aplica filtros múltiples en consultas paginadas

### `task_dashboard_service.py`
Analítica para la vista de manager.
- Calcula KPIs del equipo: tareas registradas, horas, estados, usuarios activos
- Genera resúmenes por persona
- Produce 5 series para gráficas:
  1. Tareas por responsable
  2. Horas por responsable
  3. Distribución por estado
  4. Tareas por etiqueta
  5. Evolución de completadas (línea temporal)
- Detecta miembros sin registro del día

### `task_team_service.py`
Gestión del equipo.
- Crea el equipo si no existe (patrón get_or_create, 1 equipo por scope)
- Agrega o reactiva miembros
- Desactiva miembros con soft delete

### `task_event_service.py`
Lógica de calendario y eventos.
- Detecta solapamiento de horarios entre eventos del mismo participante
- Genera `has_conflict` y `conflict_detail` por participante

### `task_export_service.py`
Exportación de datos.
- Excel: generado con `openpyxl`
- PDF: generado con `weasyprint`
- Ambos respetan los filtros activos al momento de exportar

---

## 4. Frontend — Hooks React Query

**Ubicación:** `frontend/src/hooks/useWorkTasks.ts`

### Hooks de Usuario
| Hook | Descripción |
|------|-------------|
| `useMyTasks(filters)` | Tareas propias paginadas |
| `useMyTaskMetrics()` | KPIs personales |
| `useCreateWorkTask()` | Mutación: crear tarea |
| `useUpdateWorkTask()` | Mutación: editar tarea |

### Hooks de Manager/Equipo
| Hook | Descripción |
|------|-------------|
| `useTeamTasks(filters)` | Tareas del equipo |
| `useTeamKpis(filters)` | KPIs del equipo |
| `useTeamPersonSummaries(filters)` | Resumen por persona |
| `useTeamCharts(filters)` | Datos de gráficas |
| `useUsersWithoutTodayEntry()` | Sin registro hoy |
| `useTeamMembers()` | Miembros del equipo |
| `useAvailableTeamUsers()` | Usuarios disponibles |
| `useAddTeamMember()` | Mutación: agregar miembro |
| `useRemoveTeamMember()` | Mutación: remover miembro |

### Hooks de Agenda
| Hook | Descripción |
|------|-------------|
| `useEventsByDate(fecha)` | Eventos de una fecha |
| `useCreateEvent()` | Mutación: crear evento |

### Hooks de Admin (Tools)
| Hook | Descripción |
|------|-------------|
| `useUserTools(userId)` | Herramientas de un usuario |
| `useAssignUserTool()` | Mutación: asignar tool |
| `useRevokeUserTool()` | Mutación: revocar tool |

---

## 5. Frontend — Componentes UI

**Ubicación:** `frontend/src/components/herramientas/tareas/`

### Página principal
**`GestionTareasPage.tsx`** — Contenedor principal. Determina el rol del usuario (manager vs. usuario) y renderiza la vista correspondiente. Incluye el sidebar de calendario.

### Vistas principales
**`TaskManagerView.tsx`** — Vista del manager:
- Tabla de tareas del equipo
- Tarjetas KPI del equipo
- Barra de filtros
- Botones de exportación Excel/PDF
- Tarjetas por persona (`PersonTaskCards`)
- Tab de gráficas
- Diálogo de configuración del equipo

**`TaskSubmitView.tsx`** — Vista del usuario regular:
- Formulario de creación de tarea
- KPIs personales
- Tabla de tareas propias
- Alerta si no hay tarea registrada hoy

### Formularios y filtros
**`TaskForm.tsx`** — Formulario de creación/edición. Incluye selectores para etiqueta, plataforma, estado y time picker para inicio/cierre. Calcula duración automáticamente.

**`TaskFiltersBar.tsx`** — Barra de filtros avanzados. Rango de fechas, responsable (solo manager), estado, etiqueta, plataforma, búsqueda libre.

### Visualización de datos
**`TaskDataTable.tsx`** — Tabla responsiva con columnas: responsable, tarea, fecha, etiqueta, plataforma, tiempo, estado. Click en fila abre detalle lateral.

**`PersonTaskCards.tsx`** — Tarjetas interactivas por miembro del equipo. Muestra métricas individuales. Click filtra la tabla por esa persona.

**`TaskDetailSheet.tsx`** — Panel lateral con detalle completo de una tarea. Incluye historial de actividad y opción de edición (si es propia).

### Gráficas
**`TaskCharts.tsx`** — Dashboard de visualizaciones:
1. Barra: Tareas por responsable
2. Barra: Horas por responsable
3. Pie: Distribución por estado
4. Barra: Tareas por etiqueta
5. Línea: Evolución de completadas

### Calendario y agenda
**`CalendarSidebar.tsx`** — Sidebar con `react-day-picker`. Redimensionable con drag. Al seleccionar fecha abre el ScheduleSheet.

**`ScheduleSheet.tsx`** — Panel para crear/ver eventos. Incluye detección de conflictos, selección de participantes y duración.

### Configuración de equipo
**`TaskTeamConfigDialog.tsx`** — Modal para agregar/remover miembros del equipo. Muestra usuarios disponibles vs. activos.

---

## 6. Flujos de Datos Principales

### Crear una tarea
```
Usuario llena TaskForm
  → useCreateWorkTask() mutation
  → POST /api/herramientas/tareas/
  → Backend: require_tool_or_403("tool_task_submit_dev")
  → work_task_service.create_task()
    → Valida etiqueta/plataforma/estado
    → Calcula tiempo_total_minutos
    → Inserta WorkTask
    → Inserta TaskActivityLog (accion="creacion")
  → Respuesta: WorkTaskRead
  → Invalidación de queries → refresco de datos
```

### Dashboard del manager (carga inicial)
```
TaskManagerView monta
  → Queries en paralelo:
    - useTeamTasks()       → tabla
    - useTeamKpis()        → KPI cards
    - useTeamPersonSummaries() → tarjetas por persona
    - useTeamCharts()      → gráficas
    - useUsersWithoutTodayEntry() → alerta
  → Todos responden desde task_dashboard_service.py
  → Render paralelo de todos los componentes
```

### Exportar datos
```
Click en botón Excel/PDF
  → exportTasksExcel(filters) / exportTasksPdf(filters)
  → GET /equipo/export/excel?...filtros...
  → task_export_service.build_tasks_excel()
  → Respuesta: archivo binario con header attachment
  → Browser descarga el archivo automáticamente
```

### Crear evento de agenda
```
Usuario abre ScheduleSheet, llena formulario
  → useCreateEvent() mutation
  → POST /api/herramientas/tareas/agenda
  → task_event_service.create_event()
    → Por cada participante:
      - Busca eventos del mismo día
      - Detecta solapamiento de horarios
      - Asigna has_conflict + conflict_detail
    → Inserta TaskEvent + TaskEventParticipants
  → Respuesta: {ok: true, event_id}
  → Calendario se refresca
```

---

## 7. Sistema de Permisos

### Control de acceso por herramientas

```typescript
// Puede crear/editar sus propias tareas:
canSubmitDevTasks(userTools)
  → tiene "tool_task_submit_dev" OR is_team_member = true

// Puede gestionar el equipo y ver dashboards:
canManageDevTasks(userTools, role)
  → tiene "tool_task_manage_dev" OR role = "admin"
```

**Reglas importantes:**
- El rol `admin` **NO otorga automáticamente** acceso a las herramientas
- Las herramientas son **scoped**: cada tool está ligada a un scope específico
- La asignación se hace vía `/admin/asignar-tool`
- Los managers pueden agendar eventos para miembros; los usuarios solo para sí mismos

### Edición de tareas
- Los usuarios solo pueden editar **sus propias tareas**
- El backend valida ownership antes de permitir PATCH

---

## 8. Tema y Estilos

**Ubicación:** `frontend/src/lib/taskTheme.ts`

El módulo usa tokens de estilos centralizados:
- Superficies: bordes grises claros, sombras sutiles
- Botones: primario (negro), secundario (borde gris), danger (rojo)
- Badges: color-coded por etiqueta y estado

**Paleta de etiquetas:**
- `desarrollos` → azul
- `actualizaciones` → morado
- `auditorias` → naranja
- `implementacion_okr` → teal
- `tareas_diarias` → gris

**Paleta de estados:**
- `en_progreso` → azul
- `completada` → verde
- `bloqueada` → rojo

---

## 9. Decisiones Arquitectónicas Clave

1. **Un solo equipo por scope** — Patrón get_or_create, existe exactamente un `TaskTeam` para `desarrollo_innovacion`
2. **Campos desnormalizados** — Nombres capturados al momento de creación para evitar JOINs y preservar historial
3. **Soft deletes en membresía** — `TaskTeamMember.is_active` para desactivar sin perder historial
4. **Sin auto-grant para admin** — El rol admin no bypassa la verificación de tools
5. **Base de datos única** — Las tablas viven en `intranet.db`, no en una DB separada del módulo
6. **Auditoría completa** — Todo cambio en una tarea queda en `TaskActivityLog`
7. **Scope isolation** — Todas las queries filtran por la constante `SCOPE_DEV`

---

## 10. Archivos Clave

### Backend
| Archivo | Propósito |
|---------|-----------|
| `backend/app/models/work_task.py` | Modelo principal de tarea |
| `backend/app/models/task_team.py` | Contenedor de equipo |
| `backend/app/models/task_team_member.py` | Membresía de equipo |
| `backend/app/models/task_event.py` | Eventos de calendario |
| `backend/app/models/task_activity_log.py` | Auditoría de cambios |
| `backend/app/routers/herramientas_tareas.py` | 16 endpoints API |
| `backend/app/services/work_task_service.py` | CRUD de tareas |
| `backend/app/services/task_dashboard_service.py` | Analítica del equipo |
| `backend/app/services/task_team_service.py` | Gestión del equipo |
| `backend/app/services/task_event_service.py` | Lógica de calendario |
| `backend/app/services/task_export_service.py` | Exportación Excel/PDF |

### Frontend
| Archivo | Propósito |
|---------|-----------|
| `frontend/src/types/workTask.ts` | Tipos TypeScript |
| `frontend/src/hooks/useWorkTasks.ts` | Hooks React Query |
| `frontend/src/hooks/useTaskExports.ts` | Funciones de exportación |
| `frontend/src/lib/taskTheme.ts` | Tokens de estilos |
| `frontend/src/lib/permissions.ts` | Control de acceso |
| `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` | Página principal |
| `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` | Vista manager |
| `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx` | Vista usuario |
| `frontend/src/components/herramientas/tareas/TaskForm.tsx` | Formulario de tarea |
| `frontend/src/components/herramientas/tareas/TaskCharts.tsx` | Gráficas |
| `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx` | Sidebar calendario |
| `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx` | Panel de agenda |

### Documentación existente
| Archivo | Contenido |
|---------|-----------|
| `plans/2026-05-07-gestion-tareas-desarrollo-innovacion.md` | Plan maestro de implementación |
| `docs/fase-A-backend-tareas-completada.md` | Resumen de backend completado |
| `docs/fase-BC-frontend-tareas-completada.md` | Resumen de frontend completado |
