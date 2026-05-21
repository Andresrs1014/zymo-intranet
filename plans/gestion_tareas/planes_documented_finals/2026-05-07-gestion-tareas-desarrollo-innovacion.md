# Plan de Implementación — Gestión de Tareas: Desarrollo e Innovación
> Para agente implementador en `zymo-intranet`.
> Leer `.cursorrules.md` antes de tocar cualquier archivo.
> Este plan define código, archivos y fases. No implementar ZYMO ni módulo gerencial todavía.

---

## CONTEXTO OBLIGATORIO — LEE ESTO PRIMERO

ZYMO Intranet es una aplicación interna de Grupo ZYMO. Este plan crea la primera **herramienta transversal** de gestión de tareas, empezando por Desarrollo e Innovación.

**Stack exacto del repo:**
- Backend: Python + FastAPI + SQLModel + SQLite por defecto.
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + Zustand + TanStack Query.
- Auth: JWT con usuario actual expuesto por `get_current_user`.
- BD principal: `backend/app/database.py` (`settings.database_url`, default `sqlite:///./data/intranet.db`).
- Módulos con BDs separadas ya existentes: OC, SGC, Financiero, Agentes, Gerencial.
- Docker Compose para producción.

**Reglas de arquitectura que DEBES respetar:**
1. Esta herramienta vive en la **BD principal de intranet**, no en `gerencial.db`, `agents.db`, `oc.db`, `sgc.db` ni `financiero.db`.
2. La lógica de negocio va en `backend/app/services/`. Los routers solo validan entrada, llaman servicios y retornan respuesta.
3. Los modelos nuevos se crean con `SQLModel.metadata.create_all()` registrándolos en `create_db_and_tables()` dentro de `backend/app/database.py`.
4. No usar Alembic. Si en el futuro se agregan columnas a tablas existentes, usar migración manual ligera como ya hace `main.py` con roles/OC.
5. No hardcodear usuarios reales, correos, ids ni secretos. El equipo se configura desde UI.
6. El rol `admin` NO debe desbloquear automáticamente las herramientas. Las herramientas se asignan por usuario.
7. El módulo `/gerencial` queda reservado para el gerente y el futuro control total de la intranet. No seguir metiendo tareas allí.
8. Los estilos nuevos deben ser ajustables y centralizados según `.cursorrules.md`: tokens, utilidades compartidas y componentes reusables, no valores visuales rígidos dispersos.

**Estado actual relevante:**
- Existe `backend/app/gerencial_database.py` con `GerencialTarea`, pero este plan debe crear la nueva base transversal en la BD principal.
- Existe `backend/app/routers/gerencial.py` con endpoints de tareas gerenciales. No extender ese router para esta herramienta.
- Existe `frontend/src/components/gerencial/TareasDevPanel.tsx`. Se puede usar como referencia funcional del formulario, pero no como pantalla final.
- Existe `frontend/src/pages/gerencial/GerencialPage.tsx`. Se debe limpiar la exposición de tareas desde allí cuando la nueva herramienta esté lista.
- Existe `frontend/src/components/layout/Sidebar.tsx`, actualmente con navegación plana por módulos. Este plan introduce separación visual: módulos vs herramientas.

---

## FEATURES A IMPLEMENTAR

### Feature A — Modelos base de herramientas y tareas en BD principal
### Feature B — Permisos por herramienta asignados a usuario
### Feature C — API de registro personal de tareas
### Feature D — API directiva con filtros, KPIs, gráficas y usuarios sin registro hoy
### Feature E — Configuración de equipo Desarrollo e Innovación
### Feature F — Exportación Excel y PDF con filtros activos
### Feature G — Frontend: ruta `/herramientas/tareas` con vista usuario y vista directiva
### Feature H — Sidebar: separar módulos disponibles y mis herramientas
### Feature I — UI premium ajustable tipo shadcn/Vercel/Claude para esta herramienta
### Feature J — Retirar tareas del módulo gerencial como experiencia principal

---

## FASE 0 — Reglas de diseño y alcance

**Archivo ya modificado:** `.cursorrules.md`

