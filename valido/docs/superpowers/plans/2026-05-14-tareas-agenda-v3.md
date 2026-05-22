# Tareas & Agenda v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quick task status change with configurable final/canceled states, open event scheduling for all users with priority and event detail/cancel/add-participants, and fix the calendar sidebar resize bug.

**Architecture:** All changes stay in the `herramientas_tareas` module. Backend uses try/except ALTER TABLE SQLite migrations (existing pattern in main.py `_migrate_db`). Frontend extends existing components and hooks without adding new abstraction layers.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend), React 18 + TypeScript + TanStack Query + Tailwind + shadcn/ui (frontend).

---

## File Map

**Created:**
- `frontend/src/components/herramientas/tareas/EventDetailSheet.tsx`

**Modified:**
- `backend/app/models/task_list_config.py` — add `is_final`, `is_canceled`
- `backend/app/models/task_event.py` — add `prioridad`
- `backend/app/main.py` — ADD ALTER TABLE migrations for new columns
- `backend/app/schemas/task_list_config.py` — update `TaskListConfigRead`, validator
- `backend/app/schemas/task_event.py` — add `prioridad` to create/read schemas
- `backend/app/services/task_list_config_service.py` — add `mark_estado_especial`, update `get_lists_by_owner`
- `backend/app/services/work_task_service.py` — auto-close time on final/canceled, add `update_team_task`
- `backend/app/services/task_event_service.py` — add `delete_event`, `update_event_participants`, add `prioridad`
- `backend/app/routers/herramientas_tareas.py` — 5 new endpoints, remove scheduling restriction
- `frontend/src/types/workTask.ts` — update types for new fields
- `frontend/src/hooks/useWorkTasks.ts` — 4 new hooks, update types
- `frontend/src/components/herramientas/tareas/ListConfigTab.tsx` — estado especial toggles, prioridad_agenda section
- `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx` — inline status changer
- `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` — pass onStatusChange
- `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx` — pass onStatusChange
- `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx` — priority field, open for all
- `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx` — resize bug fix
- `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` — wire EventDetailSheet, canSelectOthers

---

## Task 1: DB Migrations + Model Updates

**Files:**
- Modify: `backend/app/models/task_list_config.py`
- Modify: `backend/app/models/task_event.py`
- Modify: `backend/app/main.py` (inside `_migrate_db` function, around line 263)

- [ ] **Step 1: Update TaskListConfig model**

Replace the full content of `backend/app/models/task_list_config.py`:

