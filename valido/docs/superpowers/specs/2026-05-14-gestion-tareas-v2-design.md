# Gestión de Tareas v2 — Diseño

**Fecha:** 2026-05-14
**Estado:** Aprobado — listo para plan de implementación
**Módulo:** `herramientas/tareas`
**Sesión visual:** `.superpowers/brainstorm/29945-1778765955/`

---

## Contexto

El módulo de Gestión de Tareas está implementado pero con defectos que impiden el flujo completo:

1. `WorkTask.team_id` siempre `NULL` → tareas de un usuario aparecen en todos los workspaces donde es miembro
2. `role='admin'` da bypass a todos los workspaces → incorrecto, directivos son admin Y gestores
3. No existe campo `prioridad` en tareas
4. No existe co-gestor — solo gestor primario y miembro
5. Tareas huérfanas (`team_id=NULL`) sin flujo claro
6. No hay UI para que admin borre tareas específicas

---

## Decisiones aprobadas

### D1 — Modelo de permisos ✅

El `role='admin'` de la intranet **NO otorga acceso especial** al módulo. Acceso 100% basado en `UserTool`:

| Tool | Rol en módulo |
|------|--------------|
| Sin tool | Sin acceso |
| `tool_task_submit_dev` | Miembro — registra y agenda sus propias tareas |
| `tool_task_manage_dev` | Gestor — dashboard completo, gestiona equipo |

Un admin que también es gestor ve **únicamente su propio equipo**.

**Cambio en código:**
```python
# ANTES (incorrecto)
def _owner_id(current_user: User) -> int | None:
    if getattr(current_user, "role", None) == "admin":
        return None  # bypass — ELIMINAR
    return current_user.id

# DESPUÉS
def _owner_id(current_user: User) -> int | None:
    return current_user.id
```

---

### D2 — Jerarquía de roles ✅

Tres niveles dentro del módulo:

#### Gestor (Primario)
- **Activación:** Admin asigna `tool_task_manage_dev`
- **Capacidades:** Dashboard completo · Agrega/remueve miembros · Promueve a co-gestor · Degrada co-gestor · Configura listas · Registra sus tareas
- **Restricción:** Solo el Gestor primario puede promover/degradar (evita escalada de privilegios)

#### Co-Gestor
- **Activación:** Gestor promueve a un miembro existente → `TaskTeamMember.role = 'co_gestor'`
- **Capacidades:** Dashboard completo del equipo · Agrega/remueve miembros · Registra sus tareas
- **Restricciones:** NO puede promover a otros co-gestores · NO crea equipo propio · Opera sobre el equipo del gestor que lo promovió

#### Miembro
- **Activación:** Gestor o Co-gestor lo agrega al equipo → auto-recibe `tool_task_submit_dev`
- **Capacidades:** Ve y gestiona solo sus propias tareas · Registra tareas · Agenda tareas · Cambia estado

#### Flujo de activación
```
Admin ──tool_task_manage_dev──► Gestor (crea equipo propio)
Gestor/Co-gestor ──agrega usuario──► Miembro (auto: tool_task_submit_dev, role='member')
Gestor ──promueve──► Co-gestor (role='co_gestor')
Gestor ──degrada──► Miembro (role='member')
```

---

### D3 — Aislamiento de tareas por equipo ✅

**Problema raíz:** `WorkTask.team_id = NULL` siempre → sin aislamiento real.

**Solución:**
- `create_task` resuelve y asigna `team_id` al crear
- `get_team_tasks` filtra por `team_id = equipo_del_gestor.id`

**Selector adaptativo en formulario:**
- Usuario en **1 equipo** → `team_id` se asigna automáticamente, sin campo visible
- Usuario en **2+ equipos** → aparece campo "Equipo" obligatorio en el formulario antes de guardar

---

### D4 — Prioridad de tarea ✅

- Campo nuevo: `prioridad` en `WorkTask`
- Valores: `'alta'` · `'media'` · `'baja'`
- Default: `'media'`
- Migración: `ALTER TABLE work_tasks ADD COLUMN prioridad VARCHAR(10) NOT NULL DEFAULT 'media'`
- Aparece en el formulario de registro y en la vista de tareas (filtrable)

---

### D5 — Tareas huérfanas y borrado ✅

**Tareas con `team_id=NULL` (existentes):**
- Permanecen "dormidas" — no aparecen en ningún workspace
- No se borran automáticamente

**Al eliminar un usuario (desde Roles y Usuarios):**
- Admin elige: **Borrar todas sus tareas** o **Dejar dormidas**
- Las tareas dormidas quedan en DB sin equipo asignado

**Borrado de tareas específicas:**
- Ubicación: Panel "Roles y Usuarios" → detalle de usuario → pestaña "Tareas"
- Admin puede ver todas las tareas de ese usuario y borrar individualmente
- Confirma antes de borrar (modal)

---

## Archivos a modificar

| Área | Archivo | Cambio principal |
|------|---------|-----------------|
| Backend | `routers/herramientas_tareas.py` | Eliminar bypass admin en `_owner_id`, endpoints promover/degradar co-gestor, endpoint borrado admin |
| Backend | `services/task_team_service.py` | `promote_to_cogestor`, `demote_to_member` |
| Backend | `services/task_dashboard_service.py` | Filtrar por `team_id`, resolver contexto co-gestor |
| Backend | `services/work_task_service.py` | Asignar `team_id` en `create_task`, endpoint borrado admin |
| Backend | `models/work_task.py` | Campo `prioridad` |
| Backend | `schemas/work_task.py` | Campo `prioridad` y `team_id` opcional en `WorkTaskCreate` |
| Backend | `main.py` | Migración `prioridad` |
| Frontend | `TaskForm.tsx` | Campo prioridad + selector equipo adaptativo |
| Frontend | `GestionTareasPage.tsx` | Lógica co-gestor (misma vista que gestor) |
| Frontend | `permissions.ts` | `canCoManage(userTools, teamMemberships)` |
| Frontend | `useWorkTasks.ts` | Hooks para promover/degradar, borrado admin, mis equipos |
| Frontend | Admin UI (Roles y Usuarios) | Pestaña "Tareas" en detalle de usuario |

---

## Notas de arquitectura

1. **`_resolve_manage_context(db, user)`** — nueva función en el router que devuelve `(owner_id, team)` para gestores Y co-gestores. Centraliza la lógica: "¿sobre qué equipo opera esta petición?"

2. **Sin modo "ver todo"** — ningún rol tiene acceso a todos los workspaces simultáneamente. Futuro: se puede agregar `tool_task_superadmin` sin romper lo actual.

3. **Co-gestor no tiene tool extra** — el permiso viene del `role` en `TaskTeamMember`. El backend verifica: ¿tiene `tool_task_manage_dev`? O ¿es `co_gestor` en algún equipo activo?

4. **Backward compatible** — tareas existentes con `team_id=NULL` no se tocan. Migración solo agrega `prioridad`.

5. **Docker-ready** — migraciones idempotentes via `try/except` en `_migrate_db()`.
