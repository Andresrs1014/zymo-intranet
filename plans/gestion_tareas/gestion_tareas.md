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
| `asignado_a_id` | int \| null | ID del usuario asignado |
| `asignado_a_nombre` | str \| null | Nombre del asignado (desnormalizado) |
| `fecha` | date | Fecha de la tarea (default: hoy) |
| `hora_inicio` | datetime \| null | Inicio de la tarea |
| `hora_cierre` | datetime \| null | Cierre de la tarea |
| `tiempo_total_minutos` | int \| null | Duración calculada automáticamente |
| `etiqueta` | str | Categoría de la tarea |
| `plataforma` | str | Sistema al que aplica |
| `prioridad` | str | `baja`, `media`, `alta` (default: `media`) |
| `titulo` | str (max 250) | Título corto |
| `descripcion_tecnica` | str | Descripción detallada |
| `estado` | str | Estado actual de la tarea |
| `created_at` | datetime | Fecha de creación del registro |
| `updated_at` | datetime | Última modificación |

### TaskTeam (`task_teams`)
Contenedor de equipo por manager.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `name` | str | Nombre del equipo |
| `owner_user_id` | int | Responsable del equipo (manager) |
| `is_active` | bool | Estado activo |
| `created_at` | datetime | — |
| `updated_at` | datetime | — |

### TaskTeamMember (`task_team_members`)
Membresía de usuarios al equipo. Usa soft-delete con `is_active`.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `team_id` | int | Referencia al TaskTeam |
| `user_id` | int | ID del usuario |
| `role` | str | `member` \| `co_gestor` |
| `is_active` | bool | Activo / inactivo (soft delete) |
| `created_at` | datetime | — |
| `updated_at` | datetime | — |

### TaskEvent (`task_events`)
Eventos de calendario del equipo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `owner_user_id` | int | Manager propietario del evento |
| `team_id` | int \| null | Equipo relacionado |
| `titulo` | str | Título del evento |
| `descripcion` | str \| null | Descripción opcional |
| `plataforma` | str \| null | Plataforma relacionada |
| `prioridad` | str \| null | Prioridad del evento |
| `fecha` | date | Fecha del evento |
| `hora_inicio` | str | Formato `"HH:MM"` |
| `duracion_minutos` | int | Duración (default 60) |
| `creado_por_id` | int | ID del creador |
| `creado_por_nombre` | str | Nombre desnormalizado |
| `created_at` | datetime | — |
| `updated_at` | datetime | — |

### TaskEventParticipant (`task_event_participants`)
Participantes por evento, con detección de conflictos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `event_id` | int | Referencia al evento |
| `user_id` | int | ID del participante |
| `user_nombre` | str | Nombre desnormalizado |
| `has_conflict` | bool | Si hay conflicto de horario |
| `conflict_detail` | str \| null | Descripción del conflicto |

### TaskAttachment (`task_attachments`)
Archivos adjuntos a una tarea. Máx. 20 MB por archivo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `task_id` | int | Referencia a la tarea |
| `filename` | str | Nombre original del archivo |
| `file_path` | str | Ruta en disco (UUID rename) |
| `mime_type` | str | Tipo MIME |
| `size_bytes` | int | Tamaño en bytes |
| `uploaded_by_id` | int | ID del usuario que subió |
| `uploaded_at` | datetime | — |

### TaskListConfig (`task_list_configs`)
Valores configurables para listas desplegables del formulario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
| `owner_user_id` | int | Manager propietario (aislamiento por workspace) |
| `list_type` | str | `estado` \| `etiqueta` \| `plataforma` \| `prioridad_agenda` |
| `value` | str | Valor interno (slug) |
| `label` | str | Etiqueta visible |
| `is_active` | bool | Soft delete |
| `is_final` | bool | Marca estado como "final" (solo 1 por workspace) |
| `is_canceled` | bool | Marca estado como "cancelado" (solo 1 por workspace) |
| `is_initial_assignment` | bool | Marca estado como "asignación inicial" (solo 1 por workspace) |
| `created_at` | datetime | — |
| `updated_at` | datetime | — |

