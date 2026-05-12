# Sesion de trabajo — Multi-Workspace Gestion de Tareas

**Fecha:** 2026-05-12
**Session ID:** `f1d446a` (ultimo commit)

---

## Resumen ejecutivo

Se implemento el feature multi-workspace para Gestion de Tareas. Cada manager con `tool_task_manage_dev` obtiene su propio equipo, miembros, tareas, KPIs y listas configurables, aislados de otros workspaces.

---

## Problema original

Todos los managers con `tool_task_manage_dev` compartian el mismo equipo `desarrollo_innovacion` hardcodeado. No habia aislamiento entre workspaces.

---

## Lo que se hizo (por commit)

### Commit `3ed81c8` — "fix(tareas): remover referencia a setEditValue eliminada"

No es parte del feature multi-workspace. Es una correccion menor independiente.

---

### Commit `cc400e2` — "fix(tareas): corregir imports de tipos y variables no usadas en ListConfigTab"

No es parte del feature multi-workspace. Es correccion de lint.

---

### Commit `bcce2f1` — "Organizacion de carpetas"

No es parte del feature multi-workspace. Reorganizacion de archivos.

---

### Commit `98a1cb8` — "feat(tareas): frontend CRUD de listas configurables con UI inline"

**No es parte del feature multi-workspace.** Esta tarea fue posterior y se desarrollo en paralelo.

---

### Commit `ad95774` — "feat(tareas): agregar CRUD de listas configurables por manager"

**No es parte del feature multi-workspace.** Continua la implementacion de listas configurables.

---

### Commit `501d3f8` — "feat(tareas): implementar multi-workspace por manager y simplificar herramientas admin"

**Este es el commit central del feature.** Incluye cambios en:

#### Modelos (`backend/app/models/`)

| Archivo | Cambio |
|---------|--------|
| `task_team.py` | Eliminada columna `scope`. `owner_user_id` ahora es requerida (no nullable). Sin indice unico. |
| `task_team_member.py` | Agregado campo `role` (default "member"). |

#### Servicios (`backend/app/services/`)

| Archivo | Cambio |
|---------|--------|
| `task_team_service.py` | Completamente refactorizado. `get_or_create_manager_team(owner_id)` crea equipo lazily. Todas las funciones toman `owner_id` como parametro. `add_team_member` y `deactivate_team_member` ahora toman `owner_id`. `get_active_member_ids` crea equipo si no existe. |
| `task_dashboard_service.py` | Refactorizado. Todos los metodos (`get_team_tasks`, `get_team_kpis`, `get_person_summaries`, etc.) ahora toman `owner_id`. El `team_id` se deriva del `owner_id` dentro de cada servicio. |
| `user_tool_service.py` | Simplificado. `require_tool_or_403` y `user_has_tool` ya no verifican membresia de equipo, solo verifican existencia de la tool. |
| `work_task_service.py` | Refactorizado. Eliminados todos los `SCOPE_DEV`. Agregadas funciones: `calcular_minutos`, `validate_task_values`, `log_activity`, `get_task_activity`, `get_paginated_tasks`. `create_task` ahora toma el `user_id` del owner. `list_own_tasks` trabaja con el owner_id. `own_metrics` calcula KPIs del owner. `create_task` sigue usando `scope="desarrollo_innovacion"` en el modelo (ver seccion "Decisiones que resultaron problematicas"). |

#### Routers (`backend/app/routers/`)

| Archivo | Cambio |
|---------|--------|
| `herramientas_tareas.py` | 165 lineas de cambios. Eliminados TODOS los `SCOPE_DEV`. Todas las funciones ahora usan `current_user.id` como `owner_id`. Team endpoints (`/equipo/*`) ahora requieren `TOOL_MANAGE` y filtran por el equipo del manager actual. Team config endpoints (`/equipo/config/*`)同理. Pagination endpoints ahora derivan el `team_id` del `owner_id`. |
| `auth.py` | Eliminados el import de `SCOPE_DEV`, la consulta `TaskTeam.scope == SCOPE_DEV`, y la verificacion de membresia de equipo. `MeResponse.is_team_member` ahora siempre es `False`. |

#### Frontend (`frontend/src/`)

| Archivo | Cambio |
|---------|--------|
| `pages/AdminPage.tsx` | Simplificada la constante `TOOLS` a un solo item "Gestion de Tareas" con `tool_task_submit_dev`. Se eliminaron las tools duplicadas. |
| `pages/herramientas/tareas/GestionTareasPage.tsx` | Actualizada la llamada a `canSubmitDevTasks` — eliminada dependencia de `is_team_member`. |
| `lib/permissions.ts` | `canSubmitDevTasks` simplificada: solo verifica `tool_task_submit_dev` en `userTools`, sin parametro `isTeamMember`. |