```python
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskListConfig(SQLModel, table=True):
    __tablename__ = "task_list_configs"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(index=True, nullable=False)
    list_type: str = Field(index=True, max_length=50, nullable=False)
    value: str = Field(max_length=100, nullable=False)
    label: str = Field(max_length=150, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    is_final: bool = Field(default=False, nullable=False)
    is_canceled: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

- [ ] **Step 2: Update TaskEvent model**

Replace the full content of `backend/app/models/task_event.py`:

```python
# backend/app/models/task_event.py
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_user_id: int = Field(index=True, nullable=False)
    team_id: Optional[int] = Field(default=None, index=True)
    titulo: str = Field(max_length=250, nullable=False)
    descripcion: Optional[str] = Field(default=None)
    plataforma: Optional[str] = Field(default=None, max_length=50)
    prioridad: Optional[str] = Field(default=None, max_length=50)
    fecha: date = Field(index=True, nullable=False)
    hora_inicio: str = Field(max_length=5, nullable=False)           # "HH:MM"
    duracion_minutos: int = Field(default=60, nullable=False)
    creado_por_id: int = Field(index=True, nullable=False)
    creado_por_nombre: str = Field(max_length=200, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

- [ ] **Step 3: Add ALTER TABLE migrations to main.py**

Inside `_migrate_db()` in `backend/app/main.py`, add these blocks **after** the existing `work_tasks.prioridad` migration block (around line 268):

```python
        # task_list_configs: is_final, is_canceled
        try:
            conn.execute(text("ALTER TABLE task_list_configs ADD COLUMN is_final INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna task_list_configs.is_final agregada.")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE task_list_configs ADD COLUMN is_canceled INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna task_list_configs.is_canceled agregada.")
        except Exception:
            pass

        # task_events: prioridad
        try:
            conn.execute(text("ALTER TABLE task_events ADD COLUMN prioridad VARCHAR(50)"))
            conn.commit()
            print("[migrate] Columna task_events.prioridad agregada.")
        except Exception:
            pass
```

- [ ] **Step 4: Start the backend and verify migrations ran**

```bash
cd C:/zymo-intranet/backend
python -c "from app.main import app; print('OK')"
```

Expected: no errors, `[migrate]` lines printed to console on first run.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/task_list_config.py backend/app/models/task_event.py backend/app/main.py
git commit -m "feat(tareas-v3): DB migrations — is_final/is_canceled/prioridad"
```

---

## Task 2: Backend — Schemas + Config Endpoint for Estado Especial

**Files:**
- Modify: `backend/app/schemas/task_list_config.py`
- Modify: `backend/app/schemas/task_event.py`
- Modify: `backend/app/services/task_list_config_service.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Step 1: Update task_list_config schemas**

Replace `backend/app/schemas/task_list_config.py`:

```python
from pydantic import BaseModel, field_validator
import re


class TaskListConfigCreate(BaseModel):
    list_type: str
    value: str
    label: str

    @field_validator("list_type")
    @classmethod
    def validate_list_type(cls, v: str) -> str:
        allowed = {"estado", "etiqueta", "plataforma", "prioridad_agenda"}
        if v not in allowed:
            raise ValueError(f"list_type must be one of: {', '.join(allowed)}")
        return v

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9_]+$", v):
            raise ValueError("value must be lowercase letters, numbers and underscores only")
        if len(v) < 2:
            raise ValueError("value must be at least 2 characters")
        return v


class TaskListConfigUpdate(BaseModel):
    label: str | None = None
    is_active: bool | None = None


class TaskEstadoEspecialPayload(BaseModel):
    tipo: str | None = None   # "final" | "cancelado" | None (clears)


class TaskListConfigRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    list_type: str
    value: str
    label: str
    is_active: bool
    is_final: bool = False
    is_canceled: bool = False
```

- [ ] **Step 2: Update task_event schemas**

Replace `backend/app/schemas/task_event.py`:

```python
# backend/app/schemas/task_event.py
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional


class TaskEventParticipantRead(BaseModel):
    user_id: int
    user_nombre: str
    has_conflict: bool
    conflict_detail: Optional[str] = None


class TaskEventCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    plataforma: Optional[str] = None
    prioridad: Optional[str] = None
    fecha: str                         # "YYYY-MM-DD"
    hora_inicio: str                   # "HH:MM"
    duracion_minutos: int = Field(default=60, ge=5, le=1440)
    participant_ids: list[int] = Field(min_length=1)

    @field_validator("fecha")
    @classmethod
    def validate_fecha(cls, v: str) -> str:
        if not re.match(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("fecha must be YYYY-MM-DD")
        return v

    @field_validator("hora_inicio")
    @classmethod
    def validate_hora_inicio(cls, v: str) -> str:
        if not re.match(r"\d{2}:\d{2}", v):
            raise ValueError("hora_inicio must be HH:MM")
        return v


class TaskEventParticipantsUpdate(BaseModel):
    add_ids: list[int] = Field(default_factory=list)
    remove_ids: list[int] = Field(default_factory=list)


class TaskEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descripcion: Optional[str] = None
    plataforma: Optional[str] = None
    prioridad: Optional[str] = None
    fecha: str
    hora_inicio: str
    duracion_minutos: int
    creado_por_id: int
    creado_por_nombre: str
    participants: list[TaskEventParticipantRead] = []


class TaskActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    user_nombre: str
    accion: str
    detalle: Optional[str] = None
    fecha: str                        # ISO string
```

- [ ] **Step 3: Add mark_estado_especial to task_list_config_service.py**

Add this function at the end of `backend/app/services/task_list_config_service.py`:

```python
def mark_estado_especial(
    db: Session, owner_id: int, value: str, tipo: str | None
) -> "TaskListConfig":
    """
    Marks a specific estado value as is_final or is_canceled (tipo='final'|'cancelado'|None).
    Only one estado can be is_final=True and one is_canceled=True at a time per workspace.
    """
    from fastapi import HTTPException

    if tipo not in ("final", "cancelado", None):
        raise HTTPException(status_code=422, detail="tipo debe ser 'final', 'cancelado' o null.")

    # Clear previous flag
    if tipo == "final":
        prev = db.exec(
            select(TaskListConfig)
            .where(TaskListConfig.owner_user_id == owner_id)
            .where(TaskListConfig.is_final == True)  # noqa: E712
        ).all()
        for p in prev:
            p.is_final = False
            db.add(p)
    elif tipo == "cancelado":
        prev = db.exec(
            select(TaskListConfig)
            .where(TaskListConfig.owner_user_id == owner_id)
            .where(TaskListConfig.is_canceled == True)  # noqa: E712
        ).all()
        for p in prev:
            p.is_canceled = False
            db.add(p)

    target = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.list_type == "estado")
        .where(TaskListConfig.value == value)
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Estado no encontrado.")

    if tipo == "final":
        target.is_final = True
        target.is_canceled = False
    elif tipo == "cancelado":
        target.is_canceled = True
        target.is_final = False
    else:
        target.is_final = False
        target.is_canceled = False

    db.add(target)
    db.commit()
    db.refresh(target)
    return target
```

Also update `get_lists_by_owner` to initialize `prioridad_agenda` key in `by_type`:

Replace lines 47-54 in `task_list_config_service.py`:

```python
    by_type: dict[str, list[TaskListConfig]] = {
        "estado": [],
        "etiqueta": [],
        "plataforma": [],
        "prioridad_agenda": [],
    }
    for row in rows:
        by_type.setdefault(row.list_type, []).append(row)
    return by_type
```

- [ ] **Step 4: Add new endpoints to router**

In `backend/app/routers/herramientas_tareas.py`, add these imports at the top (within existing imports section):

```python
from app.schemas.task_list_config import TaskListConfigCreate, TaskListConfigUpdate, TaskListConfigRead, TaskEstadoEspecialPayload
from app.schemas.task_event import TaskEventCreate, TaskEventParticipantsUpdate
```

Add a new endpoint after the existing `delete_lista_item` endpoint (end of list config section, around line 757):

```python
@router.patch("/config/listas/estado/{value}/especial", response_model=TaskListConfigRead)
def marcar_estado_especial(
    value: str,
    payload: TaskEstadoEspecialPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskListConfigRead:
    """Marca un estado como 'final' o 'cancelado'. Solo uno de cada tipo por workspace."""
    owner_id = _require_manage_access(db, current_user)

    from app.services.task_list_config_service import mark_estado_especial

    item = mark_estado_especial(db, owner_id, value, payload.tipo)
    return TaskListConfigRead.model_validate(item)
```

Also update the `get_listas` fallback at lines 707-711 to return the new key:

```python
    if not membership:
        return {"estado": [], "etiqueta": [], "plataforma": [], "prioridad_agenda": []}
    team = db.get(TaskTeam, membership.team_id)
    if not team:
        return {"estado": [], "etiqueta": [], "plataforma": [], "prioridad_agenda": []}
    return get_lists_by_owner(db, team.owner_user_id)
```

- [ ] **Step 5: Verify the endpoint is importable**

```bash
cd C:/zymo-intranet/backend
python -c "from app.routers.herramientas_tareas import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/task_list_config.py backend/app/schemas/task_event.py \
        backend/app/services/task_list_config_service.py \
        backend/app/routers/herramientas_tareas.py
git commit -m "feat(tareas-v3): schemas estado-especial + prioridad_agenda + mark_estado_especial endpoint"
```

---

## Task 3: Backend — Task Auto-Close + Event CRUD + Scheduling Open

**Files:**
- Modify: `backend/app/services/work_task_service.py`
- Modify: `backend/app/services/task_event_service.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Step 1: Add auto-close logic to update_own_task**

In `backend/app/services/work_task_service.py`, replace the `update_own_task` function body. The key change: after applying `update_data`, check if the new `estado` is `is_final` or `is_canceled`, and if so, auto-set `hora_cierre`.

Replace the entire `update_own_task` function (lines 154-206):

```python
def update_own_task(
    db: Session,
    user: User,
    task_id: int,
    payload: WorkTaskUpdate,
) -> WorkTask:
    """Updates a task. User cannot edit tasks that belong to others."""
    task = db.get(WorkTask, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarea no encontrada.",
        )
    if task.subido_por_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes editar tareas de otros usuarios.",
        )

    if payload.etiqueta is not None or payload.plataforma is not None or payload.estado is not None:
        validate_task_values(
            db, user,
            payload.etiqueta if payload.etiqueta is not None else task.etiqueta,
            payload.plataforma if payload.plataforma is not None else task.plataforma,
            payload.estado if payload.estado is not None else task.estado,
        )

    update_data = payload.model_dump(exclude_unset=True)
    estado_anterior = task.estado
    for field, value in update_data.items():
        setattr(task, field, value)

    # Auto-close time when transitioning to a final or canceled state
    if "estado" in update_data and update_data["estado"] != estado_anterior:
        _maybe_auto_close(db, user, task)

    hora_inicio = task.hora_inicio
    hora_cierre = task.hora_cierre
    task.tiempo_total_minutos = calcular_minutos(hora_inicio, hora_cierre)
    task.updated_at = datetime.now(timezone.utc)

    db.add(task)
    db.commit()
    db.refresh(task)

    if "estado" in update_data and update_data["estado"] != estado_anterior:
        log_activity(
            db,
            task_id=task.id,
            user_id=user.id,
            user_nombre=task.subido_por_nombre,
            accion="cambio_estado",
            detalle=f"De {estado_anterior} a {update_data['estado']}",
        )
        db.commit()

    return task