Debe existir esta regla en la sección frontend:

```md
- Los estilos nuevos deben ser ajustables y centralizados: preferir tokens, variables CSS, clases/utilidades compartidas y componentes reutilizables antes que valores visuales rigidos dispersos. Cualquier propuesta visual tipo shadcn/Vercel/Claude debe poder cambiarse sin reescribir pantallas completas.
```

**No revertir esta regla.**

---

## FASE 1 — Backend: Modelos nuevos

Crear modelos en `backend/app/models/` y registrarlos en `backend/app/database.py`.

### 1.1 — Modelo `UserTool`

**Archivo nuevo:** `backend/app/models/user_tool.py`

```python
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class UserTool(SQLModel, table=True):
    __tablename__ = "user_tools"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, nullable=False)
    tool_key: str = Field(index=True, max_length=100, nullable=False)
    scope: str = Field(default="global", index=True, max_length=100, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

**Keys iniciales:**

```txt
tool_task_submit_dev
tool_task_manage_dev
```

### 1.2 — Modelo `TaskTeam`

**Archivo nuevo:** `backend/app/models/task_team.py`

```python
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskTeam(SQLModel, table=True):
    __tablename__ = "task_teams"

    id: Optional[int] = Field(default=None, primary_key=True)
    scope: str = Field(index=True, max_length=100, nullable=False)  # desarrollo_innovacion
    name: str = Field(max_length=150, nullable=False)
    owner_user_id: Optional[int] = Field(default=None, index=True)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

### 1.3 — Modelo `TaskTeamMember`

**Archivo nuevo:** `backend/app/models/task_team_member.py`

```python
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class TaskTeamMember(SQLModel, table=True):
    __tablename__ = "task_team_members"

    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(index=True, nullable=False)
    user_id: int = Field(index=True, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

### 1.4 — Modelo `WorkTask`

**Archivo nuevo:** `backend/app/models/work_task.py`

```python
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class WorkTask(SQLModel, table=True):
    __tablename__ = "work_tasks"

    id: Optional[int] = Field(default=None, primary_key=True)

    scope: str = Field(default="desarrollo_innovacion", index=True, max_length=100)
    team_id: Optional[int] = Field(default=None, index=True)

    subido_por_id: int = Field(index=True, nullable=False)
    subido_por_nombre: str = Field(default="", max_length=200)

    fecha: date = Field(default_factory=date.today, index=True)
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None
    tiempo_total_minutos: Optional[int] = None

    etiqueta: str = Field(default="tareas_diarias", index=True, max_length=80)
    plataforma: str = Field(default="transversal", index=True, max_length=80)

    titulo: str = Field(max_length=250, nullable=False)
    descripcion_tecnica: str = Field(nullable=False)

    estado: str = Field(default="en_progreso", index=True, max_length=50)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
```

**Valores válidos v1:**

```txt
scope: desarrollo_innovacion
estado: completada | en_progreso | bloqueada
etiqueta: desarrollos | actualizaciones | auditorias | implementacion_okr | tareas_diarias
plataforma: logimat1 | logimat2 | imccargo | imcdeposito | transversal
```

### 1.5 — Registrar modelos en `database.py`

**Archivo a modificar:** `backend/app/database.py`

Agregar imports dentro de `create_db_and_tables()`:

```python
from app.models.user_tool import UserTool
from app.models.task_team import TaskTeam
from app.models.task_team_member import TaskTeamMember
from app.models.work_task import WorkTask
```

Agregar tablas a `intranet_table_names`:

```python
"user_tools",
"task_teams",
"task_team_members",
"work_tasks",
```

---

## FASE 2 — Backend: Schemas

Crear carpeta si no existe: `backend/app/schemas/`.

### 2.1 — Schemas de herramientas

**Archivo nuevo:** `backend/app/schemas/user_tool.py`

```python
from datetime import datetime
from pydantic import BaseModel


class UserToolRead(BaseModel):
    id: int
    user_id: int
    tool_key: str
    scope: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserToolCreate(BaseModel):
    user_id: int
    tool_key: str
    scope: str = "global"