### TaskActivityLog (`task_activity_log`)
Auditoría de cada cambio en una tarea.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | — |
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
| GET | `/mis-equipos` | Equipos activos del usuario |
| GET | `/mis-equipos-gestionados` | Equipos que gestiona (manager primario + co-gestor) |
| GET | `/equipo/companeros` | Compañeros para asignar tareas |
| GET | `/{task_id}/historial` | Historial de actividad de una tarea |
| POST | `/{task_id}/adjuntos` | Subir archivo adjunto |
| GET | `/{task_id}/adjuntos` | Listar adjuntos de una tarea |
| GET | `/adjuntos/{attachment_id}` | Descargar/ver adjunto |
| DELETE | `/adjuntos/{attachment_id}` | Eliminar adjunto |

**Parámetros de filtro para `/mis-tareas`:**
`page`, `limit`, `search`, `estado`, `etiqueta`, `plataforma`, `fecha_exacta`, `fecha_desde`, `fecha_hasta`, `responsable_id`, `team_id`

### Endpoints de Manager (requiere `tool_task_manage_dev` o co-gestor)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/equipo` | Tareas del equipo (sin paginar) |
| GET | `/equipo/tareas-paginadas` | Tareas del equipo paginadas |
| PATCH | `/equipo/tareas/{task_id}` | Manager actualiza tarea del equipo |
| GET | `/equipo/kpis` | KPIs del equipo |
| GET | `/equipo/personas` | Resumen por persona |
| GET | `/equipo/graficas` | Datos para gráficas |
| GET | `/equipo/sin-registro-hoy` | Miembros sin tarea hoy |
| GET | `/equipo/export/excel` | Descarga Excel con filtros activos |
| GET | `/equipo/export/pdf` | Descarga PDF con filtros activos |

### Endpoints de Configuración de Equipo (requiere `tool_task_manage_dev` o co-gestor)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/equipo/config/equipo` | Info del equipo |
| PATCH | `/equipo/config/equipo` | Actualizar nombre del equipo |
| GET | `/equipo/config/miembros` | Listar miembros activos |
| GET | `/equipo/config/usuarios-disponibles` | Usuarios disponibles para agregar |
| POST | `/equipo/config/miembros` | Agregar miembro (+ auto-asigna `tool_task_submit_dev`) |
| DELETE | `/equipo/config/miembros/{user_id}` | Desactivar miembro (soft delete) |
| POST | `/equipo/config/miembros/{user_id}/promover` | Promover miembro a co-gestor (solo manager primario) |
| POST | `/equipo/config/miembros/{user_id}/degradar` | Degradar co-gestor a miembro (solo manager primario) |

### Endpoints de Agenda

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/agenda` | Crear evento de calendario |
| GET | `/agenda/{fecha}` | Obtener eventos de una fecha (`YYYY-MM-DD`) |
| DELETE | `/agenda/{event_id}` | Cancelar evento |
| PATCH | `/agenda/{event_id}/participantes` | Agregar/remover participantes |

**Nota:** El sistema detecta conflictos de horario automáticamente al crear/modificar eventos.

### Endpoints de Configuración de Listas (requiere manage access)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/config/listas` | Obtener items de listas del workspace |
| POST | `/config/listas` | Crear nuevo item en lista |
| PATCH | `/config/listas/{list_type}/{value}` | Actualizar item (label, is_active) |
| DELETE | `/config/listas/{list_type}/{value}` | Desactivar item |
| PATCH | `/config/listas/estado/{value}/especial` | Marcar estado como final/cancelado/inicial |

### Endpoints de Admin (requiere `role == "admin"`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/admin/asignar-tool` | Asignar herramienta a usuario |
| GET | `/admin/user-tools/{user_id}` | Ver herramientas activas de usuario |
| DELETE | `/admin/revocar-tool` | Revocar herramienta |
| GET | `/admin/tareas-usuario/{user_id}` | Ver todas las tareas de un usuario |
| DELETE | `/admin/tareas/{task_id}` | Eliminar tarea permanentemente |