def _maybe_auto_close(db: Session, user: User, task: WorkTask) -> None:
    """If the new estado is is_final or is_canceled, auto-set hora_cierre to now."""
    from app.models.task_list_config import TaskListConfig
    from app.services.task_team_service import get_user_active_teams

    if task.hora_cierre is not None:
        return  # Already has a close time

    active_teams = get_user_active_teams(db, user.id)  # type: ignore[arg-type]
    if active_teams:
        owner_id = active_teams[0]["team_id"]
        # Resolve to the team owner
        from app.models.task_team import TaskTeam
        team = db.get(TaskTeam, owner_id)
        if team:
            owner_id = team.owner_user_id
        else:
            return
    else:
        is_admin = getattr(user, "role", None) == "admin"
        from app.services.user_tool_service import user_has_tool
        if user_has_tool(db, user, "tool_task_manage_dev") or is_admin:
            owner_id = user.id
        else:
            return

    config = db.exec(
        select(TaskListConfig)
        .where(TaskListConfig.owner_user_id == owner_id)
        .where(TaskListConfig.list_type == "estado")
        .where(TaskListConfig.value == task.estado)
    ).first()

    if config and (config.is_final or config.is_canceled):
        task.hora_cierre = datetime.now(timezone.utc)
```

- [ ] **Step 2: Add update_team_task service function**

Add at the end of `backend/app/services/work_task_service.py`:

```python
def update_team_task(
    db: Session,
    manager_user: User,
    task_id: int,
    payload: WorkTaskUpdate,
) -> WorkTask:
    """Manager updates any task in their team (estado change only in practice)."""
    from app.models.task_list_config import TaskListConfig

    task = db.get(WorkTask, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarea no encontrada.",
        )

    if payload.etiqueta is not None or payload.plataforma is not None or payload.estado is not None:
        validate_task_values(
            db, manager_user,
            payload.etiqueta if payload.etiqueta is not None else task.etiqueta,
            payload.plataforma if payload.plataforma is not None else task.plataforma,
            payload.estado if payload.estado is not None else task.estado,
        )

    update_data = payload.model_dump(exclude_unset=True)
    estado_anterior = task.estado
    for field, value in update_data.items():
        setattr(task, field, value)

    if "estado" in update_data and update_data["estado"] != estado_anterior:
        if task.hora_cierre is None:
            config = db.exec(
                select(TaskListConfig)
                .where(TaskListConfig.owner_user_id == manager_user.id)
                .where(TaskListConfig.list_type == "estado")
                .where(TaskListConfig.value == task.estado)
            ).first()
            if config and (config.is_final or config.is_canceled):
                task.hora_cierre = datetime.now(timezone.utc)

    hora_inicio = task.hora_inicio
    hora_cierre = task.hora_cierre
    task.tiempo_total_minutos = calcular_minutos(hora_inicio, hora_cierre)
    task.updated_at = datetime.now(timezone.utc)

    db.add(task)
    db.commit()
    db.refresh(task)

    if "estado" in update_data and update_data["estado"] != estado_anterior:
        log_activity(
            db,
            task_id=task.id,
            user_id=manager_user.id,
            user_nombre=manager_user.full_name or manager_user.email,
            accion="cambio_estado",
            detalle=f"De {estado_anterior} a {update_data['estado']} (gestor)",
        )
        db.commit()

    return task
```

- [ ] **Step 3: Add delete_event and update_event_participants to task_event_service.py**

Also update `create_event` to store `prioridad`. Add to end of `backend/app/services/task_event_service.py`:

First, update the `create_event` function — inside it, change the `TaskEvent(...)` constructor to add `prioridad`:

```python
    event = TaskEvent(
        owner_user_id=creator.id,
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        plataforma=payload.plataforma,
        prioridad=getattr(payload, "prioridad", None),
        fecha=date.fromisoformat(payload.fecha),
        hora_inicio=payload.hora_inicio,
        duracion_minutos=payload.duracion_minutos,
        creado_por_id=creator.id,
        creado_por_nombre=creator.full_name or creator.email,
    )