```

### 2.2 — Schemas de tareas

**Archivo nuevo:** `backend/app/schemas/work_task.py`

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorkTaskCreate(BaseModel):
    titulo: str
    descripcion_tecnica: str
    etiqueta: str = "tareas_diarias"
    plataforma: str = "transversal"
    estado: str = "en_progreso"
    fecha: Optional[str] = None
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None


class WorkTaskUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion_tecnica: Optional[str] = None
    etiqueta: Optional[str] = None
    plataforma: Optional[str] = None
    estado: Optional[str] = None
    fecha: Optional[str] = None
    hora_inicio: Optional[datetime] = None
    hora_cierre: Optional[datetime] = None


class WorkTaskRead(BaseModel):
    id: int
    scope: str
    team_id: int | None
    subido_por_id: int
    subido_por_nombre: str
    fecha: str
    hora_inicio: str | None
    hora_cierre: str | None
    tiempo_total_minutos: int | None
    etiqueta: str
    plataforma: str
    titulo: str
    descripcion_tecnica: str
    estado: str
    created_at: str
    updated_at: str
```

### 2.3 — Schemas de dashboard directivo

**Archivo nuevo:** `backend/app/schemas/task_dashboard.py`

```python
from pydantic import BaseModel


class TaskFilters(BaseModel):
    fecha_desde: str | None = None
    fecha_hasta: str | None = None
    responsable_id: int | None = None
    estado: str | None = None
    etiqueta: str | None = None
    plataforma: str | None = None
    q: str | None = None
    sin_registro_hoy: bool = False


class TaskKpis(BaseModel):
    tareas_registradas: int
    horas_registradas: float
    completadas: int
    en_progreso: int
    bloqueadas: int
    usuarios_activos: int
    usuarios_sin_registro_hoy: int


class PersonTaskSummary(BaseModel):
    user_id: int
    nombre: str
    email: str
    tareas_totales: int
    horas: float
    completadas: int
    en_progreso: int
    bloqueadas: int
    ultima_actividad: str | None
    registro_hoy: bool
```

### 2.4 — Schemas de configuración de equipo

**Archivo nuevo:** `backend/app/schemas/task_team.py`

```python
from datetime import datetime
from pydantic import BaseModel


class TaskTeamMemberRead(BaseModel):
    id: int
    team_id: int
    user_id: int
    user_email: str
    user_full_name: str | None
    is_active: bool
    created_at: datetime


class TaskTeamMemberCreate(BaseModel):
    user_id: int


class AvailableUserRead(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    area: str | None
```

---

## FASE 3 — Backend: Services

### 3.1 — Servicio de permisos de herramientas

**Archivo nuevo:** `backend/app/services/user_tool_service.py`

```python
from sqlmodel import Session, select

from app.models.user_tool import UserTool
from app.models.user import User


def user_has_tool(db: Session, user: User, tool_key: str, scope: str = "global") -> bool:
    tool = db.exec(
        select(UserTool)
        .where(UserTool.user_id == user.id)
        .where(UserTool.tool_key == tool_key)
        .where(UserTool.scope == scope)
        .where(UserTool.is_active == True)  # noqa: E712
    ).first()
    return tool is not None


def require_tool_or_403(db: Session, user: User, tool_key: str, scope: str) -> None:
    from fastapi import HTTPException, status

    if not user_has_tool(db, user, tool_key, scope):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes esta herramienta asignada.",
        )
```

> IMPORTANTE: No dar bypass automático a `admin`.

### 3.2 — Servicio de equipos

**Archivo nuevo:** `backend/app/services/task_team_service.py`

Implementar funciones:

```python
SCOPE_DEV = "desarrollo_innovacion"

def get_or_create_dev_team(db: Session) -> TaskTeam: ...
def list_team_members(db: Session, scope: str = SCOPE_DEV) -> list[tuple[TaskTeamMember, User]]: ...
def list_available_users(db: Session, scope: str = SCOPE_DEV) -> list[User]: ...
def add_team_member(db: Session, user_id: int, scope: str = SCOPE_DEV) -> TaskTeamMember: ...
def deactivate_team_member(db: Session, user_id: int, scope: str = SCOPE_DEV) -> None: ...
def get_active_member_ids(db: Session, scope: str = SCOPE_DEV) -> list[int]: ...
```