**Tool keys disponibles:**
- `tool_task_submit_dev` — Puede crear y gestionar sus propias tareas
- `tool_task_manage_dev` — Puede gestionar equipo, ver dashboards

---

## 3. Servicios Backend

**Ubicación:** `backend/app/services/`

### `work_task_service.py`
CRUD principal de tareas y métricas personales.
- `create_task()` — Crea tarea con validación, auto-asignación de equipo, calcula tiempo y registra auditoría
- `update_own_task()` — El dueño o asignado actualiza la tarea (campos restringidos para asignados)
- `update_team_task()` — El manager actualiza cualquier tarea del equipo con enforcement de workspace
- `list_own_tasks()` / `get_paginated_tasks()` — Listados con filtros y eager-loading de adjuntos
- `own_metrics()` — KPIs personales (conteos, horas, distribución de estados)
- `_maybe_auto_close()` — Cierra automáticamente `hora_cierre` cuando la tarea llega a estado final/cancelado
- `log_activity()` / `get_task_activity()` — Registro de auditoría

### `task_team_service.py`
Gestión del equipo y roles.
- `get_or_create_manager_team()` — Crea equipo por defecto para cada manager (1 equipo por manager)
- `list_team_members()`, `add_team_member()`, `deactivate_team_member()` — CRUD de miembros
- `promote_to_cogestor()` / `demote_to_member()` — Gestión de roles dentro del equipo
- `get_user_active_teams()` — Equipos activos del usuario
- `get_all_comanaged_owner_ids()` — Equipos donde el usuario es co-gestor
- `get_companeros()` — Compañeros de equipo para asignar tareas

### `task_dashboard_service.py`
Analítica para la vista de manager.
- `get_team_kpis()` — KPIs del equipo: tareas registradas, horas, estados, usuarios activos
- `get_person_summaries()` — Resúmenes por persona con conteos y horas
- `get_chart_data()` — 5 series para gráficas: por responsable, horas, estado, etiqueta, evolución de completadas
- `get_users_without_today_entry()` — Miembros sin registro del día

### `task_event_service.py`
Lógica de calendario y eventos.
- `create_event()` — Crea evento con participantes y detección de solapamientos
- `get_events_by_date()` — Eventos por fecha (todo para managers, propios para usuarios)
- `delete_event()` — Elimina evento y sus participantes
- `update_event_participants()` — Agrega/remueve participantes con re-detección de conflictos

### `task_attachment_service.py`
Archivos adjuntos por tarea. Máx. 20 MB.
- `create_attachment()` — Guarda archivo en disco con UUID rename + registro en DB
- `list_attachments()` / `get_attachment()` — Consultas
- `delete_attachment()` — Elimina archivo de disco + registro
- `get_attachment_file()` — Retorna stream del archivo

### `task_list_config_service.py`
Configuración de listas desplegables (estado, etiqueta, plataforma, prioridad_agenda).
- `get_lists_by_owner()` — Obtiene listas por workspace con auto-seeding de defaults
- `create_list_item()`, `update_list_item()`, `delete_list_item()` — CRUD
- `mark_estado_especial()` — Marca estado como final/cancelado/inicial (solo 1 de cada tipo por workspace)

### `task_export_service.py`
Exportación de datos.
- `build_tasks_excel()` — Genera Excel (.xlsx) con `openpyxl`
- `build_tasks_pdf()` — Genera PDF con `weasyprint` + `jinja2`
- Ambos respetan los filtros activos al momento de exportar

### `user_tool_service.py`
Control de acceso por herramientas.
- `require_tool_or_403()` — Gateway: admin bypass o verifica UserTool activa
- `user_has_tool()` — Consulta si el usuario tiene una tool activa
- `ensure_user_has_tool()` — Crea o reactiva una tool para un usuario

---

## 4. Frontend — Hooks React Query

**Ubicación:** `frontend/src/hooks/useWorkTasks.ts`, `useTaskAttachments.ts`, `useTaskExports.ts`

