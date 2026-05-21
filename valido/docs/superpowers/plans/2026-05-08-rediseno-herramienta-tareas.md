# Rediseño Herramienta de Gestión de Tareas — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la herramienta de gestión de tareas para simplificar el modelo de acceso, agregar agenda con detección de conflictos, paginación real, historial de actividad, y una interfaz profesional basada en shadcn/ui integrada al design system de la intranet.

**Architecture:** Fase 1 establece la fundación de datos y lógica (3 tablas nuevas en BD, endpoints paginados, modelo de acceso simplificado). Fase 2 instala shadcn/ui sobre Tailwind existente y reconstruye la UI con el nuevo diseño de tabs + calendario lateral + modal centrado, sin tocar la lógica de Fase 1.

**Tech Stack:** FastAPI + SQLModel (backend), React 19 + TypeScript + TanStack Query v5 + Tailwind CSS 3 + shadcn/ui (Fase 2), Recharts, Vite

---

## CONTEXTO CRÍTICO PARA EL IMPLEMENTADOR

### Modelo de acceso ACTUAL (roto)
- `tool_task_submit_dev` → colaboradores (asignada por admin manualmente, scope incorrecto)
- `tool_task_manage_dev` → gestores (asignada por admin)
- **Problema:** dos pasos separados (asignar herramienta + agregar al equipo), scope default "global" en vez de "desarrollo_innovacion", admin no puede registrar sus propias tareas

### Modelo de acceso NUEVO (simple)
- Solo `tool_task_manage_dev` se asigna manualmente (al gestor/líder)
- El gestor agrega miembros al equipo desde la herramienta
- Estar en el equipo = acceso automático para cargar tareas (sin herramienta separada)
- `tool_task_submit_dev` deja de ser asignable externamente

### Dos tipos de registros distintos
1. **Tarea diaria** (`work_tasks`): mide tiempo productivo, tiene etiqueta/plataforma/hora inicio-cierre → para gráficas de productividad
2. **Evento de agenda** (`task_events`): reuniones futuras, tiene participantes múltiples, duración estimada → eventualmente correos y actas

### Vistas por rol
- **Colaborador** (miembro del equipo): Tab Tareas (solo las propias) + Tab Gráficas (propias) + Calendario lateral
- **Gestor** (tool_task_manage_dev): Todo lo anterior + ver tareas del equipo completo + Tab Configuración del equipo + puede agendar para otros

### Base de datos
Todas las tablas de tareas viven en `intranet.db` (SQLite). Engine configurado en `backend/app/database.py`. Los modelos se importan en `create_db_and_tables()`.

---

## FASE 1: Fundación — BD, Backend y Lógica de Acceso

### Archivos creados/modificados en Fase 1

| Archivo | Tipo | Qué cambia |
|---|---|---|
| `backend/app/models/task_event.py` | Crear | Modelo TaskEvent (reuniones de agenda) |
| `backend/app/models/task_event_participant.py` | Crear | Modelo TaskEventParticipant (participantes + has_conflict) |
| `backend/app/models/task_activity_log.py` | Crear | Modelo TaskActivityLog (historial de cambios) |
| `backend/app/models/__init__.py` | Modificar | Exportar nuevos modelos |
| `backend/app/database.py` | Modificar | Importar nuevos modelos para crear tablas |
| `backend/app/schemas/task_event.py` | Crear | Schemas Pydantic para eventos de agenda |
| `backend/app/schemas/work_task.py` | Modificar | Añadir PaginatedResponse, PaginatedTaskFilters |
| `backend/app/services/user_tool_service.py` | Modificar | Lógica: miembro de equipo = acceso submit |
| `backend/app/services/work_task_service.py` | Modificar | Paginación, activity log al crear/actualizar |
| `backend/app/services/task_dashboard_service.py` | Modificar | KPIs con scope dinámico (equipo vs propio) |
| `backend/app/services/task_event_service.py` | Crear | CRUD de eventos + detección de conflictos |
| `backend/app/routers/herramientas_tareas.py` | Modificar | Endpoints paginados, agenda endpoints, acceso simplificado |
| `frontend/src/lib/permissions.ts` | Modificar | Nueva lógica: miembro equipo = canSubmit |
| `frontend/src/hooks/useWorkTasks.ts` | Modificar | Hooks paginados, hooks de agenda, invalidar ["me"] |
| `frontend/src/types/workTask.ts` | Modificar | Tipos paginados, TaskEvent, TaskEventParticipant |
| `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` | Modificar | Usar nueva lógica de permisos |
| `frontend/src/store/authStore.ts` | Leer/verificar | Confirmar cómo se almacena user_tools y team_member |

---

### Task 1.1: Nuevos modelos de BD — task_events y task_event_participants

**Files:**
- Create: `backend/app/models/task_event.py`
- Create: `backend/app/models/task_event_participant.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Crear `task_event.py`**

```python
# backend/app/models/task_event.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    scope: str = Field(max_length=100, index=True)          # "desarrollo_innovacion"
    team_id: Optional[int] = Field(default=None)             # FK a task_teams.id
    titulo: str = Field(max_length=250)
    descripcion: Optional[str] = Field(default=None)
    fecha: str = Field(index=True)                           # "YYYY-MM-DD" — sin timezone
    hora_inicio: str = Field(max_length=5)                   # "HH:MM"
    duracion_minutos: int = Field(default=60)
    creado_por_id: int = Field(index=True)
    creado_por_nombre: str = Field(max_length=200)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Crear `task_event_participant.py`**

```python
# backend/app/models/task_event_participant.py
from __future__ import annotations
from sqlmodel import SQLModel, Field
from typing import Optional


class TaskEventParticipant(SQLModel, table=True):
    __tablename__ = "task_event_participants"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(index=True)          # FK a task_events.id
    user_id: int = Field(index=True)           # FK a users.id
    user_nombre: str = Field(max_length=200)   # snapshot desnormalizado
    has_conflict: bool = Field(default=False)  # True si ya tiene evento en ese horario
    conflict_detail: Optional[str] = Field(default=None, max_length=300)  # "Choca con: <titulo> a las HH:MM"
```

- [ ] **Step 3: Importar modelos en `database.py`**

Abre `backend/app/database.py`. Busca el bloque de imports de modelos (busca `from app.models` o donde están los imports que aseguran la creación de tablas). Añade al final de ese bloque:

```python
from app.models.task_event import TaskEvent          # noqa: F401
from app.models.task_event_participant import TaskEventParticipant  # noqa: F401
```

- [ ] **Step 4: Verificar que las tablas se crean**

```bash
docker compose exec backend python -c "
from app.database import create_db_and_tables
create_db_and_tables()
print('OK')
"
```
Expected: `OK` sin errores.

- [ ] **Step 5: Commit**

```bash
git -C /c/zymo-intranet add backend/app/models/task_event.py backend/app/models/task_event_participant.py backend/app/database.py
git -C /c/zymo-intranet commit -m "feat(tareas): nuevas tablas task_events y task_event_participants"
```

---

### Task 1.2: Modelo de BD — task_activity_log

**Files:**
- Create: `backend/app/models/task_activity_log.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Crear `task_activity_log.py`**

```python
# backend/app/models/task_activity_log.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class TaskActivityLog(SQLModel, table=True):
    __tablename__ = "task_activity_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(index=True)            # FK a work_tasks.id
    user_id: int
    user_nombre: str = Field(max_length=200)
    accion: str = Field(max_length=50)          # "creacion", "cambio_estado", "edicion"
    detalle: Optional[str] = Field(default=None, max_length=400)  # "De en_progreso a completada"
    fecha: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 2: Añadir import en `database.py`**

```python
from app.models.task_activity_log import TaskActivityLog  # noqa: F401
```

- [ ] **Step 3: Verificar**

```bash
docker compose exec backend python -c "
from app.database import create_db_and_tables
create_db_and_tables()
print('OK')
"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git -C /c/zymo-intranet add backend/app/models/task_activity_log.py backend/app/database.py
git -C /c/zymo-intranet commit -m "feat(tareas): nueva tabla task_activity_log para historial de cambios"
```

