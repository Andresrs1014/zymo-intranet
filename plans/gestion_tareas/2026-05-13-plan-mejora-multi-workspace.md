# Plan de Mejora — Multi-Workspace Gestion de Tareas

**Fecha:** 2026-05-13
**Estado del feature:** Implementado pero con defectos que impiden el flujo completo
**Documentos base:** `plans/gestion_tareas/2026-05-12-multi-workspace-gestion-tareas.md`, `plans/gestion_tareas/2026-05-12-sesion-trabajo-multi-workspace.md`

---

## Estado actual

El feature multi-workspace esta **implementado logicamente** pero con defectos que impiden el flujo completo de uso. El codigo compila, los permisos funcionan, pero la experiencia de uso es incompleta.

---

## Problemas identificados (priorizados)

### P1 — Bug: `get_person_summaries` no muestra miembros del equipo sin tareas

**Archivo:** `backend/app/services/task_dashboard_service.py` lineas 141-144

**Sintoma:** El sidebar izquierdo muestra "Sin miembros" aunque el manager ya haya agregado personas a su equipo. Esto pasa porque `_build_person_summary` se llama solo para usuarios que tienen tareas en `tasks_by_user`. Si un miembro fue agregado pero no ha registrado ninguna tarea todavia, no aparece.

**Impacto:** El manager no puede ver ni gestionar a los miembros de su equipo hasta que ellos registren una tarea. Esto rompe la experiencia de uso.

**Fix requerido:** `get_person_summaries` debe retornar todos los miembros activos del equipo, con `tareas_totales=0` si no tienen tareas.

---

### P2 — Migracion DB pendiente: columna `task_team_members.role` puede no existir

**Archivo de modelo:** `backend/app/models/task_team_member.py`

**Sintoma:** Si la DB existia antes de este feature, la columna `role` no fue agregada automaticamente. Al intentar insertar un nuevo miembro en `task_team_members`, puede fallar o grabar con valor NULL/default incorrecto dependiendo del motor de DB.

**Fix requerido:** Agregar migracion automatica en `_migrate_db()` en `main.py` que ejecute:
```sql
ALTER TABLE task_team_members ADD COLUMN role TEXT DEFAULT 'member';
```

Tambien deberia verificar y migrar:
```sql
ALTER TABLE task_events ADD COLUMN owner_user_id INTEGER NOT NULL DEFAULT (creado_por_id);
-- luego recalcular para que coincida con la logica real
```

---

### P3 — Design gap: al agregar miembro NO se le asigna `tool_task_submit_dev`

**Sintoma:** El manager agrega un miembro a su equipo, pero el miembro no puede registrar tareas porque no tiene `tool_task_submit_dev`. El manager no tiene forma de asignar esa tool.

**Flujo roto:** Manager agrega persona X a su equipo → persona X inicia sesion → ve que no tiene acceso a Gestion de Tareas → debe pedir al admin que le asigne `tool_task_submit_dev` manualmente.

**Fix requerido (dos opciones):**

- **Opcion A (recomendada, automatica):** Cuando el manager agrega un miembro via `add_team_member_endpoint`, automaticamente se le crea un `UserTool(tool_key='tool_task_submit_dev', is_active=True)` en la DB.

- **Opcion B (manual):** El admin sigue asignando desde AdminPage.

**Impacto de Opcion A:** Cada vez que un manager agrega un miembro, ese miembro tiene acceso inmediato a registrar tareas. El admin no necesita intervencion.

---

### P4 — Bug potencial: `task_events.owner_user_id` no existe en DB

**Archivo de modelo:** `backend/app/models/task_event.py`

**Sintoma:** El modelo cambio de `scope` a `owner_user_id`, pero no hay migracion. En una DB existente, `task_events.scope` sigue ahi y `task_events.owner_user_id` no existe. Cualquier operacion sobre `TaskEvent` fallara.

**Fix requerido:** Migracion SQL en `_migrate_db()`:
```sql
ALTER TABLE task_events ADD COLUMN owner_user_id INTEGER NOT NULL;
UPDATE task_events SET owner_user_id = creado_por_id;
ALTER TABLE task_events DROP COLUMN scope;  -- si se quiere limpiar
```

---

### P5 — Design: nombre del workspace hardcodeado