Reglas:

- `get_or_create_dev_team()` crea un equipo con `scope="desarrollo_innovacion"` y `name="Desarrollo e Innovación"` si no existe.
- Quitar un usuario marca `is_active=False`; no borrar fila.
- Si se agrega de nuevo un usuario inactivo, reactivar la fila existente.

### 3.3 — Servicio de tareas

**Archivo nuevo:** `backend/app/services/work_task_service.py`

Implementar:

```python
SCOPE_DEV = "desarrollo_innovacion"

def calcular_minutos(hora_inicio, hora_cierre) -> int | None: ...
def validate_task_values(etiqueta: str, plataforma: str, estado: str) -> None: ...
def create_task(db: Session, user: User, payload: WorkTaskCreate) -> WorkTask: ...
def update_own_task(db: Session, user: User, task_id: int, payload: WorkTaskUpdate) -> WorkTask: ...
def list_own_tasks(db: Session, user: User, filters) -> list[WorkTask]: ...
def own_metrics(db: Session, user: User) -> dict: ...
```

Reglas:

- `create_task()` siempre usa `subido_por_id=current_user.id`.
- El usuario no puede crear tareas para otra persona.
- El usuario no puede editar tareas ajenas.
- El `team_id` se obtiene del equipo activo `desarrollo_innovacion`.

### 3.4 — Servicio de dashboard directivo

**Archivo nuevo:** `backend/app/services/task_dashboard_service.py`

Implementar:

```python
def build_team_query(db: Session, filters: TaskFilters): ...
def get_team_tasks(db: Session, filters: TaskFilters) -> list[WorkTask]: ...
def get_team_kpis(db: Session, filters: TaskFilters) -> TaskKpis: ...
def get_person_summaries(db: Session, filters: TaskFilters) -> list[PersonTaskSummary]: ...
def get_chart_data(db: Session, filters: TaskFilters) -> dict: ...
def get_users_without_today_entry(db: Session) -> list[PersonTaskSummary]: ...
```

`get_chart_data()` debe retornar:

```json
{
  "tareas_por_responsable": [],
  "horas_por_responsable": [],
  "distribucion_estado": [],
  "tareas_por_etiqueta": [],
  "evolucion_completadas": []
}
```

Reglas:

- Todos los cálculos deben limitarse a miembros activos del equipo Desarrollo e Innovación.
- Todos los cálculos deben respetar filtros.
- `sin_registro_hoy=true` filtra personas sin registro hoy y sus datos asociados.

### 3.5 — Servicio de exportación

**Archivo nuevo:** `backend/app/services/task_export_service.py`

Implementar:

```python
def build_tasks_excel(db: Session, filters: TaskFilters) -> bytes: ...
def build_tasks_pdf(db: Session, filters: TaskFilters) -> bytes: ...
```

Recomendación:

- Excel: usar `openpyxl` si ya está disponible; si no, agregar dependencia al backend.
- PDF: usar una estrategia simple compatible con Docker. Si no hay librería PDF disponible, documentar dependencia elegida en `backend/requirements.txt`.

Reglas:

- Exportar solo tareas visibles para la vista directiva.
- Respetar filtros activos.
- No incluir usuarios fuera del equipo.

---

## FASE 4 — Backend: Router nuevo

### 4.1 — Router de Gestión de Tareas

**Archivo nuevo:** `backend/app/routers/herramientas_tareas.py`

```python
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlmodel import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.work_task import WorkTaskCreate, WorkTaskUpdate, WorkTaskRead
from app.schemas.task_dashboard import TaskFilters
from app.schemas.task_team import TaskTeamMemberCreate
from app.services.user_tool_service import require_tool_or_403

router = APIRouter(prefix="/api/herramientas/tareas", tags=["Herramientas - Tareas"])

SCOPE_DEV = "desarrollo_innovacion"
TOOL_SUBMIT = "tool_task_submit_dev"
TOOL_MANAGE = "tool_task_manage_dev"
```