---

### Task 1.3: Schemas — Paginación y TaskEvent

**Files:**
- Modify: `backend/app/schemas/work_task.py`
- Create: `backend/app/schemas/task_event.py`

- [ ] **Step 1: Añadir schemas de paginación en `work_task.py`**

Lee el archivo actual. Al final, añade:

```python
# --- Paginación ---

class PaginatedTaskFilters(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=10, ge=1, le=100)
    search: Optional[str] = None
    responsable_id: Optional[int] = None
    estado: Optional[str] = None
    etiqueta: Optional[str] = None
    plataforma: Optional[str] = None
    fecha_exacta: Optional[str] = None    # "YYYY-MM-DD" — filtra el calendario
    fecha_desde: Optional[str] = None
    fecha_hasta: Optional[str] = None

class PaginatedMeta(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    limit: int

class PaginatedTasksResponse(BaseModel):
    data: list[WorkTaskRead]
    meta: PaginatedMeta
```

- [ ] **Step 2: Crear `task_event.py`**

```python
# backend/app/schemas/task_event.py
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class TaskEventParticipantRead(BaseModel):
    user_id: int
    user_nombre: str
    has_conflict: bool
    conflict_detail: Optional[str] = None


class TaskEventCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha: str                         # "YYYY-MM-DD"
    hora_inicio: str                   # "HH:MM"
    duracion_minutos: int = 60
    participant_ids: list[int]         # IDs de usuarios participantes


class TaskEventRead(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    fecha: str
    hora_inicio: str
    duracion_minutos: int
    creado_por_id: int
    creado_por_nombre: str
    participants: list[TaskEventParticipantRead] = []

    class Config:
        from_attributes = True


class TaskActivityLogRead(BaseModel):
    id: int
    task_id: int
    user_id: int
    user_nombre: str
    accion: str
    detalle: Optional[str] = None
    fecha: str                        # ISO string

    class Config:
        from_attributes = True
```

- [ ] **Step 3: Verificar sintaxis**

```bash
docker compose exec backend python -c "
from app.schemas.work_task import PaginatedTasksResponse, PaginatedTaskFilters
from app.schemas.task_event import TaskEventCreate, TaskEventRead, TaskActivityLogRead
print('schemas OK')
"
```
Expected: `schemas OK`

- [ ] **Step 4: Commit**

```bash
git -C /c/zymo-intranet add backend/app/schemas/work_task.py backend/app/schemas/task_event.py
git -C /c/zymo-intranet commit -m "feat(tareas): schemas paginación y TaskEvent/ActivityLog"
```

---

### Task 1.4: Simplificar modelo de acceso en `user_tool_service.py`

**Files:**
- Modify: `backend/app/services/user_tool_service.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

La nueva regla: un usuario puede hacer submit si tiene `tool_task_submit_dev` **O** si es miembro activo del equipo `desarrollo_innovacion`.

- [ ] **Step 1: Leer el archivo actual completo**

```bash
cat /c/zymo-intranet/backend/app/services/user_tool_service.py
```

- [ ] **Step 2: Modificar `require_tool_or_403` para aceptar membresía de equipo**

Busca la función `require_tool_or_403`. Reemplaza su cuerpo completo por:

```python
def require_tool_or_403(
    db: "Session",
    user: "User",
    tool_key: str,
    scope: str,
) -> None:
    """
    Permite acceso si el usuario:
    - Es admin (bypass total), O
    - Tiene la tool activa en user_tools, O
    - Es miembro activo del equipo (para tool_task_submit_dev)
    """
    from app.models.task_team_member import TaskTeamMember
    from app.models.task_team import TaskTeam
    from sqlmodel import select

    if getattr(user, "role", None) == "admin":
        return

    # Verificar tool directa
    record = db.exec(
        select(UserTool).where(
            UserTool.user_id == user.id,
            UserTool.tool_key == tool_key,
            UserTool.scope == scope,
            UserTool.is_active == True,  # noqa: E712
        )
    ).first()
    if record:
        return

    # Para submit: membresía activa en el equipo también da acceso
    if tool_key == "tool_task_submit_dev":
        team = db.exec(
            select(TaskTeam).where(
                TaskTeam.scope == scope,
                TaskTeam.is_active == True,  # noqa: E712
            )
        ).first()
        if team:
            member = db.exec(
                select(TaskTeamMember).where(
                    TaskTeamMember.team_id == team.id,
                    TaskTeamMember.user_id == user.id,
                    TaskTeamMember.is_active == True,  # noqa: E712
                )
            ).first()
            if member:
                return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Acceso denegado. Se requiere herramienta '{tool_key}' o membresía en el equipo.",
    )
```

- [ ] **Step 3: Verificar que el archivo importa HTTPException y status**

Busca al inicio del archivo si ya están estos imports. Si no, añádelos:

```python
from fastapi import HTTPException, status
```

- [ ] **Step 4: Verificar sintaxis**

```bash
docker compose exec backend python -c "
from app.services.user_tool_service import require_tool_or_403
print('OK')
"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git -C /c/zymo-intranet add backend/app/services/user_tool_service.py
git -C /c/zymo-intranet commit -m "feat(tareas): membresía de equipo otorga acceso submit automáticamente"
```

---

### Task 1.5: Refactorizar `work_task_service.py` — paginación y activity log

**Files:**
- Modify: `backend/app/services/work_task_service.py`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat /c/zymo-intranet/backend/app/services/work_task_service.py
```

- [ ] **Step 2: Añadir función `get_paginated_tasks`**

Al final del archivo añade:

```python
def get_paginated_tasks(
    db: "Session",
    user_id: int,
    scope: str,
    filters: "PaginatedTaskFilters",
    team_member_ids: list[int] | None = None,  # None = solo propias, lista = equipo
) -> "PaginatedTasksResponse":
    """
    Devuelve tareas paginadas con filtros.
    Si team_member_ids es None, filtra solo por user_id (vista colaborador).
    Si team_member_ids es lista, filtra por todos esos IDs (vista gestor).
    """
    from app.models.work_task import WorkTask
    from app.schemas.work_task import PaginatedTasksResponse, PaginatedMeta, WorkTaskRead
    from sqlmodel import select, func, or_
    import math

    query = select(WorkTask).where(WorkTask.scope == scope)

    if team_member_ids is not None:
        query = query.where(WorkTask.subido_por_id.in_(team_member_ids))
    else:
        query = query.where(WorkTask.subido_por_id == user_id)

    if filters.search:
        term = f"%{filters.search}%"
        query = query.where(
            or_(WorkTask.titulo.ilike(term), WorkTask.descripcion_tecnica.ilike(term))
        )
    if filters.responsable_id:
        query = query.where(WorkTask.subido_por_id == filters.responsable_id)
    if filters.estado:
        query = query.where(WorkTask.estado == filters.estado)
    if filters.etiqueta:
        query = query.where(WorkTask.etiqueta == filters.etiqueta)
    if filters.plataforma:
        query = query.where(WorkTask.plataforma == filters.plataforma)
    if filters.fecha_exacta:
        query = query.where(WorkTask.fecha == filters.fecha_exacta)
    if filters.fecha_desde:
        query = query.where(WorkTask.fecha >= filters.fecha_desde)
    if filters.fecha_hasta:
        query = query.where(WorkTask.fecha <= filters.fecha_hasta)

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total_items = db.exec(count_query).one()
    total_pages = max(1, math.ceil(total_items / filters.limit))

    # Paginar
    offset = (filters.page - 1) * filters.limit
    query = query.order_by(WorkTask.fecha.desc(), WorkTask.created_at.desc())
    query = query.offset(offset).limit(filters.limit)
    tasks = db.exec(query).all()

    return PaginatedTasksResponse(
        data=[WorkTaskRead.model_validate(t) for t in tasks],
        meta=PaginatedMeta(
            total_items=total_items,
            total_pages=total_pages,
            current_page=filters.page,
            limit=filters.limit,
        ),
    )
```

- [ ] **Step 3: Añadir función `log_activity`**