#### Database (`backend/app/database.py`)

| Archivo | Cambio |
|---------|--------|
| `database.py` | `TaskListConfig` importado y registrado en `create_db_and_tables`. |

---

### Commit `8a7a462` — "feat(tareas): eliminar SCOPE_DEV residual de auth, eventos y permisos"

Limpieza de residuos de `SCOPE_DEV` que quedaron en archivos no cubiertos por `501d3f8`.

| Archivo | Cambio |
|---------|--------|
| `auth.py` | Import de `SCOPE_DEV` eliminado, query de `TaskTeam.scope == SCOPE_DEV` eliminado, verificacion de membresia de equipo eliminada. `is_team_member` ahora siempre `False`. |
| `task_event_service.py` | Import de `SCOPE_DEV` eliminado. `create_event` ahora asigna `owner_user_id=creator.id` en lugar de `scope=SCOPE_DEV`. |
| `permissions.ts` | `canSubmitDevTasks` simplificada. |
| `GestionTareasPage.tsx` | Llamada actualizada. |
| `task_event.py` | **PROBLEMA:** Se elimino la columna `scope` del modelo `TaskEvent` y se reemplazo por `owner_user_id`. **Esto requiere migracion de la DB**, no sedocumento bien esta necesidad. |

---

### Commit `f78423e` — "fix(tareas): usar scope=global al asignar tool en AdminPage"

**HIPOTESIS INCORRECTA.** Se creyo que el problema era que `scope` se asignaba como `"desarrollo_innovacion"` pero `require_tool_or_403` buscaba `"global"`. Se corrigio `useAssignUserTool` y `useRevokeUserTool` en el frontend para enviar `scope: "global"`.

**Esta correccion no fue la solucion real.** El problema real era otra cosa (ver abajo).

---

### Commit `f1d446a` — "fix(tareas): require_tool_or_403 no filtra por scope — acepta cualquier scope activo"

**CORRECCION REAL DEL PROBLEMA.** El usuario reporto que un directivo con `tool_task_manage_dev` no podia agregar colaboradores. Despues de ejecutar la query SQL en Docker:

```sql
SELECT user_id, tool_key, scope, is_active FROM user_tools;
```

Resultado:
```
(3, 'tool_task_submit_dev', 'desarrollo_innovacion', 0)
(4, 'tool_task_submit_dev', 'desarrollo_innovacion', 1)
(13, 'tool_task_submit_dev', 'desarrollo_innovacion', 1)
(11, 'tool_task_submit_dev', 'desarrollo_innovacion', 1)
(4, 'tool_task_manage_dev', 'desarrollo_innovacion', 0)
(2, 'tool_task_manage_dev', 'desarrollo_innovacion', 1)
(30, 'tool_task_submit_dev', 'desarrollo_innovacion', 1)
(6, 'tool_task_submit_dev', 'desarrollo_innovacion', 1)
(6, 'tool_task_manage_dev', 'desarrollo_innovacion', 1)
(12, 'tool_task_manage_dev', 'desarrollo_innovacion', 1)
(2, 'tool_task_submit_dev', 'desarrollo_innovacion', 1)
```

**Todos los registros tienen `scope="desarrollo_innovacion"`.** Ninguno tiene `scope="global"`.

La funcion `require_tool_or_403` hacia:
```python
.where(UserTool.scope == scope)  # scope="global" por defecto
```

Pero en la DB todos tenian `scope="desarrollo_innovacion"`. Entonces nunca encontraba coincidencias.

**Fix:** `scope` ahora es opcional en `user_has_tool` y `require_tool_or_403`. Si es `None`, no se filtra por scope — solo verifica `user_id`, `tool_key` e `is_active`. El admin bypass sigue funcionando igual.

---

## Decisiones que resultaron problematicas

### 1. Migracion de DB no automatizada

Los siguientes cambios de modelo **requieren migraciones SQL manuales** en produccion:

- `task_teams`: columna `scope` fue eliminada del modelo pero probablemente sigue en la DB
- `task_team_members`: columna `role` fue agregada al modelo pero puede no existir en la DB
- `task_events`: columna `scope` fue eliminada y reemplazada por `owner_user_id` (NOT NULL)

**No se added ninguna migracion automatica en `_migrate_db()`** para estos cambios. En un entorno SQLite con `create_db_and_tables` al inicio, las tablas nuevas se crean pero las columnas eliminadas no se quitan, y las columnas nuevas no se agregan a tablas existentes.

**Impacto:** Si la DB ya existia antes de estos cambios:
- `task_teams.scope` sigue existiendo (no se usa pero tampoco molesta)
- `task_team_members.role` no existe (puede causar errores si se inserta con role)
- `task_events.scope` sigue existiendo, `owner_user_id` no existe