Endpoints a implementar en este router:

```txt
GET    /mis-tareas
POST   /
PATCH  /{task_id}
GET    /mis-metricas

GET    /equipo
GET    /equipo/kpis
GET    /equipo/personas
GET    /equipo/graficas
GET    /equipo/sin-registro-hoy
GET    /equipo/export/excel
GET    /equipo/export/pdf

GET    /equipo/config/miembros
GET    /equipo/config/usuarios-disponibles
POST   /equipo/config/miembros
DELETE /equipo/config/miembros/{user_id}
```

Reglas:

- Endpoints `/mis-*`, `POST /`, `PATCH /{task_id}` requieren `tool_task_submit_dev`.
- Endpoints `/equipo/*` requieren `tool_task_manage_dev`.
- El router no debe consultar `gerencial_database.py`.
- El router no debe generar descripciones con ZYMO.

### 4.2 — Registrar router en `main.py`

**Archivo a modificar:** `backend/app/main.py`

Agregar import:

```python
from app.routers.herramientas_tareas import router as herramientas_tareas_router
```

Agregar include:

```python
app.include_router(herramientas_tareas_router)
```

---

## FASE 5 — Backend: Seed mínimo de herramientas

### 5.1 — Seed de tool keys disponibles

No se necesita tabla catálogo en v1. Usar constantes:

```python
TASK_TOOL_KEYS = {
    "tool_task_submit_dev": "Registro de tareas — Desarrollo e Innovación",
    "tool_task_manage_dev": "Gestión de tareas del equipo — Desarrollo e Innovación",
}
```

### 5.2 — Asignaciones iniciales

No hardcodear usuarios en código.

Opciones válidas para primer despliegue:

1. Crear temporalmente asignaciones desde SQLite/manual admin script documentado.
2. Agregar UI mínima futura en administración para asignar herramientas.
3. Agregar endpoint admin interno para asignar herramientas si se decide implementarlo en este plan.

**Decisión para este plan:** implementar endpoint admin mínimo.

**Endpoint adicional en router:**

```txt
POST /api/herramientas/tareas/admin/asignar-tool
```

Payload:

```python
class AssignUserToolPayload(BaseModel):
    user_id: int
    tool_key: str
    scope: str = "desarrollo_innovacion"
```

Reglas:

- Solo `role == "admin"` puede usarlo.
- Sirve para asignar `tool_task_submit_dev` o `tool_task_manage_dev`.
- No crear UI completa de administración en esta fase si no alcanza; el endpoint permite operar.

---

## FASE 6 — Frontend: Tipos y permisos

### 6.1 — Tipos nuevos

**Archivo nuevo:** `frontend/src/types/workTask.ts`

```typescript
export interface WorkTask {
  id: number
  scope: string
  team_id: number | null
  subido_por_id: number
  subido_por_nombre: string
  fecha: string
  hora_inicio: string | null
  hora_cierre: string | null
  tiempo_total_minutos: number | null
  etiqueta: string
  plataforma: string
  titulo: string
  descripcion_tecnica: string
  estado: string
  created_at: string
  updated_at: string
}

export interface TaskKpis {
  tareas_registradas: number
  horas_registradas: number
  completadas: number
  en_progreso: number
  bloqueadas: number
  usuarios_activos: number
  usuarios_sin_registro_hoy: number
}
```

**Archivo nuevo:** `frontend/src/types/userTool.ts`

```typescript
export type TaskToolKey = "tool_task_submit_dev" | "tool_task_manage_dev"
```

### 6.2 — Permisos frontend

**Archivo a modificar:** `frontend/src/lib/permissions.ts`

Agregar helpers:

```typescript
export function hasUserTool(userTools: string[] | undefined, key: string): boolean {
  return userTools?.includes(key) === true
}

export function canSubmitDevTasks(userTools?: string[]): boolean {
  return hasUserTool(userTools, "tool_task_submit_dev")
}

export function canManageDevTasks(userTools?: string[]): boolean {
  return hasUserTool(userTools, "tool_task_manage_dev")
}
```