```python
def log_activity(
    db: "Session",
    task_id: int,
    user_id: int,
    user_nombre: str,
    accion: str,
    detalle: str | None = None,
) -> None:
    from app.models.task_activity_log import TaskActivityLog
    entry = TaskActivityLog(
        task_id=task_id,
        user_id=user_id,
        user_nombre=user_nombre,
        accion=accion,
        detalle=detalle,
    )
    db.add(entry)
    # No hace commit — el llamador es responsable del commit


def get_task_activity(db: "Session", task_id: int) -> list:
    from app.models.task_activity_log import TaskActivityLog
    from sqlmodel import select
    entries = db.exec(
        select(TaskActivityLog)
        .where(TaskActivityLog.task_id == task_id)
        .order_by(TaskActivityLog.fecha.asc())
    ).all()
    return entries
```

- [ ] **Step 4: Añadir log al crear tarea**

Busca la función existente que crea una tarea (algo como `create_task` o `create_work_task`). Después del `db.commit()` y antes del `return`, añade:

```python
log_activity(
    db,
    task_id=task.id,
    user_id=user_id,
    user_nombre=task.subido_por_nombre,
    accion="creacion",
    detalle=f"Tarea creada: {task.titulo}",
)
db.commit()
```

- [ ] **Step 5: Añadir log al actualizar estado**

Busca la función de actualización. Cuando el campo `estado` cambia, añade:

```python
if "estado" in update_data and update_data["estado"] != task.estado:
    log_activity(
        db,
        task_id=task.id,
        user_id=user_id,
        user_nombre=task.subido_por_nombre,
        accion="cambio_estado",
        detalle=f"De {task.estado} a {update_data['estado']}",
    )
```

- [ ] **Step 6: Verificar sintaxis**

```bash
docker compose exec backend python -c "
from app.services.work_task_service import get_paginated_tasks, log_activity, get_task_activity
print('OK')
"
```
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git -C /c/zymo-intranet add backend/app/services/work_task_service.py
git -C /c/zymo-intranet commit -m "feat(tareas): paginación real y activity log en work_task_service"
```

---

### Task 1.6: Crear `task_event_service.py` — CRUD agenda + detección de conflictos

**Files:**
- Create: `backend/app/services/task_event_service.py`

- [ ] **Step 1: Crear el archivo completo**

```python
# backend/app/services/task_event_service.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlmodel import Session
    from app.models.user import User
    from app.schemas.task_event import TaskEventCreate


_SCOPE = "desarrollo_innovacion"


def _parse_hhmm(hhmm: str) -> int:
    """Convierte 'HH:MM' a minutos desde medianoche."""
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _events_overlap(start1: int, dur1: int, start2: int, dur2: int) -> bool:
    """True si dos intervalos [start, start+dur) se solapan."""
    end1 = start1 + dur1
    end2 = start2 + dur2
    return start1 < end2 and start2 < end1