### Hooks de Usuario
| Hook | Descripción |
|------|-------------|
| `useMyTasks(filters)` | Tareas propias paginadas |
| `useMyTaskMetrics(teamId)` | KPIs personales |
| `useMyTeams()` | Equipos activos del usuario |
| `useManagedTeams()` | Equipos gestionados (manager + co-gestor) |
| `useCreateWorkTask()` | Mutación: crear tarea |
| `useUpdateWorkTask()` | Mutación: editar tarea propia |
| `useUpdateManagerTask()` | Mutación: manager edita tarea del equipo |
| `useTaskActivity(taskId)` | Historial de actividad de una tarea |
| `useTeamCompaneros(teamId)` | Compañeros para asignar |
| `useMyTasksPaginated(filters)` | Tareas propias con paginación completa |

### Hooks de Manager/Equipo
| Hook | Descripción |
|------|-------------|
| `useTeamTasks(filters)` | Tareas del equipo |
| `useTeamTasksPaginated(filters)` | Tareas del equipo paginadas |
| `useTeamKpis(filters)` | KPIs del equipo |
| `useTeamPersonSummaries(filters)` | Resumen por persona |
| `useTeamCharts(filters)` | Datos de gráficas |
| `useUsersWithoutTodayEntry()` | Sin registro hoy |
| `useTeamMembers()` | Miembros del equipo |
| `useAvailableTeamUsers()` | Usuarios disponibles |
| `useAddTeamMember()` | Mutación: agregar miembro |
| `useRemoveTeamMember()` | Mutación: remover miembro |
| `usePromoteToCogestor()` | Mutación: promover a co-gestor |
| `useDemoteToMember()` | Mutación: degradar a miembro |
| `useManagerTeamInfo()` | Info del equipo |
| `useUpdateTeamName()` | Mutación: cambiar nombre del equipo |

### Hooks de Listas Configurables
| Hook | Descripción |
|------|-------------|
| `useTaskLists(teamId)` | Items de listas desplegables |
| `useCreateTaskListItem()` | Mutación: crear item |
| `useUpdateTaskListItem()` | Mutación: actualizar item |
| `useDeleteTaskListItem()` | Mutación: eliminar item |
| `useMarkEstadoEspecial()` | Mutación: marcar estado especial |

### Hooks de Agenda
| Hook | Descripción |
|------|-------------|
| `useEventsByDate(fecha)` | Eventos de una fecha |
| `useCreateEvent()` | Mutación: crear evento |
| `useDeleteEvent()` | Mutación: eliminar evento |
| `useUpdateEventParticipants()` | Mutación: agregar/remover participantes |

### Hooks de Adjuntos
| Hook | Descripción |
|------|-------------|
| `useTaskAttachments(taskId)` | Adjuntos de una tarea |
| `useUploadTaskAttachment()` | Mutación: subir archivo |
| `useDeleteTaskAttachment()` | Mutación: eliminar adjunto |
| `getAttachmentUrl(id)` | URL de descarga (utilidad) |
| `useAttachmentBlobUrl(id)` | URL de blob con auth (evita token inválido en `<img>`) |

### Hooks de Admin (Tools)
| Hook | Descripción |
|------|-------------|
| `useUserTools(userId)` | Herramientas de un usuario |
| `useAssignUserTool()` | Mutación: asignar tool |
| `useRevokeUserTool()` | Mutación: revocar tool |
| `useAdminUserTasks(userId)` | Tareas de un usuario (admin) |
| `useAdminDeleteTask()` | Mutación: eliminar tarea (admin) |

### Hooks de Exportación
| Hook | Descripción |
|------|-------------|
| `exportTasksExcel(filters)` | Descargar Excel |
| `exportTasksPdf(filters)` | Descargar PDF |

---

## 5. Frontend — Componentes UI

**Ubicación:** `frontend/src/components/herramientas/tareas/`

### Página principal
**`GestionTareasPage.tsx`** — Contenedor principal. Determina el rol del usuario (manager vs. usuario) y renderiza la vista correspondiente. Incluye el sidebar de calendario.

### Vistas principales
**`TaskManagerView.tsx`** — Vista del manager:
- Left panel con tareas del equipo, KPIs, filtros
- Right panel con selector de tabs: gráficas, personas, configuración
- Botones de exportación Excel/PDF