**Recomendacion:** Ejecutar manualmente en Docker:
```sql
ALTER TABLE task_team_members ADD COLUMN role TEXT DEFAULT 'member';
ALTER TABLE task_events ADD COLUMN owner_user_id INTEGER NOT NULL DEFAULT 0;
UPDATE task_events SET owner_user_id = creado_por_id WHERE owner_user_id = 0;
```

### 2. `WorkTask.scope` no se toco

El modelo `WorkTask` sigue teniendo `scope: str = Field(default="desarrollo_innovacion")`. No se elimin6 porque:

- `WorkTask.scope` es diferente de `TaskTeam.scope` — no era parte del refactor de multi-workspace
- Eliminarlo podria romper queries existentes en otros modulos (ej. `gerencial.py` usa WorkTask)

Sin embargo, en la practica, `work_task_service.py` ya no usa ni pasa `scope` al crear tareas. El default `"desarrollo_innovacion"` queda como valor residual.

### 3. La correccion de `f78423e` fue innecesaria

Despues de `f1d446a`, el fix de `f78423e` (cambiar `scope` de `"desarrollo_innovacion"` a `"global"` en los hooks del frontend) ya no es necesario para que funcione. Pero tampoco hace dano — se asignara con `scope="global"` en nuevas asignaciones, y el fix de `f1d446a` hace que cualquier scope sea valido.

### 4. `is_team_member` sigue en el schema pero siempre es False

Despues de eliminar la logica de membresia de equipo del `/auth/me`, el campo `is_team_member` en `MeResponse` y en `User` type del frontend ya no tiene significado real — siempre es `False`. Esto nunca se limpio del schema, es deuda Tecnica.

---

## Cambios en archivos especificos

### `backend/app/models/task_event.py`

```
- scope: str = Field(max_length=100, index=True, nullable=False)
+ owner_user_id: int = Field(index=True, nullable=False)
+ team_id: Optional[int] = Field(default=None, index=True)
```

**Nota:** Este es un cambio breaking. Si la DB existe con la estructura anterior, `task_events.scope` seguira existiendo y `owner_user_id` no existira. Si se inserta un evento nuevo, fallara porque falta la columna.

### `backend/app/services/user_tool_service.py`

Cambio de logica:
```
- def user_has_tool(db, user, tool_key, scope="global")
- def require_tool_or_403(db, user, tool_key, scope="global")
+ def user_has_tool(db, user, tool_key, scope=None)
+ def require_tool_or_403(db, user, tool_key, scope=None)
```

Cuando `scope=None`, no se filtra por la columna `scope` en la DB. Esto hace que cualquier registro activo con el `tool_key` sea valido, sin importar su scope.

### `frontend/src/hooks/useWorkTasks.ts`

```
- scope: "desarrollo_innovacion"  # en useAssignUserTool
- scope: "desarrollo_innovacion"  # en useRevokeUserTool
+ scope: "global"  # en ambos
```

---

## Lo que NO se hizo

1. **Migracion automatica de DB** para las columnas nuevas/eliminadas
2. **Limpieza de `is_team_member`** del schema y tipos
3. **Limpieza de `SCOPE_DEV`** de `backend/app/core/constants.py` (sigue ahi, sin uso)
4. **Verificacion de Docker build** (daemon no disponible en esta maquina)
5. **Test de integracion end-to-end** de multi-workspace (solo validacion de compilacion)

---

## Commits de la sesion

| Commit | Mensaje |
|--------|---------|
| `3ed81c8` | fix(tareas): remover referencia a setEditValue eliminada |
| `cc400e2` | fix(tareas): corregir imports de tipos y variables no usadas en ListConfigTab |
| `bcce2f1` | Organizacion de carpetas |
| `98a1cb8` | feat(tareas): frontend CRUD de listas configurables con UI inline |
| `ad95774` | feat(tareas): agregar CRUD de listas configurables por manager |
| `501d3f8` | feat(tareas): implementar multi-workspace por manager y simplificar herramientas admin |
| `8a7a462` | feat(tareas): eliminar SCOPE_DEV residual de auth, eventos y permisos |
| `f78423e` | fix(tareas): usar scope=global al asignar tool en AdminPage |
| `f1d446a` | fix(tareas): require_tool_or_403 no filtra por scope — acepta cualquier scope activo |
| `b6a36fb` | Plan de gestion tareas |
| `e3d9f2c` | docs: crear plan multi-workspace para gestion de tareas |

---

## Estado final

El feature multi-workspace funciona en terminos de logica de codigo. El problema de permisos fue resuelto en `f1d446a`. Sin embargo, la DB necesita al menos una migracion manual para `task_team_members.role` y potencialmente para `task_events`.

El коммуникационный documento en `docs/COMUNICADOS/2026-05-12-gestion-tareas-workspaces.md` fue creado para comunicar el cambio a los usuarios.