def create_event(
    db: "Session",
    creator: "User",
    payload: "TaskEventCreate",
) -> dict:
    """
    Crea un TaskEvent con sus participantes.
    Para cada participante verifica si tiene conflicto de horario en la misma fecha.
    Retorna el evento con la lista de participantes y sus flags de conflicto.
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from app.models.user import User as UserModel
    from sqlmodel import select

    event = TaskEvent(
        scope=_SCOPE,
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        fecha=payload.fecha,
        hora_inicio=payload.hora_inicio,
        duracion_minutos=payload.duracion_minutos,
        creado_por_id=creator.id,
        creado_por_nombre=creator.full_name,
    )
    db.add(event)
    db.flush()  # Obtener event.id sin hacer commit aún

    new_start = _parse_hhmm(payload.hora_inicio)
    new_dur = payload.duracion_minutos
    participants = []

    for uid in payload.participant_ids:
        user = db.get(UserModel, uid)
        if not user:
            continue

        # Buscar eventos existentes del usuario en la misma fecha
        existing = db.exec(
            select(TaskEvent)
            .join(TaskEventParticipant, TaskEvent.id == TaskEventParticipant.event_id)
            .where(
                TaskEventParticipant.user_id == uid,
                TaskEvent.fecha == payload.fecha,
                TaskEvent.id != event.id,
            )
        ).all()

        has_conflict = False
        conflict_detail = None
        for ex in existing:
            ex_start = _parse_hhmm(ex.hora_inicio)
            if _events_overlap(new_start, new_dur, ex_start, ex.duracion_minutos):
                has_conflict = True
                conflict_detail = f"Choca con: '{ex.titulo}' a las {ex.hora_inicio}"
                break

        participant = TaskEventParticipant(
            event_id=event.id,
            user_id=uid,
            user_nombre=user.full_name,
            has_conflict=has_conflict,
            conflict_detail=conflict_detail,
        )
        db.add(participant)
        participants.append(participant)

    db.commit()
    db.refresh(event)

    return {
        "event": event,
        "participants": participants,
    }


def get_events_by_date(db: "Session", fecha: str, user_id: int | None = None) -> list:
    """
    Devuelve eventos de una fecha.
    Si user_id es None → todos (vista gestor).
    Si user_id es int → solo los del usuario (vista colaborador).
    """
    from app.models.task_event import TaskEvent
    from app.models.task_event_participant import TaskEventParticipant
    from sqlmodel import select

    if user_id is None:
        events = db.exec(
            select(TaskEvent).where(
                TaskEvent.scope == _SCOPE,
                TaskEvent.fecha == fecha,
            ).order_by(TaskEvent.hora_inicio)
        ).all()
    else:
        events = db.exec(
            select(TaskEvent)
            .join(TaskEventParticipant, TaskEvent.id == TaskEventParticipant.event_id)
            .where(
                TaskEvent.scope == _SCOPE,
                TaskEvent.fecha == fecha,
                TaskEventParticipant.user_id == user_id,
            )
            .order_by(TaskEvent.hora_inicio)
        ).all()

    result = []
    for ev in events:
        parts = db.exec(
            select(TaskEventParticipant).where(TaskEventParticipant.event_id == ev.id)
        ).all()
        result.append({"event": ev, "participants": parts})
    return result
```

- [ ] **Step 2: Verificar sintaxis**

```bash
docker compose exec backend python -c "
from app.services.task_event_service import create_event, get_events_by_date
print('OK')
"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /c/zymo-intranet add backend/app/services/task_event_service.py
git -C /c/zymo-intranet commit -m "feat(tareas): task_event_service con CRUD de agenda y detección de conflictos"
```

---

### Task 1.7: Actualizar KPIs con scope dinámico

**Files:**
- Modify: `backend/app/services/task_dashboard_service.py`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat /c/zymo-intranet/backend/app/services/task_dashboard_service.py
```

- [ ] **Step 2: Modificar `get_team_kpis` para aceptar `member_ids` opcional**

Busca la función `get_team_kpis` (o similar). Añade el parámetro `member_ids: list[int] | None = None`:
- Si `member_ids` es `None` → comportamiento actual (equipo completo, para gestor)
- Si `member_ids` es `[user_id]` → filtra solo ese usuario (para colaborador viendo sus propias gráficas)

```python
def get_team_kpis(
    db: "Session",
    scope: str,
    member_ids: list[int] | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
) -> dict:
    from app.models.work_task import WorkTask
    from sqlmodel import select, func

    query = select(WorkTask).where(WorkTask.scope == scope)
    if member_ids is not None:
        query = query.where(WorkTask.subido_por_id.in_(member_ids))
    if fecha_desde:
        query = query.where(WorkTask.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.where(WorkTask.fecha <= fecha_hasta)

    tasks = db.exec(query).all()

    total = len(tasks)
    completadas = sum(1 for t in tasks if t.estado == "completada")
    en_progreso = sum(1 for t in tasks if t.estado == "en_progreso")
    bloqueadas = sum(1 for t in tasks if t.estado == "bloqueada")
    horas = sum((t.tiempo_total_minutos or 0) for t in tasks) / 60

    return {
        "total_tareas": total,
        "completadas": completadas,
        "en_progreso": en_progreso,
        "bloqueadas": bloqueadas,
        "horas_registradas": round(horas, 1),
    }
```

- [ ] **Step 3: Commit**

```bash
git -C /c/zymo-intranet add backend/app/services/task_dashboard_service.py
git -C /c/zymo-intranet commit -m "feat(tareas): KPIs con scope dinámico (equipo vs propio)"
```

---

### Task 1.8: Nuevos endpoints en el router

**Files:**
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Step 1: Leer el archivo actual**

```bash
wc -l /c/zymo-intranet/backend/app/routers/herramientas_tareas.py
cat /c/zymo-intranet/backend/app/routers/herramientas_tareas.py
```

- [ ] **Step 2: Reemplazar el endpoint GET `/mis-tareas` por endpoint paginado**

Busca el endpoint `GET /mis-tareas`. Reemplaza su implementación:

```python
@router.get("/mis-tareas", response_model=PaginatedTasksResponse)
def mis_tareas_paginadas(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    fecha_exacta: Optional[str] = Query(default=None),
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.schemas.work_task import PaginatedTaskFilters
    from app.services.work_task_service import get_paginated_tasks

    require_tool_or_403(db, current_user, "tool_task_submit_dev", "desarrollo_innovacion")

    filters = PaginatedTaskFilters(
        page=page, limit=limit, search=search, estado=estado,
        etiqueta=etiqueta, plataforma=plataforma,
        fecha_exacta=fecha_exacta, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )
    return get_paginated_tasks(db, current_user.id, "desarrollo_innovacion", filters)
```

- [ ] **Step 3: Añadir endpoint GET `/equipo/tareas-paginadas`**

```python
@router.get("/equipo/tareas-paginadas", response_model=PaginatedTasksResponse)
def equipo_tareas_paginadas(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    responsable_id: Optional[int] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    etiqueta: Optional[str] = Query(default=None),
    plataforma: Optional[str] = Query(default=None),
    fecha_exacta: Optional[str] = Query(default=None),
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.schemas.work_task import PaginatedTaskFilters
    from app.services.work_task_service import get_paginated_tasks
    from app.services.task_team_service import get_or_create_dev_team
    from app.models.task_team_member import TaskTeamMember
    from sqlmodel import select

    require_tool_or_403(db, current_user, "tool_task_manage_dev", "desarrollo_innovacion")

    team = get_or_create_dev_team(db)
    members = db.exec(
        select(TaskTeamMember).where(
            TaskTeamMember.team_id == team.id,
            TaskTeamMember.is_active == True,  # noqa: E712
        )
    ).all()
    member_ids = [m.user_id for m in members]

    filters = PaginatedTaskFilters(
        page=page, limit=limit, search=search, responsable_id=responsable_id,
        estado=estado, etiqueta=etiqueta, plataforma=plataforma,
        fecha_exacta=fecha_exacta, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
    )
    return get_paginated_tasks(db, current_user.id, "desarrollo_innovacion", filters, team_member_ids=member_ids)
```

- [ ] **Step 4: Añadir endpoints de agenda**

```python
@router.post("/agenda", response_model=None, status_code=201)
def crear_evento_agenda(
    payload: "TaskEventCreate",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.schemas.task_event import TaskEventCreate
    from app.services.task_event_service import create_event

    # Gestor puede crear para otros; colaborador solo puede crearse a sí mismo
    is_manager = user_has_tool(db, current_user, "tool_task_manage_dev", "desarrollo_innovacion")
    if not is_manager and getattr(current_user, "role", None) != "admin":
        # Solo puede incluirse a sí mismo
        if payload.participant_ids != [current_user.id]:
            raise HTTPException(status_code=403, detail="Solo el gestor puede agendar para otros miembros.")

    result = create_event(db, current_user, payload)
    return {"ok": True, "event_id": result["event"].id}


@router.get("/agenda/{fecha}", response_model=None)
def eventos_por_fecha(
    fecha: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """fecha formato YYYY-MM-DD"""
    from app.services.task_event_service import get_events_by_date

    is_manager = user_has_tool(db, current_user, "tool_task_manage_dev", "desarrollo_innovacion")
    is_admin = getattr(current_user, "role", None) == "admin"

    if is_manager or is_admin:
        result = get_events_by_date(db, fecha, user_id=None)
    else:
        require_tool_or_403(db, current_user, "tool_task_submit_dev", "desarrollo_innovacion")
        result = get_events_by_date(db, fecha, user_id=current_user.id)

    return [
        {
            "id": r["event"].id,
            "titulo": r["event"].titulo,
            "descripcion": r["event"].descripcion,
            "fecha": r["event"].fecha,
            "hora_inicio": r["event"].hora_inicio,
            "duracion_minutos": r["event"].duracion_minutos,
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

- [ ] **Step 5: Añadir endpoint de historial de tarea**

```python
@router.get("/{task_id}/historial", response_model=None)
def historial_tarea(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.work_task_service import get_task_activity
    from app.models.work_task import WorkTask

    task = db.get(WorkTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")

    # Solo el dueño o el gestor/admin puede ver el historial
    is_manager = user_has_tool(db, current_user, "tool_task_manage_dev", "desarrollo_innovacion")
    is_admin = getattr(current_user, "role", None) == "admin"
    if not is_manager and not is_admin and task.subido_por_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso.")

    logs = get_task_activity(db, task_id)
    return [
        {
            "id": log.id,
            "user_nombre": log.user_nombre,
            "accion": log.accion,
            "detalle": log.detalle,
            "fecha": log.fecha.isoformat(),
        }
        for log in logs
    ]
```

- [ ] **Step 6: Verificar que el servidor arranca**

```bash
docker compose restart backend
sleep 3
docker compose logs backend --tail=20
```
Expected: Sin errores de importación, servidor levantado.

- [ ] **Step 7: Commit**

```bash
git -C /c/zymo-intranet add backend/app/routers/herramientas_tareas.py
git -C /c/zymo-intranet commit -m "feat(tareas): endpoints paginados, agenda y historial"
```

---

### Task 1.9: Actualizar tipos y hooks en el frontend — nueva lógica

**Files:**
- Modify: `frontend/src/types/workTask.ts`
- Modify: `frontend/src/lib/permissions.ts`
- Modify: `frontend/src/hooks/useWorkTasks.ts`

- [ ] **Step 1: Añadir tipos nuevos en `workTask.ts`**

Al final del archivo añade:

```typescript
// --- Paginación ---
export interface PaginatedMeta {
  total_items: number
  total_pages: number
  current_page: number
  limit: number
}

export interface PaginatedTasksResponse {
  data: WorkTask[]
  meta: PaginatedMeta
}

export interface PaginatedTaskFilters {
  page?: number
  limit?: number
  search?: string
  responsable_id?: number
  estado?: string
  etiqueta?: string
  plataforma?: string
  fecha_exacta?: string
  fecha_desde?: string
  fecha_hasta?: string
}

// --- Agenda ---
export interface TaskEventParticipant {
  user_id: number
  user_nombre: string
  has_conflict: boolean
  conflict_detail?: string
}

export interface TaskEvent {
  id: number
  titulo: string
  descripcion?: string
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  creado_por_nombre: string
  participants: TaskEventParticipant[]
}

export interface TaskEventCreate {
  titulo: string
  descripcion?: string
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  participant_ids: number[]
}

// --- Historial ---
export interface TaskActivityEntry {
  id: number
  user_nombre: string
  accion: string
  detalle?: string
  fecha: string
}
```

- [ ] **Step 2: Actualizar `permissions.ts`**

Lee el archivo actual. Busca `canSubmitDevTasks`. Reemplaza la función:

```typescript
/**
 * Puede registrar tareas si:
 * - Tiene tool_task_submit_dev, O
 * - Es miembro del equipo (is_team_member = true en el usuario)
 */
export function canSubmitDevTasks(
  userTools: string[],
  isTeamMember?: boolean
): boolean {
  return userTools.includes("tool_task_submit_dev") || isTeamMember === true
}

/**
 * Puede gestionar (ver dashboard del equipo, configurar) si:
 * - Tiene tool_task_manage_dev, O
 * - Es admin
 */
export function canManageDevTasks(userTools: string[], role?: string): boolean {
  return userTools.includes("tool_task_manage_dev") || role === "admin"
}
```

- [ ] **Step 3: Añadir hooks de agenda e historial en `useWorkTasks.ts`**

Al final del archivo:

```typescript
// --- Hooks de Agenda ---

export function useEventsByDate(fecha: string | null) {
  return useQuery<TaskEvent[]>({
    queryKey: ["tareas", "agenda", fecha],
    queryFn: async () => {
      const { data } = await api.get<TaskEvent[]>(
        `/api/herramientas/tareas/agenda/${fecha}`
      )
      return data
    },
    enabled: !!fecha,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TaskEventCreate) => {
      const { data } = await api.post("/api/herramientas/tareas/agenda", payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "agenda"] })
    },
  })
}

// --- Historial de tarea ---

export function useTaskActivity(taskId: number | null) {
  return useQuery<TaskActivityEntry[]>({
    queryKey: ["tareas", "historial", taskId],
    queryFn: async () => {
      const { data } = await api.get<TaskActivityEntry[]>(
        `/api/herramientas/tareas/${taskId}/historial`
      )
      return data
    },
    enabled: !!taskId,
  })
}

// --- Hooks paginados ---

export function useMyTasksPaginated(filters: PaginatedTaskFilters) {
  return useQuery<PaginatedTasksResponse>({
    queryKey: ["tareas", "mis-tareas-paginadas", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
      })
      const { data } = await api.get<PaginatedTasksResponse>(
        `/api/herramientas/tareas/mis-tareas?${params}`
      )
      return data
    },
  })
}

export function useTeamTasksPaginated(filters: PaginatedTaskFilters) {
  return useQuery<PaginatedTasksResponse>({
    queryKey: ["tareas", "equipo-paginadas", filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
      })
      const { data } = await api.get<PaginatedTasksResponse>(
        `/api/herramientas/tareas/equipo/tareas-paginadas?${params}`
      )
      return data
    },
  })
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /c/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: Sin errores en los archivos modificados.

- [ ] **Step 5: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/types/workTask.ts frontend/src/lib/permissions.ts frontend/src/hooks/useWorkTasks.ts
git -C /c/zymo-intranet commit -m "feat(tareas): tipos paginados, agenda, historial y permisos simplificados"
```

---

### Task 1.10: Actualizar `GestionTareasPage` — nueva lógica de acceso

**Files:**
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat /c/zymo-intranet/frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
```

- [ ] **Step 2: Actualizar la lógica de detección de rol**

La página debe pasar `user.is_team_member` (o una forma de saberlo) a `canSubmitDevTasks`. Por ahora usamos el mecanismo más simple: el usuario tiene acceso si `canSubmit || canManage`.

Reemplaza la lógica de detección al inicio del componente:

```tsx
const user = useAuthStore((s) => s.user)
const userTools: string[] = user?.user_tools ?? []
const role = user?.role

// Nueva lógica: canSubmit incluye membresía de equipo
// El flag is_team_member debe venir del backend en /auth/me
// Por ahora lo inferimos: si tiene algún access a la herramienta, puede submit
const canManage = canManageDevTasks(userTools, role)
const canSubmit = canSubmitDevTasks(userTools, user?.is_team_member)
const hasAnyAccess = canManage || canSubmit
```

- [ ] **Step 3: El gestor ve AMBAS vistas (manager + submit)**

Asegura que la lógica de render sea:

```tsx
if (!hasAnyAccess) {
  return <Navigate to="/dashboard" replace />
}

// Gestor ve TaskManagerView (que internamente también permite registrar sus propias tareas)
if (canManage) {
  return <TaskManagerView canSubmitOwn={true} />
}

// Colaborador ve TaskSubmitView
return <TaskSubmitView />
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /c/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | grep GestionTareasPage
```
Expected: Sin errores.

- [ ] **Step 5: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
git -C /c/zymo-intranet commit -m "feat(tareas): nueva lógica de acceso — gestor ve todo, miembro carga sus tareas"
```

---

### Task 1.11: Backend — exponer `is_team_member` en `/auth/me`

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Leer el endpoint `/auth/me`**

```bash
grep -n "user_tools\|is_team_member\|def me\|@router.get.*me" /c/zymo-intranet/backend/app/routers/auth.py | head -20
```

- [ ] **Step 2: Añadir `is_team_member` a la respuesta de `/auth/me`**

Busca la función que maneja `GET /auth/me`. En el dict/objeto que retorna, añade:

```python
# Verificar si el usuario es miembro activo del equipo de desarrollo
from app.models.task_team import TaskTeam
from app.models.task_team_member import TaskTeamMember
from sqlmodel import select as sql_select

team = db.exec(
    sql_select(TaskTeam).where(
        TaskTeam.scope == "desarrollo_innovacion",
        TaskTeam.is_active == True,  # noqa: E712
    )
).first()

is_team_member = False
if team:
    member = db.exec(
        sql_select(TaskTeamMember).where(
            TaskTeamMember.team_id == team.id,
            TaskTeamMember.user_id == current_user.id,
            TaskTeamMember.is_active == True,  # noqa: E712
        )
    ).first()
    is_team_member = member is not None
```

Y añade `"is_team_member": is_team_member` al response.

- [ ] **Step 3: Actualizar el tipo en el frontend**

En `frontend/src/store/authStore.ts` (o donde esté el tipo `User`), añadir:
```typescript
is_team_member?: boolean
```

- [ ] **Step 4: Invalidar `["me"]` cuando se agrega/quita un miembro del equipo**

En `frontend/src/hooks/useWorkTasks.ts`, busca `useAddTeamMember` y `useRemoveTeamMember`. En el `onSuccess` de cada uno, añade:
```typescript
qc.invalidateQueries({ queryKey: ["me"] })
```

Esto hace que el usuario vea la herramienta de inmediato cuando el gestor lo agrega al equipo.

- [ ] **Step 5: Verificar backend arranca**

```bash
docker compose restart backend && sleep 3 && docker compose logs backend --tail=10
```
Expected: Sin errores.

- [ ] **Step 6: Commit**

```bash
git -C /c/zymo-intranet add backend/app/routers/auth.py frontend/src/hooks/useWorkTasks.ts
git -C /c/zymo-intranet commit -m "feat(tareas): /auth/me expone is_team_member; invalidar me al cambiar equipo"
```

---

**FIN FASE 1** — En este punto el backend tiene toda la lógica nueva, la BD tiene las tablas, y el frontend está conectado. La UI sigue igual visualmente pero funciona con la nueva lógica.

---

## FASE 2: Rediseño Visual — shadcn/ui + Nueva Interfaz

### Archivos creados/modificados en Fase 2

| Archivo | Tipo | Qué cambia |
|---|---|---|
| `frontend/package.json` | Modificar | Añadir dependencias shadcn/ui |
| `frontend/tailwind.config.js` | Modificar | CSS variables + darkMode class + plugin animate |
| `frontend/src/index.css` | Modificar | Variables CSS de shadcn (colores, radios) mapeadas a brand-blue |
| `frontend/src/components/ui/button.tsx` | Crear | Button shadcn |
| `frontend/src/components/ui/badge.tsx` | Crear | Badge shadcn |
| `frontend/src/components/ui/input.tsx` | Crear | Input shadcn |
| `frontend/src/components/ui/label.tsx` | Crear | Label shadcn |
| `frontend/src/components/ui/textarea.tsx` | Crear | Textarea shadcn |
| `frontend/src/components/ui/tabs.tsx` | Crear | Tabs shadcn |
| `frontend/src/components/ui/dialog.tsx` | Crear | Dialog/Modal shadcn (para detalle de tarea) |
| `frontend/src/components/ui/select.tsx` | Crear | Select shadcn |
| `frontend/src/components/ui/card.tsx` | Crear | Card shadcn |
| `frontend/src/components/ui/pagination.tsx` | Crear | Pagination shadcn |
| `frontend/src/components/ui/calendar.tsx` | Crear | Calendar shadcn (con react-day-picker) |
| `frontend/src/lib/utils.ts` | Crear | `cn()` helper (clsx + tailwind-merge) |
| `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` | Reescribir | Layout tabs + calendario lateral |
| `frontend/src/components/herramientas/tareas/TaskTable.tsx` | Crear | Tabla paginada nueva con shadcn |
| `frontend/src/components/herramientas/tareas/TaskDetailModal.tsx` | Crear | Modal centrado con tabs (shadcn Dialog) |
| `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx` | Crear | Panel lateral resizable con calendario |
| `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx` | Crear | Sheet para agendar con multi-usuario |
| `frontend/src/components/herramientas/tareas/TaskKpisBar.tsx` | Crear | Barra de KPIs estilo bento |
| `frontend/src/components/herramientas/tareas/TaskChartsTab.tsx` | Crear | Tab de gráficas (Recharts) |
| `frontend/src/components/herramientas/tareas/TeamConfigTab.tsx` | Crear | Tab configuración equipo (solo gestor) |

---

### Task 2.1: Instalar dependencias shadcn/ui

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Instalar paquetes necesarios**

```bash
cd /c/zymo-intranet/frontend && npm install \
  @radix-ui/react-dialog \
  @radix-ui/react-tabs \
  @radix-ui/react-select \
  @radix-ui/react-label \
  @radix-ui/react-slot \
  class-variance-authority \
  clsx \
  tailwind-merge \
  lucide-react \
  react-day-picker \
  tailwindcss-animate
```

- [ ] **Step 2: Verificar instalación**

```bash
cd /c/zymo-intranet/frontend && node -e "require('@radix-ui/react-dialog'); require('lucide-react'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git -C /c/zymo-intranet add frontend/package.json frontend/package-lock.json
git -C /c/zymo-intranet commit -m "chore(frontend): instalar dependencias shadcn/ui + lucide + react-day-picker"
```

---

### Task 2.2: Configurar Tailwind para shadcn/ui preservando brand colors

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/lib/utils.ts`

- [ ] **Step 1: Reemplazar `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand colors originales — no cambiar
        brand: {
          blue:   "#003087",
          yellow: "#FFD700",
          red:    "#E31E24",
          white:  "#FFFFFF",
        },
        // Variables CSS de shadcn — mapeadas para que primary = brand-blue
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwindcss-animate"),
  ],
}
```

- [ ] **Step 2: Añadir variables CSS en `index.css`**

Al inicio del archivo (antes de las reglas existentes), añade:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    /* Primary = brand-blue (#003087 ≈ hsl(218 100% 27%)) */
    --primary: 218 100% 27%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --ring: 218 100% 27%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 3: Crear `frontend/src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Verificar build**

```bash
cd /c/zymo-intranet/frontend && npm run build 2>&1 | tail -10
```
Expected: Build exitoso sin errores.

- [ ] **Step 5: Commit**

```bash
git -C /c/zymo-intranet add frontend/tailwind.config.js frontend/src/index.css frontend/src/lib/utils.ts
git -C /c/zymo-intranet commit -m "chore(frontend): configurar shadcn/ui con brand-blue como primary color"
```

---

### Task 2.3: Componentes UI base de shadcn

**Files:**
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/label.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/tabs.tsx`
- Create: `frontend/src/components/ui/select.tsx`
- Create: `frontend/src/components/ui/dialog.tsx`
- Create: `frontend/src/components/ui/pagination.tsx`

- [ ] **Step 1: Crear `button.tsx`**

```tsx
// frontend/src/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:     "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-md px-3",
        lg:      "h-11 rounded-md px-8",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 2: Crear `badge.tsx`**

```tsx
// frontend/src/components/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground",
        secondary:   "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline:     "text-foreground",
        success:     "border-transparent bg-emerald-100 text-emerald-800",
        warning:     "border-transparent bg-amber-100 text-amber-800",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 3: Crear `input.tsx`, `label.tsx`, `card.tsx`**

```tsx
// frontend/src/components/ui/input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"
export { Input }
```

```tsx
// frontend/src/components/ui/label.tsx
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName
export { Label }
```

```tsx
// frontend/src/components/ui/card.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
```

- [ ] **Step 4: Crear `tabs.tsx`**

```tsx
// frontend/src/components/ui/tabs.tsx
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

- [ ] **Step 5: Crear `dialog.tsx` (para el modal de detalle)**

```tsx
// frontend/src/components/ui/dialog.tsx
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2 rounded-xl border",
        className
      )}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5", className)} {...props} />
)
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-xl font-bold leading-none tracking-tight", className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogOverlay }
```

- [ ] **Step 6: Verificar build**

```bash
cd /c/zymo-intranet/frontend && npm run build 2>&1 | tail -5
```
Expected: Build exitoso.

- [ ] **Step 7: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/components/ui/
git -C /c/zymo-intranet commit -m "feat(ui): componentes shadcn/ui — Button, Badge, Input, Label, Card, Tabs, Dialog"
```

---

### Task 2.4: Componente `TaskDetailModal` — modal centrado con tabs

**Files:**
- Create: `frontend/src/components/herramientas/tareas/TaskDetailModal.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// frontend/src/components/herramientas/tareas/TaskDetailModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTaskActivity } from "@/hooks/useWorkTasks"
import type { WorkTask, TaskActivityEntry } from "@/types/workTask"
import { formatFechaHora } from "@/lib/dates"

const ESTADO_VARIANT: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  completada:  "success",
  bloqueada:   "destructive",
  en_progreso: "warning",
}

interface Props {
  task: WorkTask | null
  open: boolean
  onClose: () => void
  onEdit?: (task: WorkTask) => void
}

export function TaskDetailModal({ task, open, onClose, onEdit }: Props) {
  const { data: activity = [], isLoading: loadingActivity } = useTaskActivity(
    open && task ? task.id : null
  )

  if (!task) return null

  const duracion = task.tiempo_total_minutos
    ? `${Math.floor(task.tiempo_total_minutos / 60)}h ${task.tiempo_total_minutos % 60}m`
    : "—"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={ESTADO_VARIANT[task.estado] ?? "secondary"}>
              {task.estado.replace("_", " ")}
            </Badge>
            <Badge variant="outline">{task.etiqueta}</Badge>
          </div>
          <DialogTitle>{task.titulo}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {task.subido_por_nombre} · {task.fecha}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-2 border-y border-border text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Plataforma</p>
            <p className="font-medium">{task.plataforma ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Tiempo</p>
            <p className="font-medium">{duracion}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Prioridad</p>
            <p className="font-medium capitalize">{task.nivel_prioridad ?? "—"}</p>
          </div>
        </div>

        <Tabs defaultValue="descripcion">
          <TabsList className="w-full">
            <TabsTrigger value="descripcion" className="flex-1">Descripción</TabsTrigger>
            <TabsTrigger value="actividad" className="flex-1">Actividad</TabsTrigger>
          </TabsList>

          <TabsContent value="descripcion">
            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-foreground min-h-[120px]">
              {task.descripcion_tecnica ?? (
                <span className="text-muted-foreground italic">Sin descripción.</span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actividad">
            {loadingActivity ? (
              <p className="text-sm text-muted-foreground p-4">Cargando historial...</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 italic">Sin historial de actividad.</p>
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-4 py-2">
                {activity.map((entry: TaskActivityEntry) => (
                  <li key={entry.id} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {formatFechaHora(entry.fecha)} · {entry.user_nombre}
                    </p>
                    <p className="text-sm font-medium capitalize">{entry.accion.replace("_", " ")}</p>
                    {entry.detalle && (
                      <p className="text-sm text-muted-foreground">{entry.detalle}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>

        {onEdit && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button className="flex-1" onClick={() => onEdit(task)}>Editar tarea</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /c/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | grep TaskDetailModal
```
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/components/herramientas/tareas/TaskDetailModal.tsx
git -C /c/zymo-intranet commit -m "feat(tareas): TaskDetailModal — modal centrado con tabs Descripción/Actividad"
```

---

### Task 2.5: Componente `CalendarSidebar` — panel lateral resizable

**Files:**
- Create: `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx`

- [ ] **Step 1: Instalar `react-day-picker` (ya instalado en Task 2.1)**

Verificar:
```bash
cd /c/zymo-intranet/frontend && node -e "require('react-day-picker'); console.log('OK')"
```

- [ ] **Step 2: Crear el componente**

```tsx
// frontend/src/components/herramientas/tareas/CalendarSidebar.tsx
import { useState, useCallback, useEffect } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEventsByDate } from "@/hooks/useWorkTasks"
import type { TaskEvent } from "@/types/workTask"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  isOpen: boolean
  onToggle: () => void
  onDateSelect: (date: Date) => void
  onEventClick: (event: TaskEvent) => void
  onNewEvent: (date: Date) => void
}

const MIN_WIDTH = 280
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 320

export function CalendarSidebar({ isOpen, onToggle, onDateSelect, onEventClick, onNewEvent }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)

  const fechaStr = format(selectedDate, "yyyy-MM-dd")
  const { data: events = [] } = useEventsByDate(isOpen ? fechaStr : null)

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    setSelectedDate(date)
    onDateSelect(date)
  }

  // Lógica de resize
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const stopResizing = useCallback(() => setIsDragging(false), [])

  const resize = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const newWidth = document.body.clientWidth - e.clientX
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setSidebarWidth(newWidth)
    }
  }, [isDragging])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", resize)
      window.addEventListener("mouseup", stopResizing)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    } else {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [isDragging, resize, stopResizing])

  const isToday = fechaStr === format(new Date(), "yyyy-MM-dd")
  const isFuture = selectedDate > new Date()

  return (
    <aside
      className={`border-l border-border bg-background flex flex-col relative transition-all duration-300 ease-in-out ${
        isOpen ? "opacity-100" : "opacity-0 overflow-hidden w-0 border-l-0"
      }`}
      style={{ width: isOpen ? sidebarWidth : 0 }}
    >
      {/* Handle de resize */}
      {isOpen && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 transition-colors -translate-x-1/2 ${
            isDragging ? "bg-primary/40" : "bg-transparent hover:bg-primary/20"
          }`}
          onMouseDown={startResizing}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Agenda</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Calendario */}
          <div className="p-3 border-b border-border/50">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={es}
              className="w-full"
              classNames={{
                day_selected: "bg-primary text-primary-foreground rounded-md font-bold",
                day_today: "bg-accent text-accent-foreground rounded-md font-semibold",
              }}
            />
          </div>

          {/* Eventos del día */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {isToday ? "Hoy" : format(selectedDate, "d MMM", { locale: es })}
              </h4>
              <Badge variant="secondary" className="text-[10px]">
                {events.length} eventos
              </Badge>
            </div>

            {/* Botón agendar (siempre visible) */}
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => onNewEvent(selectedDate)}
            >
              + Agendar {isFuture ? "reunión" : "tarea"}
            </Button>

            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Sin eventos este día.
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((ev: TaskEvent) => {
                  const hasConflict = ev.participants.some((p) => p.has_conflict)
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors hover:border-primary/40 ${
                        hasConflict
                          ? "border-amber-200 bg-amber-50"
                          : "border-border bg-background hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold leading-tight line-clamp-2">
                          {ev.titulo}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {ev.hora_inicio}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ev.participants.length} participante{ev.participants.length !== 1 ? "s" : ""}
                      </p>
                      {hasConflict && (
                        <p className="text-xs text-amber-700 mt-1">⚠ Conflicto de agenda</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
```

> **Nota:** Requiere instalar `date-fns`:
> ```bash
> cd /c/zymo-intranet/frontend && npm install date-fns
> ```

- [ ] **Step 3: Instalar date-fns y verificar**

```bash
cd /c/zymo-intranet/frontend && npm install date-fns && npx tsc --noEmit 2>&1 | grep CalendarSidebar
```
Expected: Sin errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/components/herramientas/tareas/CalendarSidebar.tsx frontend/package.json frontend/package-lock.json
git -C /c/zymo-intranet commit -m "feat(tareas): CalendarSidebar — panel lateral resizable con agenda y eventos"
```

---

### Task 2.6: Componente `ScheduleSheet` — agendar con multi-usuario

**Files:**
- Create: `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// frontend/src/components/herramientas/tareas/ScheduleSheet.tsx
import { useState } from "react"
import { X, Users, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useCreateEvent, useTeamMembers, useAvailableTeamUsers } from "@/hooks/useWorkTasks"
import type { TaskEventCreate } from "@/types/workTask"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  isOpen: boolean
  onClose: () => void
  preselectedDate: Date | null
  canSelectOthers: boolean   // true solo para gestor
}

export function ScheduleSheet({ isOpen, onClose, preselectedDate, canSelectOthers }: Props) {
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [horaInicio, setHoraInicio] = useState("09:00")
  const [duracion, setDuracion] = useState(60)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [searchUsers, setSearchUsers] = useState("")

  const createEvent = useCreateEvent()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: allUsers = [] } = useAvailableTeamUsers()

  if (!isOpen) return null

  const fechaStr = preselectedDate
    ? format(preselectedDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd")

  const fechaLabel = preselectedDate
    ? format(preselectedDate, "d 'de' MMMM yyyy", { locale: es })
    : "Hoy"

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const filteredAllUsers = allUsers.filter((u: { id: number; full_name: string }) =>
    u.full_name.toLowerCase().includes(searchUsers.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!titulo.trim() || selectedUserIds.length === 0) return

    const payload: TaskEventCreate = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      fecha: fechaStr,
      hora_inicio: horaInicio,
      duracion_minutos: duracion,
      participant_ids: selectedUserIds,
    }

    await createEvent.mutateAsync(payload)
    // Reset
    setTitulo("")
    setDescripcion("")
    setSelectedUserIds([])
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-background shadow-2xl z-50 flex flex-col border-l border-border">
        {/* Header */}
        <div className="p-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Agendar evento</h2>
              <p className="text-sm text-muted-foreground">{fechaLabel}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              placeholder="Ej. Revisión de sprint"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duración</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
              >
                <option value={30}>30 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1.5 horas</option>
                <option value={120}>2 horas</option>
                <option value={180}>3 horas</option>
                <option value={240}>4 horas</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Detalles opcionales..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          {/* Selección de participantes */}
          <div className="space-y-2">
            <Label>Participantes *</Label>
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedUserIds.map((uid) => {
                  const user =
                    teamMembers.find((m: { user_id: number; user_nombre?: string; nombre?: string }) => m.user_id === uid) ??
                    allUsers.find((u: { id: number; full_name: string }) => u.id === uid)
                  const name = user?.user_nombre ?? user?.full_name ?? `#${uid}`
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleUser(uid)}>
                      {name} <X className="h-3 w-3" />
                    </Badge>
                  )
                })}
              </div>
            )}

            {canSelectOthers ? (
              <Tabs defaultValue="equipo">
                <TabsList className="w-full">
                  <TabsTrigger value="equipo" className="flex-1 gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Equipo
                  </TabsTrigger>
                  <TabsTrigger value="todos" className="flex-1 gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Todos los usuarios
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="equipo">
                  <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                    {teamMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 text-center">Sin miembros en el equipo.</p>
                    ) : (
                      teamMembers.map((m: { user_id: number; user_nombre: string }) => (
                        <div
                          key={m.user_id}
                          onClick={() => toggleUser(m.user_id)}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedUserIds.includes(m.user_id) ? "bg-primary/5 font-medium" : ""
                          }`}
                        >
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                            {m.user_nombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm">{m.user_nombre}</span>
                          {selectedUserIds.includes(m.user_id) && (
                            <span className="ml-auto text-primary text-xs">✓</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="todos">
                  <Input
                    placeholder="Buscar usuario..."
                    className="mb-2"
                    value={searchUsers}
                    onChange={(e) => setSearchUsers(e.target.value)}
                  />
                  <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                    {filteredAllUsers.map((u: { id: number; full_name: string }) => (
                      <div
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedUserIds.includes(u.id) ? "bg-primary/5 font-medium" : ""
                        }`}
                      >
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {u.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm">{u.full_name}</span>
                        {selectedUserIds.includes(u.id) && (
                          <span className="ml-auto text-primary text-xs">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-xs text-muted-foreground">Solo puedes agendarte a ti mismo.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-muted/30 flex gap-3 shrink-0">
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!titulo.trim() || selectedUserIds.length === 0 || createEvent.isPending}
          >
            {createEvent.isPending ? "Agendando..." : "Agendar"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /c/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | grep ScheduleSheet
```
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/components/herramientas/tareas/ScheduleSheet.tsx
git -C /c/zymo-intranet commit -m "feat(tareas): ScheduleSheet — panel agendar con selector multi-usuario (tabs Equipo/Todos)"
```

---

### Task 2.7: Rediseñar `GestionTareasPage` — layout principal con Tabs

**Files:**
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

- [ ] **Step 1: Reescribir el componente principal**

```tsx
// frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Download, Plus, PanelRightClose, PanelRightOpen } from "lucide-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAuthStore } from "@/store/authStore"
import { canManageDevTasks, canSubmitDevTasks } from "@/lib/permissions"
import { CalendarSidebar } from "@/components/herramientas/tareas/CalendarSidebar"
import { ScheduleSheet } from "@/components/herramientas/tareas/ScheduleSheet"
import { TaskDetailModal } from "@/components/herramientas/tareas/TaskDetailModal"
import { TaskManagerView } from "@/components/herramientas/tareas/TaskManagerView"
import { TaskSubmitView } from "@/components/herramientas/tareas/TaskSubmitView"
import { TaskChartsTab } from "@/components/herramientas/tareas/TaskChartsTab"
import { TeamConfigTab } from "@/components/herramientas/tareas/TeamConfigTab"
import type { WorkTask, TaskEvent } from "@/types/workTask"

export function GestionTareasPage() {
  const user = useAuthStore((s) => s.user)
  const userTools: string[] = user?.user_tools ?? []
  const role = user?.role
  const isTeamMember = user?.is_team_member ?? false

  const canManage = canManageDevTasks(userTools, role)
  const canSubmit = canSubmitDevTasks(userTools, isTeamMember)

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)

  if (!canManage && !canSubmit) {
    return <Navigate to="/dashboard" replace />
  }

  const handleDateSelect = (date: Date) => {
    setScheduleDate(date)
    setIsScheduleOpen(true)
  }

  const handleTaskClick = (task: WorkTask) => {
    setSelectedTask(task)
    setIsTaskModalOpen(true)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1.5 bg-primary rounded-full" />
          <h1 className="text-xl font-bold tracking-tight">Gestión de Tareas</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setIsScheduleOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen((v) => !v)}
            className={isSidebarOpen ? "bg-muted" : ""}
          >
            {isSidebarOpen
              ? <PanelRightClose className="h-4 w-4" />
              : <PanelRightOpen className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="tareas" className="space-y-4">
            <TabsList>
              <TabsTrigger value="tareas">
                {canManage ? "Tareas del equipo" : "Mis tareas"}
              </TabsTrigger>
              <TabsTrigger value="graficas">Gráficas</TabsTrigger>
              {canManage && <TabsTrigger value="configuracion">Configuración</TabsTrigger>}
            </TabsList>

            <TabsContent value="tareas">
              {canManage ? (
                <TaskManagerView onTaskClick={handleTaskClick} />
              ) : (
                <TaskSubmitView onTaskClick={handleTaskClick} />
              )}
            </TabsContent>

            <TabsContent value="graficas">
              <TaskChartsTab isManager={canManage} />
            </TabsContent>

            {canManage && (
              <TabsContent value="configuracion">
                <TeamConfigTab />
              </TabsContent>
            )}
          </Tabs>
        </main>

        {/* Calendar sidebar */}
        <CalendarSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((v) => !v)}
          onDateSelect={handleDateSelect}
          onEventClick={(ev: TaskEvent) => console.log("event", ev)}
          onNewEvent={(date) => { setScheduleDate(date); setIsScheduleOpen(true) }}
        />
      </div>

      {/* Overlays */}
      <ScheduleSheet
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        preselectedDate={scheduleDate}
        canSelectOthers={canManage}
      />

      <TaskDetailModal
        task={selectedTask}
        open={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setSelectedTask(null) }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Crear `TaskChartsTab.tsx` (wrapper del módulo de gráficas existente)**

```tsx
// frontend/src/components/herramientas/tareas/TaskChartsTab.tsx
import { useAuthStore } from "@/store/authStore"
import { useTeamCharts, useMyTaskMetrics } from "@/hooks/useWorkTasks"
import { TaskCharts } from "@/components/herramientas/tareas/TaskCharts"

interface Props { isManager: boolean }

export function TaskChartsTab({ isManager }: Props) {
  const user = useAuthStore((s) => s.user)
  // Gestor → datos del equipo; colaborador → datos propios
  const { data: teamCharts } = useTeamCharts()
  const { data: myMetrics } = useMyTaskMetrics()

  if (isManager) {
    return <TaskCharts data={teamCharts} />
  }
  return <TaskCharts data={myMetrics} />
}
```

> **Nota:** Adaptar los props según los tipos actuales de `TaskCharts`. Si los tipos no coinciden, unificarlos.

- [ ] **Step 3: Crear `TeamConfigTab.tsx` (wrapper de configuración de equipo)**

```tsx
// frontend/src/components/herramientas/tareas/TeamConfigTab.tsx
import { TaskTeamConfigDialog } from "@/components/herramientas/tareas/TaskTeamConfigDialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TeamConfigTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración del Equipo</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Reutiliza el componente de configuración existente inline (sin dialog) */}
        <TaskTeamConfigDialog />
      </CardContent>
    </Card>
  )
}
```

> **Nota:** `TaskTeamConfigDialog` actual es un dialog/modal. Para el Tab puede necesitar adaptarse para renderizar inline. Si es complejo, renderizarlo con `open={true}` dentro de un div.

- [ ] **Step 4: Verificar build completo**

```bash
cd /c/zymo-intranet/frontend && npm run build 2>&1 | tail -15
```
Expected: Build exitoso.

- [ ] **Step 5: Commit**

```bash
git -C /c/zymo-intranet add frontend/src/pages/herramientas/tareas/ frontend/src/components/herramientas/tareas/
git -C /c/zymo-intranet commit -m "feat(tareas): nuevo layout — tabs Tareas/Gráficas/Configuración + calendario lateral"
```

---

### Task 2.8: Verificación final y Docker build

- [ ] **Step 1: Build de imágenes Docker**

```bash
cd /c/zymo-intranet && docker compose build 2>&1 | tail -20
```
Expected: Las 3 imágenes buildean sin errores.

- [ ] **Step 2: Levantar y verificar**

```bash
cd /c/zymo-intranet && docker compose up -d && sleep 5 && docker compose ps
```
Expected: Los 3 containers en estado `Running`.

- [ ] **Step 3: Verificar tablas nuevas en BD**

```bash
docker compose exec backend python -c "
import sqlite3
conn = sqlite3.connect('/app/data/intranet.db')
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'task%'\").fetchall()
print([t[0] for t in tables])
conn.close()
"
```
Expected: Lista que incluye `task_events`, `task_event_participants`, `task_activity_log`.

- [ ] **Step 4: Commit final**

```bash
git -C /c/zymo-intranet add .
git -C /c/zymo-intranet commit -m "chore: verificación final build y docker — rediseño herramienta tareas completo"
```

---

## Resumen de Fases

### Fase 1 — Fundación (Tasks 1.1 → 1.11)
Resultado: BD con 3 tablas nuevas, modelo de acceso simplificado, paginación real, agenda con detección de conflictos, historial de actividad, KPIs con scope dinámico. UI funcional con la nueva lógica pero mismos estilos.

### Fase 2 — Rediseño Visual (Tasks 2.1 → 2.8)
Resultado: shadcn/ui instalado con brand-blue como primary color, nuevo layout con Tabs (Tareas / Gráficas / Configuración), calendario lateral resizable con eventos, modal centrado para detalle, ScheduleSheet con selector multi-usuario por tabs (Equipo / Todos).