> Si `/auth/me` todavía no retorna herramientas asignadas, agregarlo en backend y store antes de usar estos helpers.

### 6.3 — Auth store

**Archivo a revisar/modificar:** `frontend/src/store/authStore.ts`

Agregar al usuario autenticado:

```typescript
user_tools?: string[]
```

Backend debe exponer estas tools en `/auth/me` o endpoint equivalente usado por login.

---

## FASE 7 — Frontend: Hooks

### 7.1 — Hook de tareas

**Archivo nuevo:** `frontend/src/hooks/useWorkTasks.ts`

Implementar con `fetch` o patrón actual del repo:

```typescript
useMyTasks(filters)
useMyTaskMetrics()
useCreateWorkTask()
useUpdateWorkTask()
useTeamTasks(filters)
useTeamKpis(filters)
useTeamPersonSummaries(filters)
useTeamCharts(filters)
useUsersWithoutTodayEntry()
useTeamMembers()
useAvailableTeamUsers()
useAddTeamMember()
useRemoveTeamMember()
```

Reglas:

- Centralizar `BASE_URL` y `Authorization`.
- Invalidar/refrescar datos tras crear tarea o cambiar miembros.
- No duplicar lógica de filtros en cada componente.

### 7.2 — Hook de exportación

**Archivo nuevo:** `frontend/src/hooks/useTaskExports.ts`

Implementar:

```typescript
exportTasksExcel(filters)
exportTasksPdf(filters)
```

Debe descargar archivo usando `Blob`.

---

## FASE 8 — Frontend: Componentes de la herramienta

Crear carpeta:

```txt
frontend/src/pages/herramientas/tareas/
frontend/src/components/herramientas/tareas/
```

### 8.1 — Página contenedora

**Archivo nuevo:** `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

Responsabilidad:

- Leer `user.user_tools`.
- Si tiene `tool_task_manage_dev`, renderizar vista directiva.
- Si no tiene manage pero tiene `tool_task_submit_dev`, renderizar vista usuario.
- Si no tiene ninguna, mostrar estado 403 amigable o redirigir a dashboard.

### 8.2 — Vista usuario

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskSubmitView.tsx`

Debe contener:

- Header: “Registro de tareas”.
- KPIs personales.
- Alerta si no registró hoy.
- Formulario actual, migrado desde `TareasDevPanel`.
- Lista de tareas recientes propias.
- Filtros personales.

### 8.3 — Formulario reusable

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskForm.tsx`

Props sugeridas:

```typescript
interface TaskFormProps {
  onSubmit: (payload: WorkTaskCreatePayload) => Promise<void>
  loading?: boolean
}
```

Debe conservar campos actuales:

- título
- descripción técnica
- etiqueta
- plataforma
- fecha
- estado
- hora inicio
- hora cierre
- tiempo calculado visible

### 8.4 — Vista directiva

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`

Debe contener:

- Header con acciones.
- Filtros globales.
- KPIs.
- Alertas.
- Tarjetas por persona.
- Gráficas.
- Tabla.
- Sheet/panel lateral de detalle.
- Dialog/sheet de configuración de equipo.

### 8.5 — Filtros

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskFiltersBar.tsx`

Filtros:

```txt
fecha_desde
fecha_hasta
responsable_id
estado
etiqueta
plataforma
q
sin_registro_hoy
```

Regla crítica:

- El estado de filtros debe vivir en `TaskManagerView`.
- El mismo objeto de filtros alimenta KPIs, gráficas, tarjetas, tabla y exportaciones.

### 8.6 — Tarjetas por persona

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/PersonTaskCards.tsx`

Cada tarjeta muestra:

- nombre
- tareas totales
- horas
- completadas
- en progreso
- bloqueadas
- última actividad
- badge si no registró hoy

Click en tarjeta:

```typescript
setFilters((prev) => ({ ...prev, responsable_id: person.user_id }))
```

