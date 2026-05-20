# Tareas — Mejoras de Lógica (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 business-logic gaps in the task module: assign button failure, activity log attribution, assigned-task editing by recipient, attachment security, co-gestor multi-team, and Discord-style workspace switcher.

**Architecture:** Each fix is self-contained. Tasks 1–4 are quick surgical fixes. Tasks 5–6 are a coupled pair (co-gestor backend then workspace switcher frontend) that must run in order.

**Tech Stack:** FastAPI + SQLModel (SQLite), React + React Query v5, TypeScript strict.

---

## File Map

| File | Change |
|------|--------|
| `backend/app/services/task_team_service.py` | Fix `get_manager_team_members` → replace with all-active-users for managers; add `get_all_comanaged_owner_ids` |
| `backend/app/routers/herramientas_tareas.py` | Fix `/equipo/companeros` for managers; add task-level access check in `serve_attachment`; fix `/mis-tareas` team_id filter |
| `backend/app/services/work_task_service.py` | Fix line 317 activity log attribution; fix `update_own_task` to allow asignado_a_id; fix `list_own_tasks` to include assigned tasks |
| `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx` | Remove team selector; use active team from context |
| `frontend/src/components/herramientas/tareas/TaskForm.tsx` | Remove team selector; use active team from context |
| `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` | Add workspace switcher state; pass activeTeamId to children |
| `frontend/src/hooks/useWorkTasks.ts` | Pass `team_id` filter to `useMyTasks`; update `useUpdateWorkTask` to accept assigned tasks |

---

## Task 1: Fix "Asignar tarea" button — root cause + proper fix

**Root cause:** `GET /equipo/companeros` for managers calls `get_manager_team_members(db, current_user.id)`, which returns `[]` if the manager's team has no members yet. The button is then disabled with no clear explanation. The real fix: managers should be able to assign to **any active user**, not just current team members.

**Files:**
- Modify: `backend/app/services/task_team_service.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Step 1: Read current state of both files**

```bash
# Confirm the function signatures before editing
grep -n "get_manager_team_members\|get_equipo_companeros\|is_manager" \
  backend/app/services/task_team_service.py \
  backend/app/routers/herramientas_tareas.py
```

- [ ] **Step 2: Replace `get_manager_team_members` with `get_all_active_users_for_manager`**

In `backend/app/services/task_team_service.py`, replace the function:

```python
def get_all_active_users_for_manager(db: Session, exclude_user_id: int) -> list:
    """Retorna todos los usuarios activos excepto el gestor mismo.
    Los gestores pueden asignar tareas a cualquier usuario activo.
    """
    from app.models.user import User as UserModel
    from app.schemas.task_team import TaskTeamMemberRead

    users = db.exec(
        select(UserModel)
        .where(UserModel.is_active == True)  # noqa: E712
        .where(UserModel.id != exclude_user_id)
    ).all()

    return [
        TaskTeamMemberRead(
            id=0,
            team_id=0,
            user_id=u.id,
            user_email=u.email,
            user_full_name=u.full_name,
            role="member",
            is_active=True,
            created_at=None,
        )
        for u in users
        if u.id is not None
    ]
```

- [ ] **Step 3: Update the endpoint in `herramientas_tareas.py`**

Locate `get_equipo_companeros` (around line 224). Replace the body:

```python
@router.get("/equipo/companeros", response_model=list[TaskTeamMemberRead])
def get_equipo_companeros(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskTeamMemberRead]:
    """Retorna los compañeros/miembros de equipo para asignar tareas.
    - Colaboradores (TOOL_SUBMIT): devuelve compañeros de sus equipos activos.
    - Gestores (TOOL_MANAGE): devuelve todos los usuarios activos (pueden asignar a cualquiera).
    """
    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_submit = user_has_tool(db, current_user, TOOL_SUBMIT)
    is_admin = getattr(current_user, "role", None) == "admin"

    if not (is_manager or is_submit or is_admin):
        raise HTTPException(status_code=403, detail="Acceso denegado.")

    from app.services.task_team_service import get_companeros, get_all_active_users_for_manager

    if is_manager or is_admin:
        return get_all_active_users_for_manager(db, exclude_user_id=current_user.id)
    return get_companeros(db, current_user.id)