**`TaskSubmitView.tsx`** — Vista del usuario regular:
- Formulario de creación de tarea
- KPIs personales
- Tabla de tareas propias
- Alerta si no hay tarea registrada hoy

### Formularios y filtros
**`TaskForm.tsx`** — Formulario de creación/edición. Incluye selectores para etiqueta, plataforma, estado, prioridad, asignado a, y time picker para inicio/cierre. Calcula duración automáticamente.

**`AsignarTareaForm.tsx`** — Formulario específico para re-asignar tarea a otro usuario.

**`TaskFiltersBar.tsx`** — Barra de filtros avanzados. Rango de fechas, responsable, estado, etiqueta, plataforma, búsqueda libre.

### Paneles laterales
**`TaskLeftPanel.tsx`** — Panel izquierdo con tabla de tareas, KPIs y filtros.

**`TaskLeftRail.tsx`** — Riél lateral colapsable para navegación rápida.

**`TaskDetailModal.tsx`** — Modal con detalle completo de una tarea. Incluye historial, adjuntos y edición.

**`TaskDetailSheet.tsx`** — Panel lateral con detalle de tarea (versión sheet).

### Visualización de datos
**`TaskDataTable.tsx`** — Tabla responsiva con columnas: responsable, tarea, fecha, etiqueta, plataforma, tiempo, estado, prioridad.

**`PersonTaskCards.tsx`** — Tarjetas interactivas por miembro del equipo. Muestra métricas individuales.

**`PersonCompactList.tsx`** — Versión compacta de la lista de personas.

### Gráficas
**`TaskCharts.tsx`** — Dashboard de visualizaciones (5 gráficas).

**`TaskChartsTab.tsx`** — Tab contenedor de las gráficas con filtros.

### Calendario y agenda
**`CalendarSidebar.tsx`** — Sidebar con `react-day-picker`. Redimensionable con drag.

**`ScheduleSheet.tsx`** — Panel para crear/ver eventos. Incluye detección de conflictos, selección de participantes, plataforma, prioridad y duración.

**`EventDetailSheet.tsx`** — Panel con detalle de evento de agenda.

### Adjuntos
**`AttachmentExplorer.tsx`** — Explorador de archivos adjuntos.

**`AttachmentList.tsx`** — Lista de adjuntos de una tarea.

**`FileUploadZone.tsx`** — Zona de arrastrar y soltar para subir archivos.

**`FilePreviewModal.tsx`** — Modal de previsualización de archivos (imágenes, PDFs).

### Configuración
**`TeamConfigTab.tsx`** — Tab de configuración del equipo (miembros, roles, nombre).

**`TaskTeamConfigDialog.tsx`** — Diálogo modal para gestionar miembros del equipo.

**`ListConfigTab.tsx`** — Tab de configuración de listas desplegables (estados, etiquetas, plataformas).

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
    → Inserta WorkTask (con asignado si aplica)
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

### Asignar tarea a un usuario
```
Manager abre TaskDetailModal/TaskForm, selecciona asignado
  → useUpdateManagerTask() / useUpdateWorkTask() mutation
  → PATCH /equipo/tareas/{task_id} o PATCH /{task_id}
  → work_task_service.update_team_task() / update_own_task()
    → Si cambia estado a "asignación inicial", setea hora_inicio
    → Si cambia a estado final, auto-cierra hora_cierre
    → Registra TaskActivityLog (accion="edicion")
  → Invalidación de queries
```

---

## 7. Sistema de Permisos

### Roles y herramientas

```
                    ┌──────────────────┐
                    │     Admin        │  ← User.role == "admin" (bypass total)
                    └──────────────────┘
                              │
                    ┌──────────────────┐
                    │  Manager (dueño) │  ← owner_user_id del TaskTeam + tool_task_manage_dev
                    └──────────────────┘
                              │
                    ┌──────────────────┐         ┌──────────────────┐
                    │   co_gestor      │         │     member       │
                    │ (herramientas    │         │ (recibe tareas)  │
                    │  de gestión)     │         └──────────────────┘
                    └──────────────────┘
                              │
                    ┌──────────────────┐
                    │  tool_task_submit │  ← todos deben tener al menos este tool
                    └──────────────────┘
```