### 8.7 — Gráficas

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskCharts.tsx`

Usar Recharts ya instalado.

Gráficas:

- tareas por responsable
- horas por responsable
- distribución por estado
- tareas por etiqueta
- evolución diaria/semanal de completadas

### 8.8 — Tabla

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskDataTable.tsx`

Columnas:

- responsable
- tarea
- fecha
- etiqueta
- plataforma
- tiempo
- estado

Click en fila:

- abre `TaskDetailSheet`.

### 8.9 — Detalle lateral

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx`

Mostrar:

- título
- responsable
- fecha
- tiempo
- estado
- etiqueta
- plataforma
- descripción técnica/operativa

### 8.10 — Configuración de equipo

**Archivo nuevo:** `frontend/src/components/herramientas/tareas/TaskTeamConfigDialog.tsx`

Mostrar:

- miembros actuales
- buscador/select de usuarios disponibles
- acción agregar
- acción quitar/desactivar

Ubicación:

- botón discreto arriba a la derecha de `TaskManagerView`, junto a exportaciones.

---

## FASE 9 — Frontend: Estilo visual tipo shadcn

No instalar shadcn completo sin revisar impacto. Para v1, crear componentes/estilos propios inspirados en shadcn y compatibles con Tailwind actual.

### 9.1 — Componentes base opcionales

Crear si ayudan:

```txt
frontend/src/components/ui/Button.tsx
frontend/src/components/ui/Card.tsx
frontend/src/components/ui/Badge.tsx
frontend/src/components/ui/Sheet.tsx
frontend/src/components/ui/Dialog.tsx
frontend/src/components/ui/Empty.tsx
frontend/src/components/ui/Skeleton.tsx
```

Reglas:

- No crear wrappers gigantes.
- Mantener APIs pequeñas.
- Permitir cambiar estilos desde un solo lugar.

### 9.2 — Tokens o utilidades de estilo

Crear:

```txt
frontend/src/lib/taskTheme.ts
```

Ejemplo:

```typescript
export const taskSurface = "bg-white border border-gray-200 shadow-sm"
export const taskCard = "rounded-xl bg-white border border-gray-200 shadow-sm"
export const taskButtonPrimary = "rounded-lg bg-gray-950 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
```

Si se prefiere, mover a CSS variables/Tailwind config en una fase posterior.

### 9.3 — Criterio visual

- Limpio, sobrio, premium.
- No usar paleta de un solo color.
- No convertirlo en landing page.
- El directivo necesita densidad y lectura rápida.
- El usuario necesita registro rápido y claro.

---

## FASE 10 — Frontend: Rutas y Sidebar

### 10.1 — Registrar ruta en `App.tsx`

**Archivo a modificar:** `frontend/src/App.tsx`

Agregar import:

```typescript
import { GestionTareasPage } from "@/pages/herramientas/tareas/GestionTareasPage"
```

Agregar route:

```tsx
<Route
  path="/herramientas/tareas"
  element={
    <PrivateRoute>
      <GestionTareasPage />
    </PrivateRoute>
  }
/>
```

### 10.2 — Sidebar con secciones

**Archivo a modificar:** `frontend/src/components/layout/Sidebar.tsx`

Separar:

```txt
Módulos disponibles
  Dashboard
  Administrativo
  Operativo
  SGC
  Financiero
  Gerencial

Mis herramientas
  Gestión de Tareas
  Motor IA
  Agentes ZYMO