```

- [ ] **Step 4: Check that `TaskTeamMemberRead` has `created_at: datetime | None`**

```bash
grep -n "created_at" backend/app/schemas/task_team.py
```

If `created_at` is not optional, update the schema:
```python
created_at: datetime | None = None
```

- [ ] **Step 5: Start the dev server and verify manually**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Open browser → login as manager → Herramientas → click "Asignar tarea" → confirm dropdown shows all active users (not empty).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/task_team_service.py backend/app/routers/herramientas_tareas.py backend/app/schemas/task_team.py
git commit -m "fix(tareas): gestores pueden asignar a cualquier usuario activo"
```

---

## Task 2: Fix activity log attribution

**Problem:** `work_task_service.py` line 317 logs `user_nombre=task.subido_por_nombre` (the original creator's name) instead of the actual modifier's name.

**Files:**
- Modify: `backend/app/services/work_task_service.py`

- [ ] **Step 1: Locate and fix the bug**

In `update_own_task` around line 312-320:

```python
    if "estado" in update_data and update_data["estado"] != estado_anterior:
        log_activity(
            db,
            task_id=task.id,
            user_id=user.id,
            user_nombre=user.full_name or user.email,  # ← was: task.subido_por_nombre
            accion="cambio_estado",
            detalle=f"De {estado_anterior} a {update_data['estado']}",
        )
        db.commit()
```

Also check `update_team_task` in the same file for the same bug:

```bash
grep -n "user_nombre=task\." backend/app/services/work_task_service.py
```

Fix every occurrence by replacing `user_nombre=task.subido_por_nombre` with `user_nombre=user.full_name or user.email`.

- [ ] **Step 2: Verify no other occurrences**

```bash
grep -n "user_nombre=" backend/app/services/work_task_service.py
```

Expected: only `user_nombre=user.full_name or user.email` and `user_nombre=task.subido_por_nombre` for the creation log (creation log using the task creator is correct).

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/work_task_service.py
git commit -m "fix(tareas): registrar nombre real del modificador en historial"
```

---

## Task 3: Allow assigned-task recipient to accept/reject/modify

**Problem:** `update_own_task` blocks edits if `task.subido_por_id != user.id`. Users who receive an assigned task can't change its status (accept, reject, modify).

**Files:**
- Modify: `backend/app/services/work_task_service.py`
- Modify: `backend/app/services/work_task_service.py` (`list_own_tasks`)
- Modify: `frontend/src/hooks/useWorkTasks.ts`

- [ ] **Step 1: Fix `update_own_task` ownership check**

In `work_task_service.py` around line 260, replace:

```python
    if task.subido_por_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes editar tareas de otros usuarios.",
        )
```

With:

```python
    is_owner = task.subido_por_id == user.id
    is_assignee = task.asignado_a_id is not None and task.asignado_a_id == user.id
    if not is_owner and not is_assignee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes editar tareas de otros usuarios.",
        )
```

- [ ] **Step 2: Fix `list_own_tasks` to include assigned tasks**

In `work_task_service.py`, the current query is:

```python
query = select(WorkTask).where(WorkTask.subido_por_id == user.id)
```

Replace with:

```python
from sqlmodel import or_
query = select(WorkTask).where(
    or_(
        WorkTask.subido_por_id == user.id,
        WorkTask.asignado_a_id == user.id,
    )
)
```

Add `from sqlmodel import or_` to the top of the function (or verify it's already imported at file level).

- [ ] **Step 3: Verify the `or_` import**

```bash
grep -n "^from sqlmodel import\|^import sqlmodel" backend/app/services/work_task_service.py
```

If `or_` is not imported, add it to the existing sqlmodel import line.

- [ ] **Step 4: Verify `GET /mis-tareas` passes through correctly**

`GET /mis-tareas` calls `get_paginated_tasks(db, current_user.id, filters)`. Check that `get_paginated_tasks` also uses the or_ filter:

```bash
grep -n "subido_por_id\|asignado_a_id" backend/app/services/work_task_service.py
```

If `get_paginated_tasks` has its own `subido_por_id == user_id` filter, apply the same `or_` fix there.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/work_task_service.py
git commit -m "feat(tareas): destinatario puede aceptar/rechazar/modificar tareas asignadas"
```