```

Then add these two functions at the end of the file:

```python
def delete_event(db: "Session", event_id: int, requesting_user_id: int, is_manager: bool) -> None:
    """
    Deletes an event and all its participants.
    Only the event creator or a manager can delete.
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from fastapi import HTTPException
    from sqlmodel import select as sqlmodel_select

    event = db.get(TaskEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    if not is_manager and event.creado_por_id != requesting_user_id:
        raise HTTPException(status_code=403, detail="Solo el creador o un gestor puede cancelar este evento.")

    participants = db.exec(
        sqlmodel_select(TaskEventParticipant).where(TaskEventParticipant.event_id == event_id)
    ).all()
    for p in participants:
        db.delete(p)
    db.delete(event)
    db.commit()


def update_event_participants(
    db: "Session",
    event_id: int,
    requesting_user_id: int,
    is_manager: bool,
    add_ids: list[int],
    remove_ids: list[int],
) -> dict:
    """
    Adds or removes participants from an existing event.
    Only creator or manager can modify participants.
    Re-runs conflict detection for added users.
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from app.models.user import User as UserModel
    from fastapi import HTTPException
    from sqlmodel import select as sqlmodel_select

    event = db.get(TaskEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    if not is_manager and event.creado_por_id != requesting_user_id:
        raise HTTPException(status_code=403, detail="Solo el creador o un gestor puede modificar participantes.")

    # Remove participants
    for uid in remove_ids:
        existing = db.exec(
            sqlmodel_select(TaskEventParticipant)
            .where(TaskEventParticipant.event_id == event_id)
            .where(TaskEventParticipant.user_id == uid)
        ).first()
        if existing:
            db.delete(existing)

    # Add participants (skip if already present)
    new_start = _parse_hhmm(event.hora_inicio)
    new_dur = event.duracion_minutos

    for uid in add_ids:
        already = db.exec(
            sqlmodel_select(TaskEventParticipant)
            .where(TaskEventParticipant.event_id == event_id)
            .where(TaskEventParticipant.user_id == uid)
        ).first()
        if already:
            continue

        user = db.get(UserModel, uid)
        if not user:
            continue

        existing_events = db.exec(
            sqlmodel_select(TaskEvent)
            .join(TaskEventParticipant, TaskEvent.id == TaskEventParticipant.event_id)
            .where(
                TaskEventParticipant.user_id == uid,
                TaskEvent.fecha == event.fecha,
                TaskEvent.id != event_id,
            )
        ).all()

        has_conflict = False
        conflict_detail = None
        for ex in existing_events:
            ex_start = _parse_hhmm(ex.hora_inicio)
            if _events_overlap(new_start, new_dur, ex_start, ex.duracion_minutos):
                has_conflict = True
                conflict_detail = f"Choca con: '{ex.titulo}' a las {ex.hora_inicio}"
                break

        participant = TaskEventParticipant(
            event_id=event_id,
            user_id=uid,
            user_nombre=user.full_name or user.email,
            has_conflict=has_conflict,
            conflict_detail=conflict_detail,
        )
        db.add(participant)

    db.commit()

    # Return refreshed participants list
    participants = db.exec(
        sqlmodel_select(TaskEventParticipant).where(TaskEventParticipant.event_id == event_id)
    ).all()
    return {
        "event": event,
        "participants": list(participants),
    }
```

- [ ] **Step 4: Add new router endpoints**

In `backend/app/routers/herramientas_tareas.py`, add the following endpoints.

**After the existing `update_task_endpoint` (PATCH /{task_id}), add:**

```python
@router.patch("/equipo/tareas/{task_id}", response_model=WorkTaskRead)
def update_team_task_endpoint(
    task_id: int,
    payload: WorkTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkTaskRead:
    """Manager updates any team task (e.g. change estado)."""
    _require_manage_access(db, current_user)

    from app.services.work_task_service import update_team_task

    task = update_team_task(db, current_user, task_id, payload)
    return WorkTaskRead.model_validate(task)
```

**Replace the existing `crear_evento_agenda` endpoint** (lines 351-367) to remove the manager-only restriction:

```python
@router.post("/agenda", response_model=None, status_code=201)
def crear_evento_agenda(
    payload: TaskEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.task_event_service import create_event

    require_tool_or_403(db, current_user, TOOL_SUBMIT)
    result = create_event(db, current_user, payload)
    return {"ok": True, "event_id": result["event"].id}
```

**After the `eventos_por_fecha` endpoint (line ~409), add:**

```python
@router.delete("/agenda/{event_id}")
def cancelar_evento(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.services.task_event_service import delete_event
    from app.services.user_tool_service import user_has_tool

    require_tool_or_403(db, current_user, TOOL_SUBMIT)
    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_admin = getattr(current_user, "role", None) == "admin"
    delete_event(db, event_id, current_user.id, is_manager or is_admin)
    return {"ok": True}


@router.patch("/agenda/{event_id}/participantes")
def actualizar_participantes_evento(
    event_id: int,
    payload: TaskEventParticipantsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    from app.services.task_event_service import update_event_participants
    from app.services.user_tool_service import user_has_tool

    require_tool_or_403(db, current_user, TOOL_SUBMIT)
    is_manager = user_has_tool(db, current_user, TOOL_MANAGE)
    is_admin = getattr(current_user, "role", None) == "admin"
    result = update_event_participants(
        db, event_id, current_user.id, is_manager or is_admin,
        payload.add_ids, payload.remove_ids,
    )
    return {
        "ok": True,
        "participants": [
            {
                "user_id": p.user_id,
                "user_nombre": p.user_nombre,
                "has_conflict": p.has_conflict,
                "conflict_detail": p.conflict_detail,
            }
            for p in result["participants"]
        ],
    }
```

Also update the `eventos_por_fecha` endpoint to include `prioridad` and `creado_por_id` in the response dict (around line 388):

```python
    return [
        {
            "id": r["event"].id,
            "titulo": r["event"].titulo,
            "descripcion": r["event"].descripcion,
            "plataforma": getattr(r["event"], "plataforma", None),
            "prioridad": getattr(r["event"], "prioridad", None),
            "fecha": str(r["event"].fecha),
            "hora_inicio": r["event"].hora_inicio,
            "duracion_minutos": r["event"].duracion_minutos,
            "creado_por_id": r["event"].creado_por_id,
            "creado_por_nombre": r["event"].creado_por_nombre,
            "participants": [
                {
                    "user_id": p.user_id,
                    "user_nombre": p.user_nombre,
                    "has_conflict": p.has_conflict,
                    "conflict_detail": p.conflict_detail,
                }
                for p in r["participants"]
            ],
        }
        for r in result
    ]
```

- [ ] **Step 5: Verify imports**

```bash
cd C:/zymo-intranet/backend
python -c "from app.routers.herramientas_tareas import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/work_task_service.py \
        backend/app/services/task_event_service.py \
        backend/app/routers/herramientas_tareas.py
git commit -m "feat(tareas-v3): auto-close time, update_team_task, event DELETE/PATCH, open scheduling"
```

---

## Task 4: Frontend — Types + Hooks

**Files:**
- Modify: `frontend/src/types/workTask.ts`
- Modify: `frontend/src/hooks/useWorkTasks.ts`

- [ ] **Step 1: Update workTask.ts types**

In `frontend/src/types/workTask.ts`:

1. Add `prioridad?` and `creado_por_id` to `TaskEvent` interface:

```typescript
export interface TaskEvent {
  id: number
  titulo: string
  descripcion?: string
  plataforma?: string
  prioridad?: string
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  creado_por_id: number
  creado_por_nombre: string
  participants: TaskEventParticipant[]
}
```

2. Add `prioridad?` to `TaskEventCreate`:

```typescript
export interface TaskEventCreate {
  titulo: string
  descripcion?: string
  plataforma?: string
  prioridad?: string
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  participant_ids: number[]
}
```

- [ ] **Step 2: Update TaskListConfigItem and TaskListsResponse in useWorkTasks.ts**

In `frontend/src/hooks/useWorkTasks.ts`, replace the `TaskListConfigItem` type and `TaskListsResponse` type (around lines 345-357):

```typescript
export type TaskListConfigItem = {
  id: number
  list_type: string
  value: string
  label: string
  is_active: boolean
  is_final: boolean
  is_canceled: boolean
}

export type TaskListsResponse = {
  estado: TaskListConfigItem[]
  etiqueta: TaskListConfigItem[]
  plataforma: TaskListConfigItem[]
  prioridad_agenda: TaskListConfigItem[]
}
```

- [ ] **Step 3: Add new hooks to useWorkTasks.ts**

Add these hooks after `useCreateEvent` (around line 294):

```typescript
export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: number) => {
      await api.delete(`/api/herramientas/tareas/agenda/${eventId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "agenda"] })
    },
  })
}

export function useUpdateEventParticipants() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      addIds,
      removeIds,
    }: {
      eventId: number
      addIds: number[]
      removeIds: number[]
    }) => {
      const { data } = await api.patch(
        `/api/herramientas/tareas/agenda/${eventId}/participantes`,
        { add_ids: addIds, remove_ids: removeIds }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "agenda"] })
    },
  })
}

export function useMarkEstadoEspecial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ value, tipo }: { value: string; tipo: "final" | "cancelado" | null }) => {
      const { data } = await api.patch<TaskListConfigItem>(
        `${BASE}/config/listas/estado/${value}/especial`,
        { tipo }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "config", "listas"] })
    },
  })
}

export function useUpdateManagerTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: WorkTaskUpdate }) => {
      const { data } = await api.patch<WorkTask>(`${BASE}/equipo/tareas/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas"] })
    },
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/workTask.ts frontend/src/hooks/useWorkTasks.ts
git commit -m "feat(tareas-v3): types + hooks for estado-especial, event CRUD, manager task update"
```

---

## Task 5: Frontend — ListConfigTab (Estado Especial + Prioridad Agenda)

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/ListConfigTab.tsx`

- [ ] **Step 1: Replace ListConfigTab.tsx**

Replace the full content of `frontend/src/components/herramientas/tareas/ListConfigTab.tsx`:

```tsx
import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X, Flag, Ban } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useTaskLists,
  useCreateTaskListItem,
  useUpdateTaskListItem,
  useDeleteTaskListItem,
  useMarkEstadoEspecial,
} from "@/hooks/useWorkTasks"
import type { TaskListConfigItem } from "@/hooks/useWorkTasks"

interface ListSectionProps {
  title: string
  type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda"
  items: TaskListConfigItem[]
  onAdd: (value: string, label: string) => void
  onUpdate: (value: string, label: string) => void
  onDelete: (value: string) => void
  onMarkEspecial?: (value: string, tipo: "final" | "cancelado" | null) => void
  isLoading: boolean
}

function ListSection({
  title,
  type: _type,
  items,
  onAdd,
  onUpdate,
  onDelete,
  onMarkEspecial,
  isLoading,
}: ListSectionProps) {
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")

  const handleAdd = () => {
    if (!newValue.trim() || !newLabel.trim()) return
    onAdd(newValue.trim().toLowerCase().replace(/\s+/g, "_"), newLabel.trim())
    setNewValue("")
    setNewLabel("")
    setAdding(false)
  }

  const startEdit = (item: TaskListConfigItem) => {
    setEditingKey(item.value)
    setEditLabel(item.label)
  }

  const handleEdit = () => {
    if (!editLabel.trim()) return
    onUpdate(editingKey!, editLabel.trim())
    setEditingKey(null)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            {onMarkEspecial && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Marca un estado como <span className="text-green-700 font-medium">Final</span> (cierra el tiempo) o <span className="text-red-600 font-medium">Cancelado</span>
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
            className="h-7 px-2 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="key (ej: en_progreso)"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Label (ej: En progreso)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" variant="ghost" onClick={handleAdd} className="h-8 w-8 p-0">
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setAdding(false); setNewValue(""); setNewLabel("") }}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {items.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground italic">Sin elementos. Agrega el primero.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div
                key={item.value}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${
                  item.is_final
                    ? "bg-green-50 border-green-300 text-green-800"
                    : item.is_canceled
                    ? "bg-red-50 border-red-300 text-red-800"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                }`}
              >
                {editingKey === item.value ? (
                  <>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-6 w-32 text-xs py-0"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                    />
                    <Button size="sm" variant="ghost" onClick={handleEdit} className="h-6 w-6 p-0">
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-6 w-6 p-0">
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    {item.is_final && <Flag className="w-3 h-3 text-green-600" />}
                    {item.is_canceled && <Ban className="w-3 h-3 text-red-600" />}
                    <span>{item.label}</span>
                    {onMarkEspecial && (
                      <>
                        <button
                          type="button"
                          title={item.is_final ? "Quitar como estado final" : "Marcar como estado final"}
                          onClick={() => onMarkEspecial(item.value, item.is_final ? null : "final")}
                          className={`ml-1 transition-colors ${
                            item.is_final ? "text-green-600" : "text-gray-300 hover:text-green-500"
                          }`}
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title={item.is_canceled ? "Quitar como cancelado" : "Marcar como cancelado"}
                          onClick={() => onMarkEspecial(item.value, item.is_canceled ? null : "cancelado")}
                          className={`ml-0.5 transition-colors ${
                            item.is_canceled ? "text-red-600" : "text-gray-300 hover:text-red-500"
                          }`}
                        >
                          <Ban className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.value)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ListConfigTab() {
  const { data: lists, isLoading } = useTaskLists()
  const createItem = useCreateTaskListItem()
  const updateItem = useUpdateTaskListItem()
  const deleteItem = useDeleteTaskListItem()
  const markEspecial = useMarkEstadoEspecial()

  const handleAdd = (type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda") => (value: string, label: string) => {
    createItem.mutate({ list_type: type, value, label })
  }

  const handleUpdate = (type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda") => (value: string, label: string) => {
    updateItem.mutate({ list_type: type, value, payload: { label } })
  }

  const handleDelete = (type: "estado" | "etiqueta" | "plataforma" | "prioridad_agenda") => (value: string) => {
    deleteItem.mutate({ list_type: type, value })
  }

  const handleMarkEspecial = (value: string, tipo: "final" | "cancelado" | null) => {
    markEspecial.mutate({ value, tipo })
  }

  const sectionProps = {
    isLoading: isLoading || createItem.isPending || updateItem.isPending || deleteItem.isPending || markEspecial.isPending,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Configuración de listas</h2>
        <p className="text-xs text-muted-foreground">Configura los valores disponibles en los formularios</p>
      </div>

      <ListSection
        title="Estados"
        type="estado"
        items={lists?.estado ?? []}
        onAdd={handleAdd("estado")}
        onUpdate={handleUpdate("estado")}
        onDelete={handleDelete("estado")}
        onMarkEspecial={handleMarkEspecial}
        {...sectionProps}
      />

      <ListSection
        title="Etiquetas"
        type="etiqueta"
        items={lists?.etiqueta ?? []}
        onAdd={handleAdd("etiqueta")}
        onUpdate={handleUpdate("etiqueta")}
        onDelete={handleDelete("etiqueta")}
        {...sectionProps}
      />

      <ListSection
        title="Plataformas"
        type="plataforma"
        items={lists?.plataforma ?? []}
        onAdd={handleAdd("plataforma")}
        onUpdate={handleUpdate("plataforma")}
        onDelete={handleDelete("plataforma")}
        {...sectionProps}
      />

      <ListSection
        title="Prioridades de agenda"
        type="prioridad_agenda"
        items={lists?.prioridad_agenda ?? []}
        onAdd={handleAdd("prioridad_agenda")}
        onUpdate={handleUpdate("prioridad_agenda")}
        onDelete={handleDelete("prioridad_agenda")}
        {...sectionProps}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/herramientas/tareas/ListConfigTab.tsx
git commit -m "feat(tareas-v3): ListConfigTab — estado especial (final/cancelado) + prioridad_agenda"
```

---

## Task 6: Frontend — TaskDetailSheet Inline Status Changer

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx`
- Modify: `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`
- Modify: `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx`

- [ ] **Step 1: Update TaskDetailSheet to accept onStatusChange prop**

Replace the full content of `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx`:

```tsx
import { useState } from "react"
import type { WorkTask } from "@/types/workTask"
import { useTaskLists } from "@/hooks/useWorkTasks"
import {
  taskBadge,
  ETIQUETA_COLOR,
  ESTADO_COLOR,
  ETIQUETA_LABELS,
  PLATAFORMA_LABELS,
  ESTADO_LABELS,
  formatMinutos,
} from "@/lib/taskTheme"

interface TaskDetailSheetProps {
  task: WorkTask | null
  onClose: () => void
  onStatusChange?: (taskId: number, newEstado: string) => Promise<void>
}

export function TaskDetailSheet({ task, onClose, onStatusChange }: TaskDetailSheetProps) {
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const { data: lists } = useTaskLists()
  const estadoOptions = lists?.estado ?? []

  if (!task) return null

  const handleStatusChange = async (newEstado: string) => {
    if (!onStatusChange || newEstado === task.estado) return
    setIsChangingStatus(true)
    setStatusError(null)
    try {
      await onStatusChange(task.id, newEstado)
    } catch {
      setStatusError("Error al cambiar el estado.")
    } finally {
      setIsChangingStatus(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Detalle de tarea</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Título</p>
            <p className="text-sm font-semibold text-gray-900">{task.titulo}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsable" value={task.subido_por_nombre} />
            <Field label="Fecha" value={task.fecha} />
            <Field label="Tiempo registrado" value={formatMinutos(task.tiempo_total_minutos)} />

            {/* Estado — inline changer if onStatusChange provided */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Estado</p>
              {onStatusChange && estadoOptions.length > 0 ? (
                <div className="space-y-1">
                  <select
                    value={task.estado}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={isChangingStatus}
                    className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
                  >
                    {estadoOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                        {opt.is_final ? " 🏁" : opt.is_canceled ? " ✕" : ""}
                      </option>
                    ))}
                  </select>
                  {statusError && <p className="text-xs text-red-500">{statusError}</p>}
                  {isChangingStatus && <p className="text-xs text-gray-400">Guardando...</p>}
                </div>
              ) : (
                <span className={`${taskBadge} ${ESTADO_COLOR[task.estado] ?? "bg-gray-100 text-gray-600"}`}>
                  {ESTADO_LABELS[task.estado] ?? task.estado}
                </span>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Etiqueta</p>
              <span className={`${taskBadge} ${ETIQUETA_COLOR[task.etiqueta] ?? "bg-gray-100 text-gray-600"}`}>
                {ETIQUETA_LABELS[task.etiqueta] ?? task.etiqueta}
              </span>
            </div>
            <Field label="Plataforma" value={PLATAFORMA_LABELS[task.plataforma] ?? task.plataforma} />
          </div>

          {task.hora_inicio && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hora inicio" value={formatHora(task.hora_inicio)} />
              {task.hora_cierre && (
                <Field label="Hora cierre" value={formatHora(task.hora_cierre)} />
              )}
            </div>
          )}

          {task.descripcion_tecnica && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Descripción técnica</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {task.descripcion_tecnica}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  )
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}
```

- [ ] **Step 2: Wire onStatusChange in TaskManagerView.tsx**

In `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`:

Add `useUpdateManagerTask` to the imports:

```typescript
import {
  useTeamTasks,
  useTeamKpis,
  useUsersWithoutTodayEntry,
  useCreateWorkTask,
  useUpdateManagerTask,
} from "@/hooks/useWorkTasks"
```

Add the hook call inside `TaskManagerView`:

```typescript
  const updateManagerTask = useUpdateManagerTask()
```

Update the `<TaskDetailSheet>` usage to pass `onStatusChange`:

```tsx
      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={async (taskId, newEstado) => {
          await updateManagerTask.mutateAsync({ id: taskId, payload: { estado: newEstado } })
          setSelectedTask((prev) => prev ? { ...prev, estado: newEstado } : null)
        }}
      />
```

- [ ] **Step 3: Wire onStatusChange in TaskSubmitView.tsx**

In `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx`, add `useUpdateWorkTask` to imports:

```typescript
import {
  useMyTasks,
  useMyTaskMetrics,
  useCreateWorkTask,
  useUpdateWorkTask,
} from "@/hooks/useWorkTasks"
```

Add the hook call:

```typescript
  const updateTask = useUpdateWorkTask()
```

Update `<TaskDetailSheet>`:

```tsx
      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChange={async (taskId, newEstado) => {
          await updateTask.mutateAsync({ id: taskId, payload: { estado: newEstado } })
          setSelectedTask((prev) => prev ? { ...prev, estado: newEstado } : null)
        }}
      />
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd C:/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx \
        frontend/src/components/herramientas/tareas/TaskManagerView.tsx \
        frontend/src/components/herramientas/tareas/TaskSubmitView.tsx
git commit -m "feat(tareas-v3): TaskDetailSheet inline status changer for manager + collaborator"
```

---

## Task 7: Frontend — EventDetailSheet (New Component)

**Files:**
- Create: `frontend/src/components/herramientas/tareas/EventDetailSheet.tsx`

- [ ] **Step 1: Create EventDetailSheet.tsx**

Create `frontend/src/components/herramientas/tareas/EventDetailSheet.tsx`:

```tsx
import { useState } from "react"
import { X, Trash2, UserPlus, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import type { TaskEvent, TaskTeamMember, AvailableUser } from "@/types/workTask"
import {
  useDeleteEvent,
  useUpdateEventParticipants,
  useTeamMembers,
  useAvailableTeamUsers,
  useTaskLists,
} from "@/hooks/useWorkTasks"
import { useAuthStore } from "@/store/authStore"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  event: TaskEvent | null
  onClose: () => void
  isManager?: boolean
}

export function EventDetailSheet({ event, onClose, isManager = false }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [showAddParticipants, setShowAddParticipants] = useState(false)
  const [selectedAddIds, setSelectedAddIds] = useState<number[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [participantError, setParticipantError] = useState<string | null>(null)

  const deleteEvent = useDeleteEvent()
  const updateParticipants = useUpdateEventParticipants()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: allUsers = [] } = useAvailableTeamUsers()
  const { data: lists } = useTaskLists()

  if (!event) return null

  const prioridadLabel =
    lists?.prioridad_agenda?.find((p) => p.value === event.prioridad)?.label ?? event.prioridad

  const canModify = isManager || event.creado_por_id === currentUserId

  const existingIds = new Set(event.participants.map((p) => p.user_id))

  const toggleAdd = (id: number) => {
    setSelectedAddIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleDelete = async () => {
    if (!confirm("¿Seguro que quieres cancelar este evento? Esta acción no se puede deshacer.")) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteEvent.mutateAsync(event.id)
      onClose()
    } catch {
      setDeleteError("Error al cancelar el evento.")
      setIsDeleting(false)
    }
  }

  const handleRemoveParticipant = async (userId: number) => {
    setParticipantError(null)
    try {
      await updateParticipants.mutateAsync({ eventId: event.id, addIds: [], removeIds: [userId] })
    } catch {
      setParticipantError("Error al eliminar participante.")
    }
  }

  const handleAddParticipants = async () => {
    if (selectedAddIds.length === 0) return
    setParticipantError(null)
    try {
      await updateParticipants.mutateAsync({ eventId: event.id, addIds: selectedAddIds, removeIds: [] })
      setSelectedAddIds([])
      setShowAddParticipants(false)
    } catch {
      setParticipantError("Error al agregar participantes.")
    }
  }

  const formatFecha = (fecha: string) => {
    try {
      return format(new Date(fecha + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })
    } catch {
      return fecha
    }
  }

  const endTime = (() => {
    try {
      const [h, m] = event.hora_inicio.split(":").map(Number)
      const total = h * 60 + m + event.duracion_minutos
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    } catch {
      return ""
    }
  })()

  const availableToAdd = [...teamMembers.map((m: TaskTeamMember) => ({
    id: m.user_id,
    label: m.user_full_name ?? m.user_email,
  })), ...allUsers.filter((u: AvailableUser) => !teamMembers.some((m: TaskTeamMember) => m.user_id === u.id)).map((u: AvailableUser) => ({
    id: u.id,
    label: u.full_name ?? u.email,
  }))].filter((u) => !existingIds.has(u.id))

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full bg-background border-l border-border shadow-xl z-50 flex flex-col
        transition-transform duration-300 ease-in-out w-full max-w-sm`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base line-clamp-1">{event.titulo}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Date + time */}
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-1">
            <p className="text-sm font-medium capitalize">{formatFecha(event.fecha)}</p>
            <p className="text-xs text-muted-foreground">
              {event.hora_inicio} — {endTime} ({event.duracion_minutos} min)
            </p>
          </div>

          {/* Priority + Platform */}
          <div className="flex flex-wrap gap-2">
            {event.prioridad && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-800 font-medium">
                {prioridadLabel}
              </span>
            )}
            {event.plataforma && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-700">
                {event.plataforma}
              </span>
            )}
          </div>

          {/* Description */}
          {event.descripcion && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Descripción</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{event.descripcion}</p>
            </div>
          )}

          {/* Organizer */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Organizado por</p>
            <p className="text-sm">{event.creado_por_nombre}</p>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Participantes ({event.participants.length})
              </p>
              {canModify && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setShowAddParticipants((v) => !v)}
                >
                  <UserPlus className="w-3 h-3" />
                  Agregar
                  {showAddParticipants ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
              )}
            </div>

            <div className="space-y-1">
              {event.participants.map((p) => (
                <div
                  key={p.user_id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm ${
                    p.has_conflict ? "bg-amber-50 border border-amber-200" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.has_conflict && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    <span className="truncate">{p.user_nombre}</span>
                  </div>
                  {canModify && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.user_id)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-2 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Conflict details */}
            {event.participants.some((p) => p.has_conflict) && (
              <div className="mt-2 space-y-1">
                {event.participants.filter((p) => p.has_conflict).map((p) => (
                  <p key={p.user_id} className="text-xs text-amber-700">
                    <strong>{p.user_nombre}:</strong> {p.conflict_detail}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Add participants panel */}
          {showAddParticipants && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Agregar participantes</p>
              <Tabs defaultValue="equipo">
                <TabsList className="w-full">
                  <TabsTrigger value="equipo" className="flex-1 text-xs">Equipo</TabsTrigger>
                  <TabsTrigger value="todos" className="flex-1 text-xs">Todos</TabsTrigger>
                </TabsList>
                <TabsContent value="equipo">
                  <AddUserList
                    users={availableToAdd.filter((u) =>
                      teamMembers.some((m: TaskTeamMember) => m.user_id === u.id)
                    )}
                    selected={selectedAddIds}
                    onToggle={toggleAdd}
                  />
                </TabsContent>
                <TabsContent value="todos">
                  <AddUserList
                    users={availableToAdd}
                    selected={selectedAddIds}
                    onToggle={toggleAdd}
                  />
                </TabsContent>
              </Tabs>
              {selectedAddIds.length > 0 && (
                <Button size="sm" className="w-full text-xs" onClick={handleAddParticipants}>
                  Agregar {selectedAddIds.length} participante{selectedAddIds.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}

          {participantError && <p className="text-xs text-destructive">{participantError}</p>}
        </div>

        {/* Footer — cancel event */}
        {canModify && (
          <div className="px-5 py-4 border-t border-border shrink-0">
            {deleteError && <p className="text-xs text-destructive mb-2">{deleteError}</p>}
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Cancelando..." : "Cancelar evento"}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function AddUserList({
  users,
  selected,
  onToggle,
}: {
  users: { id: number; label: string }[]
  selected: number[]
  onToggle: (id: number) => void
}) {
  if (users.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">Sin usuarios disponibles.</p>
  }
  return (
    <div className="space-y-1 max-h-36 overflow-y-auto mt-2 rounded-md border border-border p-2">
      {users.map((u) => (
        <label
          key={u.id}
          className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <input
            type="checkbox"
            checked={selected.includes(u.id)}
            onChange={() => onToggle(u.id)}
            className="accent-primary"
          />
          <span className="text-xs">{u.label}</span>
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd C:/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/herramientas/tareas/EventDetailSheet.tsx
git commit -m "feat(tareas-v3): EventDetailSheet — ver descripción, cancelar, agregar/quitar participantes"
```

---

## Task 8: Frontend — Wiring, ScheduleSheet Priority, Calendar Resize Fix

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx`
- Modify: `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx`
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

- [ ] **Step 1: Fix CalendarSidebar resize bug**

In `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx`:

1. Change the `aside` className to replace `transition-all` with `transition-[width,opacity]` and add `overflow-x-hidden`.
2. Change the inner `<div className="flex flex-col h-full">` to add `w-full`.

Replace the `<aside>` opening tag and the inner div (lines 80-95):

```tsx
  return (
    <aside
      className={`border-l border-border bg-background flex flex-col relative overflow-x-hidden ${
        !isDragging ? "transition-[width,opacity] duration-300 ease-in-out" : ""
      } ${isOpen ? "opacity-100" : "opacity-0 overflow-hidden border-l-0"}`}
      style={{ width: isOpen ? sidebarWidth : 0 }}
    >
      {isOpen && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 transition-colors -translate-x-1/2 ${
            isDragging ? "bg-primary/40" : "bg-transparent hover:bg-primary/20"
          }`}
          onMouseDown={startResizing}
        />
      )}

      <div className="flex flex-col h-full w-full">
```

- [ ] **Step 2: Add priority field to ScheduleSheet.tsx**

In `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx`:

1. Add `prioridad` state after `plataforma` state:
```tsx
  const [prioridad, setPrioridad] = useState("")
```

2. In the `lists` destructuring line (around line 52), add `prioridad_agenda`:
```tsx
  const plataformas = lists?.plataforma ?? []
  const prioridadesAgenda = lists?.prioridad_agenda ?? []
```

3. In the reset effect (inside the `!isOpen` block), add:
```tsx
      setPrioridad("")
```

4. In `createEvent.mutateAsync(...)` payload, add:
```tsx
      await createEvent.mutateAsync({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        plataforma: plataforma || undefined,
        prioridad: prioridad || undefined,
        fecha,
        hora_inicio: horaInicio,
        duracion_minutos: parseInt(duracion, 10) || 60,
        participant_ids: selectedIds,
      })
```

5. Add priority select field in the form JSX, after the Plataforma section and before the Participantes section:

```tsx
            {/* Prioridad */}
            {prioridadesAgenda.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="sch-prioridad">Prioridad (opcional)</Label>
                <select
                  id="sch-prioridad"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Sin prioridad</option>
                  {prioridadesAgenda.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
```

6. Change `canSelectOthers` behavior: the user picker should always show for any user who has TOOL_SUBMIT. In the JSX section for Participantes (around line 222), remove the `!canSelectOthers` check and always show the `Tabs`:

Replace the participantes section:
```tsx
            {/* Participantes */}
            <div className="space-y-1.5">
              <Label>Participantes</Label>
              <Tabs defaultValue="equipo">
                <TabsList className="w-full">
                  <TabsTrigger value="equipo" className="flex-1">
                    Equipo ({teamMembers.length})
                  </TabsTrigger>
                  <TabsTrigger value="todos" className="flex-1">
                    Todos ({allUsers.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="equipo">
                  <UserPickerList
                    users={teamMembers.map((m: TaskTeamMember) => ({
                      id: m.user_id,
                      label: m.user_full_name ?? m.user_email,
                    }))}
                    selected={selectedIds}
                    onToggle={toggleUser}
                  />
                </TabsContent>

                <TabsContent value="todos">
                  <UserPickerList
                    users={allUsers.map((u: AvailableUser) => ({
                      id: u.id,
                      label: u.full_name ?? u.email,
                    }))}
                    selected={selectedIds}
                    onToggle={toggleUser}
                  />
                </TabsContent>
              </Tabs>
            </div>
```

Also update the `selectedIds` initialization to always start with the current user if no one selected:
```tsx
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    currentUserId != null ? [currentUserId] : []
  )
```

And remove the `canSelectOthers` prop usage from the `useEffect` that syncs userId (it's no longer conditional):
```tsx
  useEffect(() => {
    if (currentUserId != null && selectedIds.length === 0) {
      setSelectedIds([currentUserId])
    }
  }, [currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps
```

And in reset effect, always reset to current user:
```tsx
      setSelectedIds(currentUserId ? [currentUserId] : [])
```

- [ ] **Step 3: Wire EventDetailSheet in GestionTareasPage.tsx**

In `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`:

1. Add import for `EventDetailSheet`:
```tsx
import { EventDetailSheet } from "@/components/herramientas/tareas/EventDetailSheet"
```

2. Add state for selected event:
```tsx
  const [selectedEvent, setSelectedEvent] = useState<import("@/types/workTask").TaskEvent | null>(null)
```

3. Update `canSelectOthers` passed to `ScheduleSheet` (it's now irrelevant but we can remove the prop entirely since ScheduleSheet no longer uses it — or just keep it as `true`). Since we removed the `canSelectOthers` guard from ScheduleSheet, we can remove the prop from GestionTareasPage too. Remove `canSelectOthers={canManage}` from `<ScheduleSheet>`.

4. Replace `onEventClick={() => {}}` in `<CalendarSidebar>` with:
```tsx
          onEventClick={(event) => setSelectedEvent(event)}
```

5. Add `<EventDetailSheet>` before the closing `</PageLayout>` tag:
```tsx
      <EventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        isManager={canManage}
      />
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd C:/zymo-intranet/frontend
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/herramientas/tareas/CalendarSidebar.tsx \
        frontend/src/components/herramientas/tareas/ScheduleSheet.tsx \
        frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
git commit -m "feat(tareas-v3): calendar resize fix, ScheduleSheet priority + open scheduling, wire EventDetailSheet"
```