```

Reglas:

- Mostrar “Gestión de Tareas” si el usuario tiene `tool_task_submit_dev` o `tool_task_manage_dev`.
- “Motor IA” puede moverse a herramientas si ya existe `mod_extraccion_ia`.
- No romper navegación actual de módulos.

---

## FASE 11 — Backend/Auth: Exponer herramientas del usuario

### 11.1 — Actualizar respuesta de usuario autenticado

Buscar endpoint `/auth/me` o equivalente en `backend/app/routers/auth.py`.

Agregar `user_tools` a la respuesta:

```json
{
  "id": 1,
  "email": "...",
  "role": "admin",
  "app_permissions": [],
  "user_tools": ["tool_task_submit_dev"]
}
```

Reglas:

- Retornar solo tools activas.
- Retornar solo `tool_key`, no ids internos.
- Mantener compatibilidad con `app_permissions`.

### 11.2 — Actualizar tipos frontend de usuario

Actualizar donde esté definido el tipo de usuario en `authStore` o `types`.

```typescript
user_tools?: string[]
```

---

## FASE 12 — Limpiar módulo gerencial

### 12.1 — `GerencialPage`

**Archivo a modificar:** `frontend/src/pages/gerencial/GerencialPage.tsx`

Cuando la herramienta nueva esté lista:

- No mostrar tabs de tareas como experiencia principal.
- Mantener el módulo gerencial reservado para gerente/admin.
- Si se conserva algo temporal, dejar un estado/placeholder claro: “Control gerencial en construcción”.

### 12.2 — No borrar datos antiguos todavía

No eliminar:

- `backend/app/gerencial_database.py`
- `backend/app/routers/gerencial.py`
- tablas `gerencial_tareas`

Motivo:

- Puede haber datos históricos.
- La migración/limpieza se definirá en otro plan.

---

## FASE 13 — Verificación final

### Backend

- [ ] `python -c "from app.models.work_task import WorkTask; from app.models.user_tool import UserTool; from app.models.task_team import TaskTeam; from app.models.task_team_member import TaskTeamMember; print('OK')"`
- [ ] Arrancar backend sin errores de import.
- [ ] Verificar que `work_tasks`, `user_tools`, `task_teams`, `task_team_members` se crean en intranet DB.
- [ ] `/api/herramientas/tareas/mis-tareas` responde 403 sin tool asignada.
- [ ] Usuario con `tool_task_submit_dev` puede crear tarea.
- [ ] Usuario con `tool_task_submit_dev` no puede ver dashboard directivo.
- [ ] Usuario con `tool_task_manage_dev` puede ver dashboard directivo.
- [ ] Admin sin tool asignada no puede ver endpoints de tareas.
- [ ] Filtros directivos respetan equipo activo.
- [ ] Export Excel/PDF respeta filtros.

### Frontend

- [ ] `npm run build` en `frontend` sin errores TypeScript.
- [ ] Sidebar muestra secciones “Módulos disponibles” y “Mis herramientas”.
- [ ] Gestión de Tareas aparece solo con tool asignada.
- [ ] Vista usuario muestra formulario actual y tareas propias.
- [ ] Vista directiva muestra KPIs, filtros, tarjetas, gráficas y tabla.
- [ ] Click en tarjeta de persona filtra dashboard.
- [ ] Filtro “sin registro hoy” funciona.
- [ ] Configuración permite agregar/quitar miembros.
- [ ] Exportar Excel/PDF descarga archivo.
- [ ] Responsive desktop/móvil revisado.

---

## NOTAS IMPORTANTES PARA EL AGENTE

1. **No implementes ZYMO en este plan.** La descripción gerencial generada por IA queda pausada.
2. **No uses `gerencial_database.py` para esta herramienta.** La nueva base va en intranet DB.
3. **No asumas que `admin` ve todo.** Las herramientas requieren asignación explícita por usuario.
4. **No borres datos ni archivos gerenciales antiguos.** Solo deja de exponer tareas allí cuando la nueva herramienta esté lista.
5. **Reutiliza el formulario actual como comportamiento, no necesariamente como componente final.**
6. **Todos los filtros directivos deben alimentar KPIs, tarjetas, gráficas, tabla y exportaciones.**
7. **Las tarjetas por persona son filtros interactivos.** Esto es parte central de la UX.
8. **La configuración de equipo vive dentro de la herramienta**, inicialmente en botón arriba a la derecha.
9. **La estética nueva se prueba aquí primero.** Centraliza estilos para poder cambiarlos luego sin reescribir pantallas.
10. **Orden recomendado:** Fase 1 → 2 → 3 → 4 → 5 → 11 → 6 → 7 → 8 → 9 → 10 → 12 → 13.

