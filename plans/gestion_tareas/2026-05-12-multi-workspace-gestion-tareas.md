# Multi-Workspace para Gestión de Tareas

## Problema actual

Hoy, todos los usuarios con `tool_task_manage_dev` ven el mismo equipo `desarrollo_innovacion`.

```
Líder A (tool_task_manage_dev) → ve equipo "Desarrollo e Innovación"
Líder B (tool_task_manage_dev) → ve equipo "Desarrollo e Innovación"  ← mismo equipo
```

Esto impide que cada líder tenga su propio espacio de trabajo aislado.

---

## Requerimiento

Cada manager con `tool_task_manage_dev` debe tener su **propio workspace** con:

- Su propio equipo de trabajo
- Sus propios miembros
- Sus propias tareas
- Sus propios KPIs y gráficas
- Su propia configuración de listas

Un usuario 加入 a un workspace no ve los datos de otro workspace.

---

## Arquitectura propuesta

### Modelo actual (simplificado)

```python
# TaskTeam
class TaskTeam(SQLModel, table=True):
    scope: str = Field(index=True)  # "desarrollo_innovacion" — FIJO
    owner_user_id: Optional[int] = Field(default=None, index=True)

# TaskTeamMember
class TaskTeamMember(SQLModel, table=True):
    team_id: int = Field(index=True)
    user_id: int = Field(index=True)
```

### Modelo propuesto

```python
# TaskTeam
class TaskTeam(SQLModel, table=True):
    owner_user_id: int = Field(index=True, nullable=False)  # manager propietario
    name: str = Field(max_length=150, nullable=False)  # nombre del workspace
    is_active: bool = Field(default=True)

# TaskTeamMember
class TaskTeamMember(SQLModel, table=True):
    team_id: int = Field(index=True)
    user_id: int = Field(index=True)
    role: str = Field(default="member")  # "manager", "member"
```

### Cambios clave

| Antes | Después |
|-------|---------|
| `scope = "desarrollo_innovacion"` fijo | No hay scope fijo |
| Todos comparten un `TaskTeam` | Cada manager crea su propio `TaskTeam` |
| Un solo equipo hardcodeado | Equipos dinámicos por manager |

---

## Cambios en backend

### 1. Modificar `TaskTeam` model

- Eliminar columna `scope`
- Agregar `owner_user_id` como FK obligatoria
- Agregar `name` para nombre del workspace

### 2. Modificar `TaskTeamMember` model

- Agregar `role` (manager/member)

### 3. Modificar `task_team_service.py`

```python
SCOPE_DEV = "desarrollo_innovacion"  # eliminar

def get_or_create_manager_team(db: Session, owner_id: int) -> TaskTeam:
    """Obtiene o crea el equipo del manager."""

def get_manager_scope(db: Session, user_id: int) -> int:
    """Retorna el team_id del workspace del manager."""

def list_team_members(db: Session, manager_id: int) -> list:
    """Filtra por owner_user_id del manager."""

def get_team_tasks(db: Session, manager_id: int, filters) -> list:
    """Filtra tareas del workspace del manager."""
```

### 4. Modificar `herramientas_tareas.py`

- Eliminar `SCOPE_DEV`
- Todos los endpoints filtran por `get_manager_scope(current_user.id)`
- Crear equipo automáticamente al primer acceso

### 5. Migración de datos

```sql
-- Agregar columna temporal
ALTER TABLE task_teams ADD COLUMN owner_user_id INTEGER;

-- Asignar el equipo existente al admin (primer usuario con tool)
UPDATE task_teams SET owner_user_id = (SELECT user_id FROM user_tools WHERE tool_key = 'tool_task_manage_dev' LIMIT 1);

-- Agregar role a members
ALTER TABLE task_team_members ADD COLUMN role TEXT DEFAULT 'member';
```

---

## Cambios en frontend

### 1. `GestionTareasPage.tsx`

- No necesita cambios significativos — ya usa `canManage` para mostrar/hide features
- El `filters` y datos ya vendrán filtrados por workspace

### 2. `TaskLeftPanel.tsx`

- Ya funciona — usa `useTeamPersonSummaries(filters)` que filtrará por workspace

### 3. `CalendarSidebar.tsx` / `ScheduleSheet.tsx`

- Ya funciona — agenda eventos por fecha, no por workspace (podría filtrar después)

### 4. Considerar: nombre del workspace

Agregar input en `TeamConfigTab` para que el manager nombre su workspace:

```typescript
// TeamConfigTab.tsx
const [workspaceName, setWorkspaceName] = useState("Mi equipo")
```

---

## Tareas de implementación

- [ ] **Tarea 1:** Modificar modelo `TaskTeam` — quitar `scope`, agregar `owner_user_id` y `name`
- [ ] **Tarea 2:** Modificar modelo `TaskTeamMember` — agregar `role`
- [ ] **Tarea 3:** Actualizar `task_team_service.py` — `get_or_create_manager_team()`
- [ ] **Tarea 4:** Actualizar `task_dashboard_service.py` — filtrar por `owner_user_id`
- [ ] **Tarea 5:** Actualizar `work_task_service.py` — asociar tarea al workspace del manager
- [ ] **Tarea 6:** Actualizar router `herramientas_tareas.py` — eliminar `SCOPE_DEV`
- [ ] **Tarea 7:** Migración SQL para datos existentes
- [ ] **Tarea 8:** Verificar TypeScript y Docker build
- [ ] **Tarea 9:** Testing manual — crear workspace para otro manager

---

## Notas

1. **Compatibilidad:** Los usuarios existentes con la tool seguirán viendo su equipo (se migrará el equipo actual al primer admin).

2. **Admin global:** Un `admin` con role="admin" podría ver todos los workspaces? O cada admin es owner de su workspace? Decidir antes de implementar.

3. **UI de workspaces:** No se necesita selector de workspace si cada manager tiene su propio workspace. El nombre del workspace podría mostrarse en el header.

4. **Listas compartidas vs propias:** ¿Las listas de estados/etiquetas/plataformas son globales o por workspace? Sugerencia: globales para simplificar v1.

---

## Checklist de verificación

- [ ] Manager A crea equipo, agrega miembros → ve solo sus tareas
- [ ] Manager B (otro workspace) no ve tareas de Manager A
- [ ] Miembro 加入 a workspace de Manager A → solo ve tareas de ese workspace
- [ ] KPIs reflejan solo tareas del workspace
- [ ] Gráficas reflejan solo tareas del workspace
- [ ] Exportaciones funcionan por workspace
- [ ] Admin puede asignar tool y el nuevo manager tiene workspace vacío
- [ ] Docker build pasa