### Control de acceso
- **`tool_task_submit_dev`** — Crea/edita sus propias tareas, usa agenda para sí mismo, ve compañeros
- **`tool_task_manage_dev`** — Gestión completa del equipo: dashboard, KPIs, exportar, CRUD miembros, configurar listas
- **`co_gestor`** — Acceso a funcionalidades de gestión (dashboard, KPIs, editar tareas del equipo, configurar listas) pero NO puede promover/degradar miembros ni cambiar nombre del equipo
- **`member`** — Miembro regular del equipo, puede recibir tareas asignadas
- **`admin`** — Bypass total a todas las verificaciones de herramientas

### Lógica de acceso (`_require_manage_access`)
El helper `_require_manage_access()` en el router valida:
1. Si el usuario es admin → acceso total
2. Si el usuario tiene `tool_task_manage_dev` y es `owner_user_id` del equipo → manager primario
3. Si el usuario es `co_gestor` en el equipo → acceso de gestión limitado
4. Si se especifica `team_id`, valida acceso a ese equipo específico

### Edición de tareas
- Usuarios con `tool_task_submit_dev` pueden editar **sus propias tareas** o aquellas donde son `asignado_a_id`
- Managers con `tool_task_manage_dev` o co-gestores pueden editar **cualquier tarea del equipo** vía `PATCH /equipo/tareas/{task_id}`
- El backend valida ownership/rol antes de permitir la operación

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

1. **Un equipo por manager** — Cada manager tiene su propio `TaskTeam` (get_or_create)
2. **Multi-workspace** — Usuarios pueden pertenecer a múltiples equipos; co-gestores pueden gestionar equipos ajenos
3. **Campos desnormalizados** — Nombres capturados al momento de creación para evitar JOINs y preservar historial
4. **Soft deletes en membresía** — `TaskTeamMember.is_active` para desactivar sin perder historial
5. **Roles dentro del equipo** — `member` / `co_gestor` para delegar gestión sin dar tool_task_manage_dev
6. **Configuración de listas por workspace** — Cada manager puede personalizar estados, etiquetas y plataformas
7. **Estados especiales** — Un estado puede marcarse como `final`, `cancelado` o `inicial` (solo 1 de cada tipo por workspace)
8. **Auditoría completa** — Todo cambio en una tarea queda en `TaskActivityLog`
9. **Adjuntos por tarea** — Archivos hasta 20 MB almacenados en disco con UUID rename
10. **Scope isolation** — Todas las queries filtran por scope `"desarrollo_innovacion"`
11. **Auto-asignación de tool** — Al agregar un miembro al equipo, se le asigna automáticamente `tool_task_submit_dev`

---

## 10. Archivos Clave

### Backend
| Archivo | Propósito |
|---------|-----------|
| `backend/app/models/work_task.py` | Modelo principal de tarea |
| `backend/app/models/task_team.py` | Contenedor de equipo |
| `backend/app/models/task_team_member.py` | Membresía de equipo con roles |
| `backend/app/models/task_event.py` | Eventos de calendario |
| `backend/app/models/task_event_participant.py` | Participantes de eventos |
| `backend/app/models/task_attachment.py` | Archivos adjuntos |
| `backend/app/models/task_list_config.py` | Configuración de listas desplegables |
| `backend/app/models/task_activity_log.py` | Auditoría de cambios |
| `backend/app/routers/herramientas_tareas.py` | Router principal (~1161 líneas, ~40 endpoints) |
| `backend/app/services/work_task_service.py` | CRUD de tareas |
| `backend/app/services/task_team_service.py` | Gestión del equipo y roles |
| `backend/app/services/task_dashboard_service.py` | Analítica del equipo |
| `backend/app/services/task_event_service.py` | Lógica de calendario |
| `backend/app/services/task_attachment_service.py` | Gestión de adjuntos |
| `backend/app/services/task_list_config_service.py` | Configuración de listas |
| `backend/app/services/task_export_service.py` | Exportación Excel/PDF |
| `backend/app/services/user_tool_service.py` | Control de acceso por tools |
| `backend/app/schemas/work_task.py` | Schemas de tarea |
| `backend/app/schemas/task_team.py` | Schemas de equipo y miembros |
| `backend/app/schemas/task_dashboard.py` | Schemas de dashboard |
| `backend/app/schemas/task_event.py` | Schemas de agenda |
| `backend/app/schemas/task_attachment.py` | Schemas de adjuntos |
| `backend/app/schemas/task_list_config.py` | Schemas de listas configurables |