---

## Task 4: Attachment access security

**Problem:** `GET /adjuntos/{attachment_id}` only checks `TOOL_SUBMIT` — any authenticated submit-user can access any attachment by ID. Must verify the requesting user has access to the task this attachment belongs to.

**Files:**
- Modify: `backend/app/routers/herramientas_tareas.py`
- Modify: `backend/app/services/task_attachment_service.py`

- [ ] **Step 1: Check current `get_attachment` signature**

```bash
grep -n "def get_attachment" backend/app/services/task_attachment_service.py
```

- [ ] **Step 2: Add access check in `serve_attachment`**

In `herramientas_tareas.py` around line 969, replace `serve_attachment`:

```python
@router.get("/adjuntos/{attachment_id}")
def serve_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_tool_or_403(db, current_user, TOOL_SUBMIT)

    from app.services.task_attachment_service import get_attachment, get_attachment_file
    from app.models.work_task import WorkTask

    attachment = get_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado.")

    # Access control: user must own the task, be assigned to it, or be a manager/admin
    task = db.get(WorkTask, attachment.task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")

    is_admin = getattr(current_user, "role", None) == "admin"
    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_owner = task.subido_por_id == current_user.id
    is_assignee = task.asignado_a_id == current_user.id

    if not (is_admin or is_manager or is_owner or is_assignee):
        raise HTTPException(status_code=403, detail="Sin acceso a este adjunto.")

    file, mime_type, size = get_attachment_file(attachment)

    disposition = "inline" if mime_type.startswith("image/") or mime_type == "application/pdf" else "attachment"

    return StreamingResponse(
        file,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{attachment.filename}"',
            "Content-Length": str(size),
        },
    )
```

- [ ] **Step 3: Check `TaskAttachment` model has `task_id` field**

```bash
grep -n "task_id" backend/app/models/task_attachment.py
```

Expected: `task_id: int` field exists.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/herramientas_tareas.py
git commit -m "security(tareas): validar acceso por tarea en endpoint de adjuntos"
```

---

## Task 5: Co-gestor multi-team backend

**Problem:** `get_comanaged_owner_id` returns only the FIRST team's owner_id. If a user is co-gestor of multiple teams (different managers), only the first match is used. Additionally, `_require_manage_access` returns a single `owner_id`, which breaks multi-team management.

**Files:**
- Modify: `backend/app/services/task_team_service.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Step 1: Add `get_all_comanaged_owner_ids` to service**

In `task_team_service.py`, add after `get_comanaged_owner_id`:

```python
def get_all_comanaged_owner_ids(db: Session, user_id: int) -> list[int]:
    """Retorna los owner_user_id de todos los equipos donde el usuario es co_gestor activo."""
    memberships = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.role == "co_gestor")
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()
    owner_ids = []
    for m in memberships:
        team = db.get(TaskTeam, m.team_id)
        if team and team.is_active and team.owner_user_id not in owner_ids:
            owner_ids.append(team.owner_user_id)
    return owner_ids
```

- [ ] **Step 2: Add new endpoint `GET /mis-equipos-gestionados`**

In `herramientas_tareas.py`, add after `get_mis_equipos`:

```python
@router.get("/mis-equipos-gestionados", response_model=list[UserTeamInfo])
def get_mis_equipos_gestionados(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserTeamInfo]:
    """Equipos que el usuario gestiona (como gestor primario o co-gestor).
    Usado para el workspace switcher en la UI.
    """
    from app.services.task_team_service import get_manager_team, get_all_comanaged_owner_ids
    from app.models.task_team import TaskTeam

    is_admin = getattr(current_user, "role", None) == "admin"
    has_manage = user_has_tool(db, current_user, TOOL_MANAGE)

    teams = []

    if is_admin or has_manage:
        # Gestor primario — su propio equipo
        from app.services.task_team_service import get_or_create_manager_team
        own_team = get_or_create_manager_team(db, current_user.id)
        teams.append(UserTeamInfo(
            team_id=own_team.id,
            team_name=own_team.name,
            owner_id=own_team.owner_user_id,
        ))

    # Co-gestor — todos los equipos donde tiene ese rol
    cogestor_owner_ids = get_all_comanaged_owner_ids(db, current_user.id)
    for owner_id in cogestor_owner_ids:
        coteam = db.exec(
            select(TaskTeam).where(TaskTeam.owner_user_id == owner_id).where(TaskTeam.is_active == True)  # noqa: E712
        ).first()
        if coteam:
            teams.append(UserTeamInfo(
                team_id=coteam.id,
                team_name=coteam.name,
                owner_id=coteam.owner_user_id,
            ))

    return teams
```

- [ ] **Step 3: Add hook `useManagedTeams` in frontend**

In `frontend/src/hooks/useWorkTasks.ts`, after `useMyTeams`:

```typescript
/** Equipos que el usuario gestiona (gestor primario + co-gestor). Para el workspace switcher. */
export function useManagedTeams() {
  return useQuery<UserTeamInfo[]>({
    queryKey: ["tareas", "mis-equipos-gestionados"],
    queryFn: async () => {
      const { data } = await api.get<UserTeamInfo[]>(`${BASE}/mis-equipos-gestionados`)
      return data
    },
  })
}
```

Also ensure `UserTeamInfo` is exported from `@/types/workTask`:

```bash
grep -n "UserTeamInfo" frontend/src/types/workTask.ts
```

If it's there, no change needed. If not, add:
```typescript
export interface UserTeamInfo {
  team_id: number
  team_name: string
  owner_id: number
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/task_team_service.py backend/app/routers/herramientas_tareas.py frontend/src/hooks/useWorkTasks.ts frontend/src/types/workTask.ts
git commit -m "feat(tareas): soporte co-gestor multi-equipo + endpoint mis-equipos-gestionados"
```

---

## Task 6: Discord-style workspace switcher

**Goal:** If the user manages or belongs to multiple workspaces, show the active workspace name in the page header. Clicking cycles through workspaces or shows a switcher menu. No team selector inside `TaskForm` or `AsignarTareaForm` — the active workspace determines the team implicitly.

**Files:**
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`
- Modify: `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx`
- Modify: `frontend/src/components/herramientas/tareas/TaskForm.tsx`
- Modify: `frontend/src/hooks/useWorkTasks.ts` (pass team_id to mis-tareas)

- [ ] **Step 1: Add `activeTeamId` state to `GestionTareasPage`**

Read the full file first:

```bash
cat frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
```

In `GestionTareasPage`, add workspace state:

```typescript
import { useManagedTeams, useMyTeams } from "@/hooks/useWorkTasks"

// Inside the component, after existing hooks:
const { data: managedTeams = [] } = useManagedTeams()
const { data: memberTeams = [] } = useMyTeams()

// All teams the user is part of (managed + member)
const allWorkspaces = canManage ? managedTeams : memberTeams
const [activeTeamId, setActiveTeamId] = useState<number | undefined>(undefined)

// Initialize to first team once loaded
useEffect(() => {
  if (activeTeamId === undefined && allWorkspaces.length > 0) {
    setActiveTeamId(allWorkspaces[0].team_id)
  }
}, [allWorkspaces, activeTeamId])

