# Fase A — Backend Gestión de Tareas: COMPLETADA
> Documento de handoff para el agente que continúe la implementación.
> Fecha: 2026-05-07
> Plan origen: `plans/2026-05-07-gestion-tareas-desarrollo-innovacion.md`

---

## Qué se implementó (Fases 1–4 del plan)

### Fases completadas
- **Fase 1** — Modelos SQLModel en BD principal (`intranet.db`)
- **Fase 2** — Schemas Pydantic
- **Fase 3** — Services de negocio
- **Fase 4** — Router FastAPI + registro en `main.py`

### Commits (en orden)
```
529a982  feat(tareas): add backend models
8f83f6f  fix: normalize nullable=False and document denormalized field
c6754a8  feat(tasks): add Pydantic schemas
8a519e0  fix: corregir tipos en schemas (from_attributes, datetime vs str)
4b29602  feat: add backend services (primer commit del agente)
99e49d8  feat: add backend services — user_tool, task_team, work_task, dashboard, export
ba7cbf6  fix: corregir sin_registro_hoy, duración negativa y N+1
d78d396  feat: router herramientas_tareas + registro en main.py
31d5875  fix: corregir tuple-unpacking, updated_at, import no usado
```

---

## Archivos creados / modificados

### Nuevos archivos
```
backend/app/models/user_tool.py          — tabla user_tools
backend/app/models/task_team.py          — tabla task_teams
backend/app/models/task_team_member.py   — tabla task_team_members
backend/app/models/work_task.py          — tabla work_tasks

backend/app/schemas/user_tool.py         — UserToolRead, UserToolCreate
backend/app/schemas/work_task.py         — WorkTaskCreate, WorkTaskUpdate, WorkTaskRead
backend/app/schemas/task_dashboard.py    — TaskFilters, TaskKpis, PersonTaskSummary
backend/app/schemas/task_team.py         — TaskTeamMemberRead, TaskTeamMemberCreate, AvailableUserRead

backend/app/services/user_tool_service.py      — user_has_tool, require_tool_or_403
backend/app/services/task_team_service.py      — get_or_create_dev_team, list_team_members, etc.
backend/app/services/work_task_service.py      — create_task, update_own_task, list_own_tasks, own_metrics
backend/app/services/task_dashboard_service.py — get_team_tasks, get_team_kpis, get_person_summaries, get_chart_data
backend/app/services/task_export_service.py    — build_tasks_excel (openpyxl), build_tasks_pdf (weasyprint)

backend/app/routers/herramientas_tareas.py     — 16 endpoints en /api/herramientas/tareas/*
```

### Archivos modificados
```
backend/app/database.py   — registra las 4 nuevas tablas en create_db_and_tables()
backend/app/main.py       — importa y registra herramientas_tareas_router
```

---

## API disponible

### Endpoints usuario (requiere tool: `tool_task_submit_dev`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/herramientas/tareas/mis-tareas` | Lista mis tareas con filtros |
| POST | `/api/herramientas/tareas/` | Crea tarea propia |
| PATCH | `/api/herramientas/tareas/{task_id}` | Edita tarea propia |
| GET | `/api/herramientas/tareas/mis-metricas` | KPIs personales |

### Endpoints directiva (requiere tool: `tool_task_manage_dev`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/herramientas/tareas/equipo` | Tareas del equipo con filtros |
| GET | `/api/herramientas/tareas/equipo/kpis` | KPIs del equipo |
| GET | `/api/herramientas/tareas/equipo/personas` | Resumen por persona |
| GET | `/api/herramientas/tareas/equipo/graficas` | Datos para gráficas (5 series) |
| GET | `/api/herramientas/tareas/equipo/sin-registro-hoy` | Personas sin registro hoy |
| GET | `/api/herramientas/tareas/equipo/export/excel` | Descarga Excel |
| GET | `/api/herramientas/tareas/equipo/export/pdf` | Descarga PDF |
| GET | `/api/herramientas/tareas/equipo/config/miembros` | Lista miembros del equipo |
| GET | `/api/herramientas/tareas/equipo/config/usuarios-disponibles` | Usuarios disponibles para agregar |
| POST | `/api/herramientas/tareas/equipo/config/miembros` | Agrega miembro al equipo |
| DELETE | `/api/herramientas/tareas/equipo/config/miembros/{user_id}` | Desactiva miembro |

### Endpoint admin (requiere `role == "admin"`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/herramientas/tareas/admin/asignar-tool` | Asigna tool a usuario |

---

## Decisiones importantes que el siguiente agente DEBE respetar

1. **No hay bypass de admin** — `require_tool_or_403` NO da acceso automático a `role="admin"`. Los tools se asignan explícitamente via `/admin/asignar-tool`.

2. **Scope fijo** — Todo está scoped a `"desarrollo_innovacion"`. El plan contempla otros scopes en el futuro pero v1 solo tiene este.