### Frontend
| Archivo | Propósito |
|---------|-----------|
| `frontend/src/types/workTask.ts` | Tipos TypeScript |
| `frontend/src/hooks/useWorkTasks.ts` | Hooks React Query (~38 hooks) |
| `frontend/src/hooks/useTaskAttachments.ts` | Hooks de adjuntos (~3 hooks + utilidades) |
| `frontend/src/hooks/useTaskExports.ts` | Funciones de exportación |
| `frontend/src/lib/taskTheme.ts` | Tokens de estilos |
| `frontend/src/lib/permissions.ts` | Control de acceso |
| `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` | Página principal |
| `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` | Vista manager |
| `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx` | Vista usuario |
| `frontend/src/components/herramientas/tareas/TaskForm.tsx` | Formulario de tarea |
| `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx` | Formulario de asignación |
| `frontend/src/components/herramientas/tareas/TaskFiltersBar.tsx` | Barra de filtros |
| `frontend/src/components/herramientas/tareas/TaskDataTable.tsx` | Tabla de tareas |
| `frontend/src/components/herramientas/tareas/TaskDetailModal.tsx` | Modal de detalle |
| `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx` | Sheet de detalle |
| `frontend/src/components/herramientas/tareas/TaskLeftPanel.tsx` | Panel izquierdo |
| `frontend/src/components/herramientas/tareas/TaskLeftRail.tsx` | Riél lateral |
| `frontend/src/components/herramientas/tareas/PersonTaskCards.tsx` | Tarjetas por persona |
| `frontend/src/components/herramientas/tareas/PersonCompactList.tsx` | Lista compacta de personas |
| `frontend/src/components/herramientas/tareas/TaskCharts.tsx` | Gráficas |
| `frontend/src/components/herramientas/tareas/TaskChartsTab.tsx` | Tab de gráficas |
| `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx` | Sidebar calendario |
| `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx` | Panel de agenda |
| `frontend/src/components/herramientas/tareas/EventDetailSheet.tsx` | Detalle de evento |
| `frontend/src/components/herramientas/tareas/AttachmentExplorer.tsx` | Explorador de adjuntos |
| `frontend/src/components/herramientas/tareas/AttachmentList.tsx` | Lista de adjuntos |
| `frontend/src/components/herramientas/tareas/FileUploadZone.tsx` | Zona de subida |
| `frontend/src/components/herramientas/tareas/FilePreviewModal.tsx` | Previsualización de archivos |
| `frontend/src/components/herramientas/tareas/TeamConfigTab.tsx` | Configuración de equipo |
| `frontend/src/components/herramientas/tareas/TaskTeamConfigDialog.tsx` | Diálogo de miembros |
| `frontend/src/components/herramientas/tareas/ListConfigTab.tsx` | Configuración de listas |

### Documentación existente
| Archivo | Contenido |
|---------|-----------|
| `plans/2026-05-07-gestion-tareas-desarrollo-innovacion.md` | Plan maestro de implementación |
| `plans/gestion_tareas/Funcionalidad y flujo (Gestión tareas).md` | Flujo funcional |
| `plans/gestion_tareas/Funcionamiento correcto de la gestión de tareas.md` | Correcto funcionamiento |
| `plans/gestion_tareas/2026-05-21-auditoria-logica-gestion-tareas.md` | Auditoría de lógica |
| `docs/fase-A-backend-tareas-completada.md` | Resumen de backend completado |
| `docs/fase-BC-frontend-tareas-completada.md` | Resumen de frontend completado |