const activeWorkspace = allWorkspaces.find((t) => t.team_id === activeTeamId)
const pageTitle = activeWorkspace?.team_name ?? (canManage ? "Gestión de Tareas" : "Mis Tareas")
```

- [ ] **Step 2: Render workspace switcher in page header**

In `GestionTareasPage`, replace the `<span>` that shows the title (around line 96-99) with:

```tsx
<div className="flex items-center gap-3">
  <div className="h-6 w-1.5 bg-primary rounded-full" />
  {allWorkspaces.length > 1 ? (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-1.5 text-base font-semibold hover:text-primary transition-colors"
        title="Cambiar workspace"
      >
        {pageTitle}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="absolute left-0 top-full mt-1 z-50 hidden group-focus-within:block group-hover:block bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
        {allWorkspaces.map((ws) => (
          <button
            key={ws.team_id}
            type="button"
            onClick={() => setActiveTeamId(ws.team_id)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
              ws.team_id === activeTeamId ? "font-semibold text-primary" : "text-gray-700"
            }`}
          >
            {ws.team_name}
            {ws.team_id === activeTeamId && " ✓"}
          </button>
        ))}
      </div>
    </div>
  ) : (
    <span className="text-base font-semibold">{pageTitle}</span>
  )}
</div>
```

- [ ] **Step 3: Pass `activeTeamId` to child views**

In `GestionTareasPage`, update the props passed to views:

```tsx
<TaskManagerView
  canSubmitOwn={true}
  filters={filters}
  activeTeamId={activeTeamId}
/>
```

```tsx
<TaskSubmitView filters={filters} activeTeamId={activeTeamId} />
```

- [ ] **Step 4: Update `TaskManagerView` and `TaskSubmitView` to accept and pass `activeTeamId`**

In `TaskManagerView.tsx`, add to `Props`:
```typescript
interface Props {
  canSubmitOwn?: boolean
  filters: TaskFilters
  activeTeamId?: number
}
```

Pass `activeTeamId` to `AsignarTareaForm` and `TaskForm`:
```tsx
<AsignarTareaForm
  onSubmit={...}
  onCancel={...}
  loading={createTask.isPending}
  activeTeamId={activeTeamId}
/>
<TaskForm
  onSubmit={handleNewTaskSubmit}
  onCancel={() => setShowNewTaskForm(false)}
  loading={createTask.isPending}
  activeTeamId={activeTeamId}
/>
```

Same pattern in `TaskSubmitView.tsx`.

- [ ] **Step 5: Remove team selector from `AsignarTareaForm` — use `activeTeamId` prop**

In `AsignarTareaForm.tsx`, update interface:
```typescript
interface AsignarTareaFormProps {
  onSubmit: (payload: WorkTaskCreate) => Promise<void>
  onCancel?: () => void
  loading?: boolean
  activeTeamId?: number
}
```

Remove `useMyTeams`, `teamId` state, `needsTeamSelector`, and the team selector JSX block. Update `handleSubmit`:

```typescript
export function AsignarTareaForm({ onSubmit, onCancel, loading, activeTeamId }: AsignarTareaFormProps) {
  const { data: companeros = [] } = useTeamCompaneros()
  const { data: lists } = useTaskLists(activeTeamId)

  // ... keep existing state for asignadoAId, titulo, etc.
  // Remove: teamId state, needsTeamSelector, useMyTeams

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asignadoAId) return

    const payload: WorkTaskCreate = {
      titulo,
      descripcion_tecnica: descripcion,
      asignado_a_id: asignadoAId,
      fecha,
      prioridad,
      ...(etiqueta && { etiqueta }),
      ...(activeTeamId ? { team_id: activeTeamId } : {}),  // ← use prop, not internal state
    }
    await onSubmit(payload)
    // reset fields...
  }
  // Remove the team selector JSX entirely
}
```

- [ ] **Step 6: Remove team selector from `TaskForm` — use `activeTeamId` prop**

In `TaskForm.tsx`, locate the `needsTeamSelector` logic and team `<select>`. Replace with `activeTeamId` prop:

```typescript
interface TaskFormProps {
  onSubmit: (payload: WorkTaskCreate, files: File[]) => Promise<void>
  onCancel: () => void
  loading?: boolean
  blockSubmitWithoutTeam?: boolean
  activeTeamId?: number
}
```

Remove `useMyTeams` import and usage. Use `activeTeamId` directly in the payload construction. Remove team selector JSX.

- [ ] **Step 7: Update `useMyTasks` to filter by team**

In `frontend/src/hooks/useWorkTasks.ts`, update `useMyTasks`:

```typescript
export function useMyTasks(filters: TaskFilters & { team_id?: number } = {}) {
  return useQuery({
    queryKey: ["tareas", "mis-tareas", filters],
    queryFn: async () => {
      const params = filtersToParams(filters)
      if (filters.team_id) params.set("team_id", String(filters.team_id))
      const { data } = await api.get<PaginatedTasksResponse>(`${BASE}/mis-tareas?${params}`)
      return data.data
    },
  })
}
```

In `TaskSubmitView.tsx`, pass `team_id`:
```typescript
const { data: allTasks } = useMyTasks({ ...filters, team_id: activeTeamId })
const { data: todayTasks } = useMyTasks({ fecha_desde: today, fecha_hasta: today, team_id: activeTeamId })
```

- [ ] **Step 8: Backend — add `team_id` filter to `GET /mis-tareas`**

In `herramientas_tareas.py`, update `mis_tareas_paginadas` to accept `team_id`:

```python
@router.get("/mis-tareas", response_model=PaginatedTasksResponse)
def mis_tareas_paginadas(
    ...
    team_id: Optional[int] = Query(default=None),
    ...
):
    ...
    filters = PaginatedTaskFilters(
        page=page, limit=limit, search=effective_search, responsable_id=responsable_id,
        estado=estado, etiqueta=etiqueta, plataforma=plataforma,
        fecha_exacta=fecha_exacta, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        team_id=team_id,  # ← new
    )
    return get_paginated_tasks(db, current_user.id, filters)
```

In `backend/app/schemas/work_task.py`, add `team_id` to `PaginatedTaskFilters`:
```python
team_id: int | None = None
```

In `backend/app/services/work_task_service.py`, in `get_paginated_tasks`, apply the filter:
```python
if filters.team_id is not None:
    query = query.where(WorkTask.team_id == filters.team_id)
```

- [ ] **Step 9: Verify the workspace switcher renders correctly in browser**

```bash
# Start frontend dev server
cd frontend && npm run dev
```

Login as a user belonging to 2+ teams → "Gestión de tareas" heading should show team name with dropdown arrow → clicking shows workspace list → selecting changes the name.

Login as a user with 1 team → heading shows team name, no dropdown.

- [ ] **Step 10: Commit**

```bash
git add \
  frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx \
  frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx \
  frontend/src/components/herramientas/tareas/TaskForm.tsx \
  frontend/src/components/herramientas/tareas/TaskManagerView.tsx \
  frontend/src/components/herramientas/tareas/TaskSubmitView.tsx \
  frontend/src/hooks/useWorkTasks.ts \
  backend/app/routers/herramientas_tareas.py \
  backend/app/schemas/work_task.py \
  backend/app/services/work_task_service.py
git commit -m "feat(tareas): workspace switcher estilo Discord + multi-equipo sin selector en formularios"
```

---

## Self-Review

**Spec coverage:**
1. ✅ "Asignar tarea" button — Task 1
2. ✅ Activity log with real modifier name — Task 2
3. ✅ Assigned task recipient can accept/reject/modify — Task 3
4. ✅ Attachment security — Task 4
5. ✅ Co-gestor multi-team — Task 5
6. ✅ Discord workspace switcher, remove team selector from forms — Task 6

**Placeholder scan:** All steps include concrete code. No TBDs.

**Type consistency:**
- `UserTeamInfo` used in Tasks 5 and 6 — same shape `{ team_id, team_name, owner_id }`
- `activeTeamId: number | undefined` — consistent across all components
- `PaginatedTaskFilters.team_id: int | None` — added in Task 6 Step 8, used consistently
