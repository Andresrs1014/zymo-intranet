# Fases B y C — Auth + Frontend Gestión de Tareas: COMPLETADAS
> Documento de handoff para el agente que continúe la implementación.
> Fecha: 2026-05-07
> Plan origen: `plans/2026-05-07-gestion-tareas-desarrollo-innovacion.md`
> Continúa desde: `docs/fase-A-backend-tareas-completada.md`

---

## Qué se implementó

### Fase B — Auth (plan Fase 11)
**Archivo modificado:** `backend/app/routers/auth.py`
- `MeResponse` ahora incluye `user_tools: list[str] = []`
- `_to_me()` helper acepta y retorna `user_tools`
- `/auth/me` consulta `UserTool` activos del usuario y retorna sus `tool_key`

### Fase C1 — Tipos y Hooks (plan Fases 6–7)
**Archivos nuevos:**
- `frontend/src/types/workTask.ts` — interfaces WorkTask, WorkTaskCreate, WorkTaskUpdate, TaskKpis, PersonTaskSummary, TaskTeamMember, AvailableUser, TaskFilters + constantes ETIQUETAS, PLATAFORMAS, ESTADOS
- `frontend/src/types/userTool.ts` — type TaskToolKey
- `frontend/src/hooks/useWorkTasks.ts` — 13 hooks TanStack Query para todas las operaciones
- `frontend/src/hooks/useTaskExports.ts` — exportTasksExcel, exportTasksPdf (descarga Blob)

**Archivos modificados:**
- `frontend/src/types/auth.ts` — `user_tools?: string[]` en User
- `frontend/src/lib/permissions.ts` — helpers: hasUserTool, canSubmitDevTasks, canManageDevTasks

### Fase C2 — Componentes (plan Fase 8)
**Archivo nuevo (tokens):**
- `frontend/src/lib/taskTheme.ts` — tokens centralizados: taskSurface, taskCard, taskButtonPrimary/Secondary/Danger, taskInput, taskLabel, taskBadge, ETIQUETA_COLOR, ESTADO_COLOR, ETIQUETA_LABELS, PLATAFORMA_LABELS, ESTADO_LABELS, formatMinutos

**Componentes nuevos:**
- `frontend/src/components/herramientas/tareas/TaskForm.tsx` — formulario de registro
- `frontend/src/components/herramientas/tareas/TaskFiltersBar.tsx` — barra de filtros (8 filtros + limpiar)
- `frontend/src/components/herramientas/tareas/PersonTaskCards.tsx` — tarjetas interactivas por persona
- `frontend/src/components/herramientas/tareas/TaskCharts.tsx` — 5 gráficas Recharts
- `frontend/src/components/herramientas/tareas/TaskDataTable.tsx` — tabla con click en fila
- `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx` — panel lateral de detalle
- `frontend/src/components/herramientas/tareas/TaskTeamConfigDialog.tsx` — modal configuración equipo
- `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx` — vista usuario
- `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` — vista directiva

**Página nueva:**
- `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` — página contenedora con routing por permisos

---

## Estado de archivos modificados (NO commiteados)

Los cambios de Fases B y C están en los archivos pero **sin commit**. El siguiente agente o el desarrollador debe hacer commit cuando esté listo.

```bash
# Ver archivos modificados/nuevos
git status

# Commit sugerido
git add backend/app/routers/auth.py \
        frontend/src/types/ \
        frontend/src/lib/ \
        frontend/src/hooks/ \
        frontend/src/components/herramientas/ \
        frontend/src/pages/herramientas/

git commit -m "feat(tareas): auth user_tools + frontend completo — hooks, componentes, página"
```

---

## Lo que falta implementar (Fase D)

### 10.1 — Ruta en `frontend/src/App.tsx`

Agregar import:
```typescript
import { GestionTareasPage } from "@/pages/herramientas/tareas/GestionTareasPage"
```

Agregar route dentro del bloque de rutas privadas:
```tsx
<Route path="/herramientas/tareas" element={<PrivateRoute><GestionTareasPage /></PrivateRoute>} />
```

**Nota:** verificar cómo están declaradas las rutas privadas — puede ser `<Route element={<ProtectedRoute />}>` o `<PrivateRoute>` wrapper. Leer `App.tsx` primero.

### 10.2 — Sidebar en `frontend/src/components/layout/Sidebar.tsx`

Separar en dos secciones:
```
Módulos disponibles
  Dashboard / Administrativo / Operativo / SGC / Financiero / Gerencial

Mis herramientas
  Gestión de Tareas  ← mostrar SOLO si canSubmitDevTasks || canManageDevTasks
  Motor IA
  Agentes ZYMO
```

Leer el Sidebar actual antes de modificar — tiene su propia lógica de permisos.

### 12 — Limpiar módulo gerencial

**Archivo:** `frontend/src/pages/gerencial/GerencialPage.tsx`

Cuando la herramienta nueva esté lista, retirar la tab "Desarrollo e Innovación" como experiencia principal. El tab actualmente usa `TareasDevPanel` que apunta al endpoint gerencial antiguo.

Opción conservadora: marcar el tab como "En migración" con un mensaje que redirija a `/herramientas/tareas`.

**NO borrar:**
- `backend/app/gerencial_database.py`
- `backend/app/routers/gerencial.py`
- tablas `gerencial_tareas`

### 13 — Verificación final

Backend (ya debería pasar, pero verificar con datos reales):
```bash
# Asignar tool a usuario admin para probar
POST /api/herramientas/tareas/admin/asignar-tool
{ "user_id": 1, "tool_key": "tool_task_submit_dev", "scope": "desarrollo_innovacion" }
POST /api/herramientas/tareas/admin/asignar-tool
{ "user_id": 1, "tool_key": "tool_task_manage_dev", "scope": "desarrollo_innovacion" }
```

Frontend:
```bash
cd frontend && npm run build
# Debe terminar sin errores TypeScript
```

---

## Decisiones importantes para el siguiente agente

1. **Sin commits pendientes** — Todo está en archivos sin commitear. Commit antes de seguir.

2. **`taskTheme.ts`** es la fuente de verdad de estilos. Cualquier nuevo componente debe importar de allí, no hardcodear clases.

3. **Filtros en TaskManagerView** — El estado `filters` vive en `TaskManagerView` y alimenta TODOS: kpis, personas, graficas, tareas, exportaciones. No romper este contrato.

4. **Zona horaria** — `TaskForm` usa `new Date(...).toISOString()` para enviar horas al backend como UTC. El backend las almacena como datetime UTC. Al mostrar, convertir de UTC a local si se necesita.

5. **TanStack Query keys** — Todas las queries de tareas usan key `["tareas", ...]`. Invalida con `queryClient.invalidateQueries({ queryKey: ["tareas"] })` para refrescar todo.

6. **Sin bypass de admin** — `canSubmitDevTasks` y `canManageDevTasks` comprueban `user_tools`, no `role`. Admin sin tool asignada no ve la herramienta. Esto es correcto e intencional.

---

## Orden recomendado para continuar

```
1. Hacer commit de todo lo hecho (Fases A, B, C)
2. Leer App.tsx → agregar ruta /herramientas/tareas
3. Leer Sidebar.tsx → agregar sección "Mis herramientas"
4. Probar en browser con herramienta asignada
5. Opcional: limpiar tab gerencial (Fase 12)
6. npm run build → verificar 0 errores
```