**Archivo:** `backend/app/services/task_team_service.py` linea 22

**Sintoma:** `get_or_create_manager_team` crea equipos con `name="Mi equipo"` siempre. El manager no puede renombrar su workspace.

**Impacto:** Bajo para v1, pero limite para uso real.

**Fix opcional para v1:** Mostrar `user.full_name` del owner como nombre del workspace en el header de `GestionTareasPage`. No requiere cambio en DB.

---

### P6 — Deuda tecnica: `is_team_member` sigue en schema y nunca se usa

**Archivos:** `backend/app/routers/auth.py`, `frontend/src/types/auth.ts`, `frontend/src/lib/permissions.ts`

**Sintoma:** Campo `is_team_member` en `MeResponse` y en `User` type. Siempre es `False` ahora. El frontend no lo usa activamente pero sigue en los tipos.

**Impacto:** Confusion futura para quien mantenga el codigo.

**Fix:** Remover `is_team_member` de `MeResponse`, `User` type, y `auth.ts`. No es critico para v1.

---

## Plan de implementacion (Tareas priorizadas)

### Tarea 1: Fix migraciones automaticas en `_migrate_db()` (P2, P4)

**Archivos:** `backend/app/main.py`

Agregar en `_migrate_db()`:

```python
# task_team_members.role
try:
    conn.execute(text("ALTER TABLE task_team_members ADD COLUMN role TEXT DEFAULT 'member'"))
    conn.commit()
    print("[migrate] Columna task_team_members.role agregada.")
except Exception:
    pass

# task_events: agregar owner_user_id y migrar datos
try:
    conn.execute(text("ALTER TABLE task_events ADD COLUMN owner_user_id INTEGER NOT NULL DEFAULT (creado_por_id)"))
    conn.commit()
    print("[migrate] Columna task_events.owner_user_id agregada.")
except Exception:
    pass
```

**Verificacion:** Despues de reiniciar el backend, ejecutar en Docker:
```sql
PRAGMA table_info(task_team_members);
PRAGMA table_info(task_events);
```
Debe mostrar `role` en `task_team_members` y `owner_user_id` en `task_events`.

---

### Tarea 2: Fix `get_person_summaries` para mostrar todos los miembros (P1)

**Archivo:** `backend/app/services/task_dashboard_service.py`

Cambiar la logica del loop para que **siempre** itere sobre `active_ids` del equipo, no solo sobre los que tienen tareas:

```python
def get_person_summaries(db: Session, filters: TaskFilters, owner_id: int | None) -> list[PersonTaskSummary]:
    tasks = get_team_tasks(db, filters, owner_id)

    tasks_by_user: dict[int, list[WorkTask]] = defaultdict(list)
    for task in tasks:
        tasks_by_user[task.subido_por_id].append(task)

    if owner_id is not None:
        active_ids = _get_team_member_ids(db, owner_id)
    else:
        active_ids = list(tasks_by_user.keys())

    summaries: list[PersonTaskSummary] = []
    for uid in active_ids:
        user = db.get(User, uid)
        if user:
            summaries.append(_build_person_summary(user, tasks_by_user.get(uid, [])))
    return summaries
```

**Cambio:** `tasks_by_user[uid]` → `tasks_by_user.get(uid, [])` — si el miembro no tiene tareas, retorna lista vacia en lugar de KeyError.

Tambien verificar que `get_users_without_today_entry` tenga la misma correccion.

**Verificacion:** Agregar un miembro sin tareas, verificar que aparece en el sidebar.

---

### Tarea 3: Auto-asignar `tool_task_submit_dev` al agregar miembro (P3)

**Archivos:**
- `backend/app/routers/herramientas_tareas.py` (endpoint)
- `backend/app/services/user_tool_service.py` (helper)

Agregar logica en `add_team_member_endpoint`:

```python
from app.services.user_tool_service import ensure_user_has_tool

# En add_team_member_endpoint, luego de crear el miembro:
ensure_user_has_tool(db, payload.user_id, "tool_task_submit_dev")
```

Nueva funcion en `user_tool_service.py`:

```python
def ensure_user_has_tool(db: Session, user_id: int, tool_key: str, scope: str = "global") -> None:
    """Asegura que un usuario tenga la tool activa. La crea si no existe."""
    existing = db.exec(
        select(UserTool).where(
            UserTool.user_id == user_id,
            UserTool.tool_key == tool_key,
        )
    ).first()

    from datetime import datetime, timezone
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.updated_at = datetime.now(timezone.utc)
            existing.scope = scope
            db.add(existing)
    else:
        db.add(UserTool(
            user_id=user_id,
            tool_key=tool_key,
            scope=scope,
            is_active=True,
        ))
    db.commit()
```

**Verificacion:** Agregar un miembro desde TeamConfigTab, iniciar sesion con ese usuario, verificar que puede registrar tareas en `TaskSubmitView`.

---

### Tarea 4: Mostrar nombre del owner en el header (P5)

**Archivo:** `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

Cambiar texto hardcodeado "Equipo de Desarrollo e Innovacion" por el nombre real del owner:

Ya se tiene acceso a `user.full_name` via `useAuthStore`. Mostrarlo en el header.

```typescript
const user = useAuthStore((s) => s.user)
// ...
<span className="text-base font-semibold">
  {canManage ? `Equipo de ${user?.full_name?.split(" ")[0] ?? "mi equipo"}` : "Mis tareas"}
</span>
```

Tambien considerar agregar un campo `name` al `TaskTeam` para que el manager pueda renombrarlo desde `TeamConfigTab`. Esto requiere endpoint adicional (PUT `/equipo/config/nombre`).

---

### Tarea 5: Limpiar `is_team_member` residual (P6)

**Archivos:**
- `backend/app/routers/auth.py` — remover de `MeResponse` y `_to_me`
- `frontend/src/types/auth.ts` — remover del interface `User`
- `frontend/src/lib/permissions.ts` — ya esta limpio, verificar

**Verificacion:** TypeScript compila sin errores.

---

## Dependencias entre tareas

```
Tarea 1 (migraciones)
  └─> Necesario para que Tarea 3 funcione correctamente (FK y columnas existen)

Tarea 2 (fix personas)
  └─> Independiente

Tarea 3 (auto-asignar tool)
  └─> Depende de Tarea 1

Tarea 4 (nombre workspace)
  └─> Independiente

Tarea 5 (cleanup deuda)
  └─> Independiente
```

---

## Checklist de verificacion post-implementacion

- [ ] Manager A agrega miembros a su equipo → aparecen en sidebar aunque no tengan tareas
- [ ] Manager B (otro workspace) no ve tareas ni miembros de Manager A
- [ ] Miembro agregado recibe `tool_task_submit_dev` automaticamente al ser agregado
- [ ] Miembro inicia sesion y puede registrar tareas sin pedir ayuda al admin
- [ ] Migraciones se ejecutan automaticamente al reiniciar backend (sin SQL manual)
- [ ] `task_events` funciona correctamente con `owner_user_id`
- [ ] KPIs y graficas reflejan solo tareas del workspace
- [ ] Admin sigue viendo todo sin restricciones (admin bypass funciona)
- [ ] TypeScript compila sin errores
- [ ] Docker build pasa

---

## Notas de arquitectura

1. **Separacion de capas respetada:** Routers → Services → Models. No hay logica de negocio en componentes UI.

2. **Seguridad:** Los permisos se verifican en cada endpoint con `require_tool_or_403`. El admin bypass sigue funcionando en `user_tool_service.py`. No hay hardcoded secrets.

3. **Produccion primero:** Todos los cambios son compatibles con SQLite y Docker. Las migraciones son idempotentes (usa `try/except`).

4. **No romper flujos existentes:** El fix de `get_person_summaries` es backward compatible. `tasks_by_user.get(uid, [])` es un comportamiento nuevo correcto, no un cambio ruptura.

5. **Migraciones ligeras:** Siguen el patron existente en `_migrate_db()` con `try/except pass` para ser idempotentes.

---

## Archivos a modificar

| Tarea | Archivos |
|-------|---------|
| T1 | `backend/app/main.py` |
| T2 | `backend/app/services/task_dashboard_service.py` |
| T3 | `backend/app/routers/herramientas_tareas.py`, `backend/app/services/user_tool_service.py` |
| T4 | `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` |
| T5 | `backend/app/routers/auth.py`, `frontend/src/types/auth.ts` |