3. **Tablas en intranet.db** — Las 4 tablas nuevas viven en la BD principal, NO en `gerencial.db`, `oc.db`, `sgc.db` ni `financiero.db`.

4. **No Alembic** — Tablas se crean en `create_db_and_tables()` via `SQLModel.metadata.create_all()`.

5. **`gerencial_database.py` no se toca** — Datos históricos de tareas gerenciales siguen allí. La limpieza es Fase 12 del plan.

6. **Filtros compartidos** — `TaskFilters` alimenta KPIs, gráficas, personas, tabla y exportaciones. No romper este contrato.

7. **`weasyprint`** — Ya estaba en `requirements.txt`, no se agregó. El error de libgobject en Windows es normal en desarrollo local; funciona en Docker/Linux.

8. **`SCOPE_DEV`** está duplicado en 3 services — pendiente de centralizar en un módulo de constantes (minor debt, no bloqueante).

---

## Estado de la BD al arrancar

Al hacer `startup`, `create_db_and_tables()` crea automáticamente las 4 tablas nuevas si no existen. No hay seed de tools ni miembros — eso se hace manualmente via:

```bash
# Asignar tool a un usuario (reemplazar user_id con el ID real)
POST /api/herramientas/tareas/admin/asignar-tool
Authorization: Bearer <token-admin>
{
  "user_id": 1,
  "tool_key": "tool_task_submit_dev",
  "scope": "desarrollo_innovacion"
}
```

---

## Lo que falta implementar (Fases B, C, D del plan original)

### Fase B — Auth: Exponer `user_tools` en `/auth/me` (plan Fase 11)
**Archivo a modificar:** `backend/app/routers/auth.py`
- `MeResponse` class necesita campo `user_tools: list[str] = []`
- El endpoint `/auth/me` debe consultar `UserTool` y retornar solo `tool_key` activos del usuario

### Fase C — Frontend completo (plan Fases 6–9)
**Archivos nuevos en `frontend/src/`:**
- `types/workTask.ts`, `types/userTool.ts`
- `lib/permissions.ts` — helpers `canSubmitDevTasks`, `canManageDevTasks`
- `store/authStore.ts` — agregar `user_tools?: string[]`
- `hooks/useWorkTasks.ts` — todos los hooks de TanStack Query
- `hooks/useTaskExports.ts` — descarga Excel/PDF via Blob
- `pages/herramientas/tareas/GestionTareasPage.tsx` — página contenedora
- `components/herramientas/tareas/TaskSubmitView.tsx` — vista usuario
- `components/herramientas/tareas/TaskManagerView.tsx` — vista directiva
- `components/herramientas/tareas/TaskForm.tsx` — formulario
- `components/herramientas/tareas/TaskFiltersBar.tsx` — filtros
- `components/herramientas/tareas/PersonTaskCards.tsx` — tarjetas interactivas
- `components/herramientas/tareas/TaskCharts.tsx` — gráficas con Recharts
- `components/herramientas/tareas/TaskDataTable.tsx` — tabla
- `components/herramientas/tareas/TaskDetailSheet.tsx` — detalle lateral
- `components/herramientas/tareas/TaskTeamConfigDialog.tsx` — config equipo
- `lib/taskTheme.ts` — tokens de estilo centralizados

### Fase D — Integración final (plan Fases 10, 12, 13)
- `frontend/src/App.tsx` — agregar ruta `/herramientas/tareas`
- `frontend/src/components/layout/Sidebar.tsx` — separar "Módulos" vs "Mis herramientas"
- `frontend/src/pages/gerencial/GerencialPage.tsx` — retirar tareas como experiencia principal
- Verificación completa (checklist del plan Fase 13)

---

## Checklist de verificación backend (Fase 13 del plan)

El siguiente agente debe verificar antes de hacer handoff al frontend:
- [ ] `python -c "from app.models.work_task import WorkTask; from app.models.user_tool import UserTool; from app.models.task_team import TaskTeam; from app.models.task_team_member import TaskTeamMember; print('OK')"` → OK
- [ ] Backend arranca sin errores de import
- [ ] Tablas `work_tasks`, `user_tools`, `task_teams`, `task_team_members` se crean en intranet.db
- [ ] `/api/herramientas/tareas/mis-tareas` responde 403 sin tool asignada
- [ ] Usuario con `tool_task_submit_dev` puede crear tarea
- [ ] Usuario con `tool_task_submit_dev` recibe 403 en endpoints de equipo
- [ ] Usuario con `tool_task_manage_dev` puede ver dashboard directivo
- [ ] Admin sin tool asignada recibe 403 en endpoints de tareas (NO bypass automático)

---

## Cómo leer el plan original

El plan completo está en `plans/2026-05-07-gestion-tareas-desarrollo-innovacion.md`.
El orden recomendado por el plan es: Fase 11 → 6 → 7 → 8 → 9 → 10 → 12 → 13.
(Fases 1–5 ya están completas.)
