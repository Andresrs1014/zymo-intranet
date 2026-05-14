# Gestión de Tareas v2 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el aislamiento de tareas por equipo, eliminar el bypass de admin, agregar prioridad, implementar co-gestor y panel de borrado de tareas para admin.

**Architecture:** El aislamiento real se logra filtrando `WorkTask.team_id` (no por user IDs). El co-gestor opera con la misma lógica que el gestor primario pero sin poseer el equipo — se resuelve con `_require_manage_access()` centralizado. El panel admin de tareas se integra en la UI existente de Roles y Usuarios.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend) · React + TanStack Query + TypeScript (frontend) · Docker Compose

**Spec:** `docs/superpowers/specs/2026-05-14-gestion-tareas-v2-design.md`

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---------|--------|-----------|
| `backend/app/models/work_task.py` | Modificar | Campo `prioridad` |
| `backend/app/schemas/work_task.py` | Modificar | `prioridad` + `team_id` en Create/Read/Update |
| `backend/app/schemas/task_team.py` | Modificar | `role` en `TaskTeamMemberRead` |
| `backend/app/main.py` | Modificar | Migración `prioridad` |
| `backend/app/services/work_task_service.py` | Modificar | `create_task` asigna `team_id` |
| `backend/app/services/task_dashboard_service.py` | Modificar | `get_team_tasks` filtra por `team_id` |
| `backend/app/services/task_team_service.py` | Modificar | `get_user_active_teams`, `get_comanaged_owner_id`, `promote_to_cogestor`, `demote_to_member` |
| `backend/app/routers/herramientas_tareas.py` | Modificar | `_require_manage_access`, endpoints co-gestor, mis-equipos, borrado admin |
| `backend/app/routers/auth.py` | Modificar | `delete_user_permanently` acepta `delete_tasks` |
| `frontend/src/lib/permissions.ts` | Modificar | Eliminar bypass admin, agregar `canCoManageDevTasks` |
| `frontend/src/types/workTask.ts` | Modificar | `prioridad`, `team_id` en Create, `role` en TeamMember |
| `frontend/src/hooks/useWorkTasks.ts` | Modificar | `useMyTeams`, `usePromoteCogestor`, `useDemoteCogestor`, `useAdminUserTasks`, `useAdminDeleteTask` |
| `frontend/src/components/herramientas/tareas/TaskForm.tsx` | Modificar | Campo prioridad + selector equipo adaptativo |
| `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` | Modificar | Lógica co-gestor |
| `frontend/src/components/herramientas/tareas/TeamConfigTab.tsx` | Modificar | Botones promover/degradar |
| `frontend/src/pages/AdminPage.tsx` | Modificar | Pestaña "Tareas" en detalle de usuario |

---

## Tarea 1: Migración DB y modelos backend

**Files:**
- Modify: `backend/app/models/work_task.py`
- Modify: `backend/app/schemas/work_task.py`
- Modify: `backend/app/schemas/task_team.py`
- Modify: `backend/app/main.py`

- [ ] **Paso 1.1: Agregar campo `prioridad` al modelo WorkTask**

En `backend/app/models/work_task.py`, agregar después del campo `estado`:

```python
prioridad: str = Field(default="media", index=True, max_length=10, nullable=False)
```

El archivo completo del campo nuevo queda así (solo la sección relevante):
```python
estado: str = Field(default="en_progreso", index=True, max_length=50, nullable=False)
prioridad: str = Field(default="media", index=True, max_length=10, nullable=False)
```

- [ ] **Paso 1.2: Actualizar schemas de work_task**

En `backend/app/schemas/work_task.py`:

```python
class WorkTaskCreate(BaseModel):
    titulo: str
    descripcion_tecnica: str
    etiqueta: str = "tareas_diarias"
    plataforma: str = "transversal"
    estado: str = "en_progreso"
    prioridad: str = "media"
    team_id: int | None = None          # None = auto-asignar si solo hay 1 equipo
    fecha: date | None = None
    hora_inicio: datetime | None = None
    hora_cierre: datetime | None = None


class WorkTaskUpdate(BaseModel):
    titulo: str | None = None
    descripcion_tecnica: str | None = None
    etiqueta: str | None = None
    plataforma: str | None = None
    estado: str | None = None
    prioridad: str | None = None
    fecha: date | None = None
    hora_inicio: datetime | None = None
    hora_cierre: datetime | None = None


class WorkTaskRead(BaseModel):
    id: int
    scope: str
    team_id: int | None
    subido_por_id: int
    subido_por_nombre: str
    fecha: date
    hora_inicio: datetime | None
    hora_cierre: datetime | None
    tiempo_total_minutos: int | None
    etiqueta: str
    plataforma: str
    titulo: str
    descripcion_tecnica: str
    estado: str
    prioridad: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Paso 1.3: Agregar `role` a `TaskTeamMemberRead`**

En `backend/app/schemas/task_team.py`:

```python
class TaskTeamMemberRead(BaseModel):
    id: int
    team_id: int
    user_id: int
    user_email: str
    user_full_name: str | None
    role: str                          # 'member' | 'co_gestor'
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Paso 1.4: Agregar migración de `prioridad` en `_migrate_db()`**

En `backend/app/main.py`, dentro de `_migrate_db()`, antes del bloque `with Session(get_engine()) as session:`:

```python
        # work_tasks.prioridad (agregada en feat gestion-tareas-v2)
        try:
            conn.execute(text(
                "ALTER TABLE work_tasks ADD COLUMN prioridad VARCHAR(10) NOT NULL DEFAULT 'media'"
            ))
            conn.commit()
            print("[migrate] Columna work_tasks.prioridad agregada.")
        except Exception:
            pass  # ya existe
```

- [ ] **Paso 1.5: Verificar que el backend arranca sin errores**

```bash
docker compose up backend --build 2>&1 | grep -E "ERROR|migrate|Started"
```

Resultado esperado: línea `[migrate] Columna work_tasks.prioridad agregada.` (primera vez) o sin error si ya existe. Sin `ERROR` en los logs.

- [ ] **Paso 1.6: Commit**

```bash
git add backend/app/models/work_task.py backend/app/schemas/work_task.py backend/app/schemas/task_team.py backend/app/main.py
git commit -m "feat(tareas): agregar campo prioridad y role en TaskTeamMemberRead"
```

---

## Tarea 2: Eliminar bypass de admin en permisos

**Files:**
- Modify: `backend/app/routers/herramientas_tareas.py` (línea 207)
- Modify: `frontend/src/lib/permissions.ts`

- [ ] **Paso 2.1: Eliminar bypass admin en `_owner_id`**

En `backend/app/routers/herramientas_tareas.py`, reemplazar la función `_owner_id` completa:

```python
def _owner_id(current_user: User) -> int:
    """Retorna el user_id del gestor. Sin bypass de admin — el rol de intranet
    no otorga acceso especial al módulo de tareas."""
    return current_user.id
```

- [ ] **Paso 2.2: Eliminar bypass admin en `canManageDevTasks`**

En `frontend/src/lib/permissions.ts`, reemplazar:

```typescript
/**
 * Puede gestionar si tiene tool_task_manage_dev.
 * El rol 'admin' de la intranet NO otorga acceso al módulo de tareas.
 */
export function canManageDevTasks(userTools: string[]): boolean {
  return userTools.includes("tool_task_manage_dev")
}
```

Nota: eliminar el parámetro `role?: string` ya que no se usa más.

- [ ] **Paso 2.3: Actualizar llamadas a `canManageDevTasks` en el frontend**

Buscar todos los usos:
```bash
grep -rn "canManageDevTasks" frontend/src/
```

En `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`, la llamada actual es:
```typescript
const canManage = canManageDevTasks(userTools, user?.role)
```
Cambiar a:
```typescript
const canManage = canManageDevTasks(userTools)
```

- [ ] **Paso 2.4: Commit**

```bash
git add backend/app/routers/herramientas_tareas.py frontend/src/lib/permissions.ts frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
git commit -m "fix(tareas): eliminar bypass admin — permisos basados en tools únicamente"
```

---

## Tarea 3: Aislamiento de tareas por team_id

Esta es la corrección del bug principal. Las tareas pasan a filtrarse por `team_id` real en lugar de por `subido_por_id`.

**Files:**
- Modify: `backend/app/services/task_team_service.py`
- Modify: `backend/app/services/task_dashboard_service.py`
- Modify: `backend/app/services/work_task_service.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Paso 3.1: Agregar `get_user_active_teams` en `task_team_service.py`**

Al final de `backend/app/services/task_team_service.py` agregar:

```python
def get_user_active_teams(db: Session, user_id: int) -> list[dict]:
    """Retorna todos los equipos donde el usuario tiene membresía activa."""
    memberships = db.exec(
        select(TaskTeamMember, TaskTeam)
        .join(TaskTeam, TaskTeamMember.team_id == TaskTeam.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).all()
    return [
        {
            "team_id": team.id,
            "team_name": team.name,
            "owner_id": team.owner_user_id,
        }
        for membership, team in memberships
    ]
```

- [ ] **Paso 3.2: Corregir `get_team_tasks` para filtrar por `team_id`**

En `backend/app/services/task_dashboard_service.py`, reemplazar la función `get_team_tasks` completa:

```python
def get_team_tasks(db: Session, filters: TaskFilters, owner_id: int) -> list[WorkTask]:
    """Retorna tareas del equipo del gestor (owner_id), filtrando por team_id real.
    owner_id es siempre el user_id del gestor primario que posee el equipo.
    """
    from app.services.task_team_service import get_manager_team

    team = get_manager_team(db, owner_id)
    if not team:
        return []

    query = select(WorkTask).where(WorkTask.team_id == team.id)

    if filters.responsable_id is not None:
        query = query.where(WorkTask.subido_por_id == filters.responsable_id)

    if filters.fecha_desde is not None:
        query = query.where(WorkTask.fecha >= filters.fecha_desde)
    if filters.fecha_hasta is not None:
        query = query.where(WorkTask.fecha <= filters.fecha_hasta)
    if filters.estado is not None:
        query = query.where(WorkTask.estado == filters.estado)
    if filters.etiqueta is not None:
        query = query.where(WorkTask.etiqueta == filters.etiqueta)
    if filters.plataforma is not None:
        query = query.where(WorkTask.plataforma == filters.plataforma)
    if filters.q is not None and filters.q.strip():
        term = f"%{filters.q.strip()}%"
        query = query.where(
            WorkTask.titulo.ilike(term) | WorkTask.descripcion_tecnica.ilike(term)  # type: ignore[union-attr]
        )

    if filters.sin_registro_hoy:
        hoy = date.today()
        active_ids = _get_team_member_ids(db, owner_id)
        ids_con_registro = set(db.exec(
            select(WorkTask.subido_por_id).where(
                WorkTask.team_id == team.id,
                WorkTask.fecha == hoy,
            )
        ).all())
        ids_sin_registro = [uid for uid in active_ids if uid not in ids_con_registro]
        if not ids_sin_registro:
            return []
        query = query.where(WorkTask.subido_por_id.in_(ids_sin_registro))  # type: ignore[union-attr]

    return list(db.exec(query).all())
```

- [ ] **Paso 3.3: Corregir `create_task` para asignar `team_id`**

En `backend/app/services/work_task_service.py`, reemplazar `create_task`:

```python
def create_task(db: Session, user: User, payload: WorkTaskCreate) -> WorkTask:
    """Crea una tarea. Asigna team_id automáticamente si el usuario tiene un solo equipo.
    Si tiene múltiples equipos, el payload debe incluir team_id explícito.
    Si no tiene equipo, la tarea queda huérfana (team_id=None).
    """
    from app.services.task_team_service import get_user_active_teams

    validate_task_values(db, user, payload.etiqueta, payload.plataforma, payload.estado)
    now = datetime.now(timezone.utc)
    minutos = calcular_minutos(payload.hora_inicio, payload.hora_cierre)

    team_id = payload.team_id
    if team_id is None:
        active_teams = get_user_active_teams(db, user.id)  # type: ignore[arg-type]
        if len(active_teams) == 1:
            team_id = active_teams[0]["team_id"]
        elif len(active_teams) > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Perteneces a múltiples equipos. Selecciona el equipo para esta tarea.",
            )
        # len == 0: sin equipo, team_id queda None (tarea huérfana)

    task = WorkTask(
        scope="desarrollo_innovacion",
        team_id=team_id,
        subido_por_id=user.id,
        subido_por_nombre=user.full_name or user.email,
        fecha=payload.fecha if payload.fecha is not None else date.today(),
        hora_inicio=payload.hora_inicio,
        hora_cierre=payload.hora_cierre,
        tiempo_total_minutos=minutos,
        etiqueta=payload.etiqueta,
        plataforma=payload.plataforma,
        titulo=payload.titulo,
        descripcion_tecnica=payload.descripcion_tecnica,
        estado=payload.estado,
        prioridad=payload.prioridad,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    log_activity(
        db,
        task_id=task.id,
        user_id=task.subido_por_id,
        user_nombre=task.subido_por_nombre,
        accion="creacion",
        detalle=f"Tarea creada: {task.titulo}",
    )
    db.commit()
    return task
```

- [ ] **Paso 3.4: Agregar endpoint `GET /mis-equipos`**

En `backend/app/routers/herramientas_tareas.py`, agregar después de los imports iniciales (antes del primer endpoint):

```python
class UserTeamInfo(BaseModel):
    team_id: int
    team_name: str
    owner_id: int
```

Y el endpoint (en la sección de endpoints de usuario, después de `/mis-metricas`):

```python
@router.get("/mis-equipos", response_model=list[UserTeamInfo])
def get_mis_equipos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserTeamInfo]:
    """Retorna los equipos activos del usuario. Usado para el selector de equipo en el formulario."""
    require_tool_or_403(db, current_user, TOOL_SUBMIT)
    from app.services.task_team_service import get_user_active_teams
    teams = get_user_active_teams(db, current_user.id)  # type: ignore[arg-type]
    return [UserTeamInfo(**t) for t in teams]
```

- [ ] **Paso 3.5: Verificar en logs que el backend inicia sin error**

```bash
docker compose up backend --build 2>&1 | grep -E "ERROR|Uvicorn|Started"
```

Resultado esperado: `Uvicorn running on http://0.0.0.0:8000` sin errores.

- [ ] **Paso 3.6: Commit**

```bash
git add backend/app/services/task_team_service.py backend/app/services/task_dashboard_service.py backend/app/services/work_task_service.py backend/app/routers/herramientas_tareas.py
git commit -m "fix(tareas): aislar tareas por team_id real — corrige bug de tareas en todos los workspaces"
```

---

## Tarea 4: Frontend — prioridad y selector de equipo en TaskForm

**Files:**
- Modify: `frontend/src/types/workTask.ts`
- Modify: `frontend/src/hooks/useWorkTasks.ts`
- Modify: `frontend/src/components/herramientas/tareas/TaskForm.tsx`

- [ ] **Paso 4.1: Actualizar tipos en `workTask.ts`**

En `frontend/src/types/workTask.ts`:

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
  prioridad: string
  created_at: string
  updated_at: string
}

export interface WorkTaskCreate {
  titulo: string
  descripcion_tecnica: string
  etiqueta?: string
  plataforma?: string
  estado?: string
  prioridad?: string
  team_id?: number
  fecha?: string
  hora_inicio?: string
  hora_cierre?: string
}

export interface WorkTaskUpdate {
  titulo?: string
  descripcion_tecnica?: string
  etiqueta?: string
  plataforma?: string
  estado?: string
  prioridad?: string
  fecha?: string
  hora_inicio?: string
  hora_cierre?: string
}

export interface TaskTeamMember {
  id: number
  team_id: number
  user_id: number
  user_email: string
  user_full_name: string | null
  role: string                  // 'member' | 'co_gestor'
  is_active: boolean
  created_at: string
}

export interface UserTeamInfo {
  team_id: number
  team_name: string
  owner_id: number
}
```

Mantener el resto de interfaces sin cambios (`TaskKpis`, `PersonTaskSummary`, etc.).

- [ ] **Paso 4.2: Agregar hook `useMyTeams`**

En `frontend/src/hooks/useWorkTasks.ts`, agregar después de `useMyTaskMetrics`:

```typescript
export function useMyTeams() {
  return useQuery({
    queryKey: ["tareas", "mis-equipos"],
    queryFn: async () => {
      const { data } = await api.get<UserTeamInfo[]>(`${BASE}/mis-equipos`)
      return data
    },
  })
}
```

Agregar `UserTeamInfo` al import de tipos al inicio del archivo.

- [ ] **Paso 4.3: Actualizar `TaskForm` con prioridad y selector de equipo**

Reemplazar `frontend/src/components/herramientas/tareas/TaskForm.tsx` completo:

```typescript
import { useState } from "react"
import type { WorkTaskCreate } from "@/types/workTask"
import { useTaskLists, useMyTeams } from "@/hooks/useWorkTasks"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
  formatMinutos,
} from "@/lib/taskTheme"

interface TaskFormProps {
  onSubmit: (payload: WorkTaskCreate) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

function calcMinutos(inicio: string, cierre: string): number | null {
  if (!inicio || !cierre) return null
  const [h1, m1] = inicio.split(":").map(Number)
  const [h2, m2] = cierre.split(":").map(Number)
  const total = (h2 * 60 + m2) - (h1 * 60 + m1)
  return total > 0 ? total : null
}

export function TaskForm({ onSubmit, onCancel, loading }: TaskFormProps) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: lists } = useTaskLists()
  const { data: myTeams = [] } = useMyTeams()

  const etiquetas = lists?.etiqueta ?? []
  const plataformas = lists?.plataforma ?? []
  const estados = lists?.estado ?? []

  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [etiqueta, setEtiqueta] = useState<string>("")
  const [plataforma, setPlataforma] = useState<string>("")
  const [fecha, setFecha] = useState(today)
  const [estado, setEstado] = useState<string>("")
  const [prioridad, setPrioridad] = useState<string>("media")
  const [teamId, setTeamId] = useState<number | undefined>(undefined)
  const [horaInicio, setHoraInicio] = useState("")
  const [horaCierre, setHoraCierre] = useState("")

  const minutos = calcMinutos(horaInicio, horaCierre)
  const needsTeamSelector = myTeams.length > 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: WorkTaskCreate = {
      titulo,
      descripcion_tecnica: descripcion,
      ...(etiqueta && { etiqueta }),
      ...(plataforma && { plataforma }),
      ...(estado && { estado }),
      prioridad,
      ...(needsTeamSelector && teamId ? { team_id: teamId } : {}),
      fecha,
      hora_inicio: horaInicio ? new Date(`${fecha}T${horaInicio}:00`).toISOString() : undefined,
      hora_cierre: horaCierre ? new Date(`${fecha}T${horaCierre}:00`).toISOString() : undefined,
    }
    await onSubmit(payload)
    setTitulo("")
    setDescripcion("")
    setEtiqueta("")
    setPlataforma("")
    setFecha(today)
    setEstado("")
    setPrioridad("media")
    setTeamId(undefined)
    setHoraInicio("")
    setHoraCierre("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {needsTeamSelector && (
        <div>
          <label className={taskLabel}>Equipo *</label>
          <select
            className={taskInput}
            value={teamId ?? ""}
            onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : undefined)}
            required
          >
            <option value="">Seleccionar equipo...</option>
            {myTeams.map((t) => (
              <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={taskLabel}>Título *</label>
        <input
          className={taskInput}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Descripción breve de la tarea"
          required
        />
      </div>

      <div>
        <label className={taskLabel}>Descripción técnica</label>
        <textarea
          className={`${taskInput} resize-none`}
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalle técnico, pasos realizados, observaciones..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={taskLabel}>Etiqueta</label>
          <select className={taskInput} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
            <option value="">Seleccionar...</option>
            {etiquetas.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Plataforma</label>
          <select className={taskInput} value={plataforma} onChange={(e) => setPlataforma(e.target.value)}>
            <option value="">Seleccionar...</option>
            {plataformas.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Fecha</label>
          <input
            type="date"
            className={taskInput}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={taskLabel}>Estado</label>
          <select className={taskInput} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Seleccionar...</option>
            {estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Prioridad</label>
          <select className={taskInput} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <div>
          <label className={taskLabel}>Hora inicio</label>
          <input type="time" className={taskInput} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>

        <div>
          <label className={taskLabel}>Hora cierre</label>
          <input type="time" className={taskInput} value={horaCierre} onChange={(e) => setHoraCierre(e.target.value)} />
        </div>
      </div>

      {minutos !== null && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
          Tiempo calculado: <span className="font-semibold text-gray-900">{formatMinutos(minutos)}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" className={taskButtonPrimary} disabled={loading}>
          {loading ? "Guardando..." : "Registrar tarea"}
        </button>
        {onCancel && (
          <button type="button" className={taskButtonSecondary} onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Paso 4.4: Verificar TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sin errores.

- [ ] **Paso 4.5: Commit**

```bash
git add frontend/src/types/workTask.ts frontend/src/hooks/useWorkTasks.ts frontend/src/components/herramientas/tareas/TaskForm.tsx
git commit -m "feat(tareas): agregar prioridad y selector de equipo adaptativo en formulario"
```

---

## Tarea 5: Co-gestor backend

**Files:**
- Modify: `backend/app/services/task_team_service.py`
- Modify: `backend/app/schemas/task_team.py`
- Modify: `backend/app/routers/herramientas_tareas.py`

- [ ] **Paso 5.1: Agregar funciones co-gestor en `task_team_service.py`**

Agregar al final de `backend/app/services/task_team_service.py`:

```python
def get_comanaged_owner_id(db: Session, user_id: int) -> int | None:
    """Si el usuario es co_gestor en algún equipo activo, retorna el owner_user_id de ese equipo.
    Retorna None si el usuario no es co-gestor de ningún equipo.
    """
    membership = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.role == "co_gestor")
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()
    if not membership:
        return None
    team = db.get(TaskTeam, membership.team_id)
    return team.owner_user_id if team else None


def promote_to_cogestor(db: Session, user_id: int, owner_id: int) -> TaskTeamMember:
    """Promueve un miembro activo a co_gestor. Solo el gestor primario puede llamar esto."""
    team = get_or_create_manager_team(db, owner_id)
    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Miembro no encontrado en el equipo.")
    member.role = "co_gestor"
    member.updated_at = datetime.now(timezone.utc)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def demote_to_member(db: Session, user_id: int, owner_id: int) -> TaskTeamMember:
    """Degrada un co_gestor a miembro normal. Solo el gestor primario puede llamar esto."""
    team = get_or_create_manager_team(db, owner_id)
    member = db.exec(
        select(TaskTeamMember)
        .where(TaskTeamMember.team_id == team.id)
        .where(TaskTeamMember.user_id == user_id)
        .where(TaskTeamMember.is_active == True)  # noqa: E712
    ).first()
    if not member:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Miembro no encontrado en el equipo.")
    member.role = "member"
    member.updated_at = datetime.now(timezone.utc)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member
```

- [ ] **Paso 5.2: Agregar `_require_manage_access` en el router y actualizar endpoints**

Primero agregar los imports faltantes en `backend/app/routers/herramientas_tareas.py`:

```python
from app.core.deps import get_current_user, get_db, require_admin
from app.services.user_tool_service import require_tool_or_403, user_has_tool
```

Luego reemplazar la función `_owner_id` (ya corregida en Tarea 2) con la nueva `_require_manage_access`:

```python
def _require_manage_access(db: Session, current_user: User) -> int:
    """Valida que el usuario puede gestionar un equipo.
    Permite: gestor primario (TOOL_MANAGE) o co-gestor (role=co_gestor en algún equipo).
    Retorna el owner_id del equipo a gestionar.
    Lanza 403 si no tiene acceso.
    """
    from app.services.task_team_service import get_comanaged_owner_id

    if user_has_tool(db, current_user, TOOL_MANAGE):
        return current_user.id

    owner_id = get_comanaged_owner_id(db, current_user.id)
    if owner_id:
        return owner_id

    raise HTTPException(status_code=403, detail="Acceso denegado. Se requiere rol de gestor o co-gestor.")
```

Luego reemplazar **todos** los bloques en endpoints de manager que hacen:
```python
require_tool_or_403(db, current_user, TOOL_MANAGE)
# ...
_owner_id(current_user)   # o _owner_id(current_user) directamente en la llamada
```

Por:
```python
owner_id = _require_manage_access(db, current_user)
```

Y usar `owner_id` en lugar de `_owner_id(current_user)` en las llamadas a servicios.

Los endpoints afectados son: `get_equipo_tasks`, `get_equipo_kpis`, `get_equipo_personas`, `get_equipo_graficas`, `get_equipo_sin_registro_hoy`, `get_equipo_config_miembros`, `add_team_member_endpoint`, `remove_team_member_endpoint`, `get_equipo_tareas_paginadas`, `get_task_lists`, `create_task_list_item`, `update_task_list_item`, `delete_task_list_item`.

**Excepción:** Los endpoints de promover/degradar (Paso 5.3) verifican que solo el gestor primario puede hacerlo — usan `require_tool_or_403(db, current_user, TOOL_MANAGE)` directamente.

- [ ] **Paso 5.3: Agregar endpoints de promover y degradar**

En `backend/app/routers/herramientas_tareas.py`, después del endpoint `remove_team_member_endpoint`:

```python
@router.post("/equipo/config/miembros/{user_id}/promover", response_model=TaskTeamMemberRead)
def promote_team_member(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskTeamMemberRead:
    """Promueve un miembro a co-gestor. Solo el gestor primario puede hacer esto."""
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_team_service import promote_to_cogestor
    from app.models.user import User as UserModel

    member = promote_to_cogestor(db, user_id, current_user.id)
    user = db.get(UserModel, member.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return TaskTeamMemberRead(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        user_email=user.email,
        user_full_name=user.full_name,
        role=member.role,
        is_active=member.is_active,
        created_at=member.created_at,
    )


@router.post("/equipo/config/miembros/{user_id}/degradar", response_model=TaskTeamMemberRead)
def demote_team_member(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskTeamMemberRead:
    """Degrada un co-gestor a miembro. Solo el gestor primario puede hacer esto."""
    require_tool_or_403(db, current_user, TOOL_MANAGE)

    from app.services.task_team_service import demote_to_member
    from app.models.user import User as UserModel

    member = demote_to_member(db, user_id, current_user.id)
    user = db.get(UserModel, member.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return TaskTeamMemberRead(
        id=member.id,
        team_id=member.team_id,
        user_id=member.user_id,
        user_email=user.email,
        user_full_name=user.full_name,
        role=member.role,
        is_active=member.is_active,
        created_at=member.created_at,
    )
```

- [ ] **Paso 5.4: Actualizar el endpoint `get_equipo_config_miembros` para incluir `role`**

En el endpoint `GET /equipo/config/miembros`, en el map que construye `TaskTeamMemberRead`, agregar `role=m.role`:

```python
return [
    TaskTeamMemberRead(
        id=m.id,
        team_id=m.team_id,
        user_id=m.user_id,
        user_email=users_map[m.user_id].email,
        user_full_name=users_map[m.user_id].full_name,
        role=m.role,
        is_active=m.is_active,
        created_at=m.created_at,
    )
    for m in members
    if m.user_id in users_map
]
```

- [ ] **Paso 5.5: Verificar backend arranca sin errores**

```bash
docker compose up backend --build 2>&1 | grep -E "ERROR|Uvicorn"
```

- [ ] **Paso 5.6: Commit**

```bash
git add backend/app/services/task_team_service.py backend/app/routers/herramientas_tareas.py backend/app/schemas/task_team.py
git commit -m "feat(tareas): implementar co-gestor — promover/degradar y acceso compartido al dashboard"
```

---

## Tarea 6: Co-gestor frontend

**Files:**
- Modify: `frontend/src/lib/permissions.ts`
- Modify: `frontend/src/hooks/useWorkTasks.ts`
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`
- Modify: `frontend/src/components/herramientas/tareas/TeamConfigTab.tsx` (si existe, o el componente equivalente)

- [ ] **Paso 6.1: Agregar `canCoManageDevTasks` en permissions.ts**

En `frontend/src/lib/permissions.ts`, agregar al final:

```typescript
/**
 * Puede co-gestionar si es co_gestor en al menos un equipo.
 * Se determina verificando los miembros del equipo que retorna el backend.
 * En el frontend, se usa la información del equipo cargado.
 */
export function isCoGestor(members: Array<{ user_id: number; role: string }>, userId: number): boolean {
  return members.some((m) => m.user_id === userId && m.role === "co_gestor")
}
```

- [ ] **Paso 6.2: Agregar hooks de promover/degradar en `useWorkTasks.ts`**

En `frontend/src/hooks/useWorkTasks.ts`, agregar después de `useRemoveTeamMember`:

```typescript
export function usePromoteToCogestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: number) => {
      const { data } = await api.post<TaskTeamMember>(
        `${BASE}/equipo/config/miembros/${user_id}/promover`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "miembros"] })
    },
  })
}

export function useDemoteToMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (user_id: number) => {
      const { data } = await api.post<TaskTeamMember>(
        `${BASE}/equipo/config/miembros/${user_id}/degradar`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas", "equipo", "miembros"] })
    },
  })
}
```

- [ ] **Paso 6.3: Actualizar `GestionTareasPage` para detectar co-gestores**

En `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`:

1. Agregar import del hook de miembros y la función de permisos:
```typescript
import { useTeamMembers } from "@/hooks/useWorkTasks"
import { canManageDevTasks, isCoGestor } from "@/lib/permissions"
```

2. Agregar consulta de miembros del equipo para detectar co-gestor:
```typescript
const { data: teamMembers = [] } = useTeamMembers()
const isUserCoGestor = isCoGestor(
  teamMembers.map((m) => ({ user_id: m.user_id, role: m.role })),
  user?.id ?? -1
)
const canManage = canManageDevTasks(userTools) || isUserCoGestor
```

**Nota:** `useTeamMembers` llama a `GET /equipo/config/miembros` que requiere `TOOL_MANAGE`. Para co-gestores esto ahora también funciona gracias a `_require_manage_access`. Si el usuario no tiene acceso, la query retorna error y `teamMembers` queda `[]`, por lo que `isUserCoGestor` será `false`.

- [ ] **Paso 6.4: Actualizar TeamConfigTab para botones promover/degradar**

Buscar el componente que renderiza la lista de miembros del equipo:
```bash
grep -rn "TaskTeamMember\|useTeamMembers\|equipo.*config" frontend/src/components/ | head -10
```

En el componente que lista miembros (normalmente `TeamConfigTab.tsx`), agregar botón de promover/degradar a cada fila. La fila de un miembro debe mostrar:

```typescript
import { usePromoteToCogestor, useDemoteToMember } from "@/hooks/useWorkTasks"

// Dentro del componente:
const promote = usePromoteToCogestor()
const demote = useDemoteToMember()

// En el render de cada miembro (m: TaskTeamMember):
{m.role === "member" ? (
  <button
    onClick={() => promote.mutate(m.user_id)}
    disabled={promote.isPending}
    className="text-xs text-blue-600 hover:text-blue-800"
    title="Promover a co-gestor"
  >
    Promover
  </button>
) : (
  <button
    onClick={() => demote.mutate(m.user_id)}
    disabled={demote.isPending}
    className="text-xs text-gray-500 hover:text-gray-700"
    title="Degradar a miembro"
  >
    Co-gestor ↓
  </button>
)}
```

- [ ] **Paso 6.5: Verificar TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Paso 6.6: Commit**

```bash
git add frontend/src/lib/permissions.ts frontend/src/hooks/useWorkTasks.ts frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
git commit -m "feat(tareas): soporte co-gestor en frontend — detección y botones promover/degradar"
```

---

## Tarea 7: Admin — borrado de tareas (backend)

**Files:**
- Modify: `backend/app/routers/herramientas_tareas.py`
- Modify: `backend/app/routers/auth.py`

- [ ] **Paso 7.1: Agregar endpoints de admin para gestión de tareas**

En `backend/app/routers/herramientas_tareas.py`, agregar al final de la sección admin (después de los endpoints existentes de `/admin/`):

```python
@router.get("/admin/tareas-usuario/{user_id}", response_model=list[WorkTaskRead])
def get_user_tasks_admin(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[WorkTaskRead]:
    """Retorna todas las tareas de un usuario (admin only). Incluye tareas huérfanas."""
    from sqlmodel import select as sqlmodel_select

    tasks = db.exec(
        sqlmodel_select(WorkTask)
        .where(WorkTask.subido_por_id == user_id)
        .order_by(WorkTask.fecha.desc(), WorkTask.created_at.desc())
    ).all()
    return [WorkTaskRead.model_validate(t) for t in tasks]


@router.delete("/admin/tareas/{task_id}")
def delete_task_admin(
    task_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Elimina permanentemente una tarea específica (admin only)."""
    task = db.get(WorkTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")
    db.delete(task)
    db.commit()
    return {"ok": True, "deleted_id": task_id}
```

Asegurarse de que `require_admin` está importado. Verificar que `WorkTask` está importado en el router (ya está desde los modelos).

- [ ] **Paso 7.2: Actualizar `delete_user_permanently` para opción `delete_tasks`**

En `backend/app/routers/auth.py`, reemplazar el endpoint `delete_user_permanently`:

```python
@router.delete("/users/{user_id}/eliminar")
def delete_user_permanently(
    user_id: int,
    delete_tasks: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Elimina permanentemente un usuario archivado.
    delete_tasks=True: borra todas sus tareas.
    delete_tasks=False (default): las tareas quedan huérfanas (team_id sin cambio, sin asignación).
    """
    from app.models.work_task import WorkTask as WorkTaskModel
    from sqlmodel import select as sqlmodel_select

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.is_active:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar usuarios archivados.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo.")

    if delete_tasks:
        tasks = db.exec(
            sqlmodel_select(WorkTaskModel).where(WorkTaskModel.subido_por_id == user_id)
        ).all()
        for task in tasks:
            db.delete(task)

    db.delete(user)
    db.commit()
    return {"ok": True}
```

- [ ] **Paso 7.3: Verificar backend arranca sin errores**

```bash
docker compose up backend --build 2>&1 | grep -E "ERROR|Uvicorn"
```

- [ ] **Paso 7.4: Commit**

```bash
git add backend/app/routers/herramientas_tareas.py backend/app/routers/auth.py
git commit -m "feat(tareas): endpoints admin — ver/borrar tareas de usuario y opción al eliminar cuenta"
```

---

## Tarea 8: Admin — panel de tareas en frontend (AdminPage)

**Files:**
- Modify: `frontend/src/hooks/useWorkTasks.ts`
- Modify: `frontend/src/hooks/useUsers.ts`
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Paso 8.1: Agregar hooks admin de tareas en `useWorkTasks.ts`**

```typescript
export function useAdminUserTasks(userId: number | null) {
  return useQuery({
    queryKey: ["tareas", "admin", "user-tasks", userId],
    queryFn: async () => {
      const { data } = await api.get<WorkTask[]>(`${BASE}/admin/tareas-usuario/${userId}`)
      return data
    },
    enabled: userId !== null,
  })
}

export function useAdminDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: number) => {
      await api.delete(`${BASE}/admin/tareas/${taskId}`)
    },
    onSuccess: (_d, taskId) => {
      qc.invalidateQueries({ queryKey: ["tareas", "admin", "user-tasks"] })
    },
  })
}
```

- [ ] **Paso 8.2: Actualizar `useDeleteUser` en `useUsers.ts` para soportar `delete_tasks`**

En `frontend/src/hooks/useUsers.ts`, encontrar `useDeleteUser` y actualizarlo:

```typescript
export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, deleteTasks = false }: { id: number; deleteTasks?: boolean }) => {
      await api.delete(`/auth/users/${id}/eliminar?delete_tasks=${deleteTasks}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
    },
  })
}
```

- [ ] **Paso 8.3: Agregar pestaña "Tareas" en el detalle de usuario de `AdminPage.tsx`**

En `frontend/src/pages/AdminPage.tsx`:

1. Agregar imports:
```typescript
import { useAdminUserTasks, useAdminDeleteTask } from "@/hooks/useWorkTasks"
```

2. Dentro del componente de detalle de usuario (donde ya se muestran herramientas/permisos), agregar una nueva sección "Tareas". Buscar la estructura actual del panel de detalle y agregar después del bloque de tools existente:

```typescript
function UserTasksPanel({ userId }: { userId: number }) {
  const { data: tasks = [], isLoading } = useAdminUserTasks(userId)
  const deleteTask = useAdminDeleteTask()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  if (isLoading) return <p className="text-xs text-gray-400 py-2">Cargando tareas...</p>
  if (tasks.length === 0) return <p className="text-xs text-gray-400 py-2">Sin tareas registradas.</p>

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 text-xs">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-800 truncate block">{task.titulo}</span>
            <span className="text-gray-400">{task.fecha} · {task.prioridad} · {task.estado}</span>
          </div>
          {confirmId === task.id ? (
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => { deleteTask.mutate(task.id); setConfirmId(null) }}
                className="text-red-600 hover:text-red-800 font-semibold"
              >
                Confirmar
              </button>
              <button onClick={() => setConfirmId(null)} className="text-gray-400">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmId(task.id)}
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
              title="Borrar tarea"
            >
              🗑
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

3. Actualizar el botón de eliminar usuario para mostrar la opción de borrar tareas. Buscar donde se llama `deleteUser.mutate(user.id)` y reemplazar por un modal/confirmación que pregunte:

```typescript
const [deleteTasksConfirm, setDeleteTasksConfirm] = useState<"idle" | "ask" | "deleting">("idle")

// Reemplazar el handler de eliminar usuario:
function handleDeleteUser(userId: number) {
  setDeleteTasksConfirm("ask")
}

// Agregar modal de confirmación:
{deleteTasksConfirm === "ask" && selectedUser && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl space-y-3">
      <h3 className="font-semibold text-gray-900">Eliminar usuario</h3>
      <p className="text-sm text-gray-600">¿Qué hacer con las tareas de este usuario?</p>
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={() => { deleteUser.mutate({ id: selectedUser.id, deleteTasks: true }); setDeleteTasksConfirm("idle") }}
          className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
        >
          Eliminar usuario y sus tareas
        </button>
        <button
          onClick={() => { deleteUser.mutate({ id: selectedUser.id, deleteTasks: false }); setDeleteTasksConfirm("idle") }}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm"
        >
          Eliminar usuario, dejar tareas dormidas
        </button>
        <button
          onClick={() => setDeleteTasksConfirm("idle")}
          className="w-full py-2 text-gray-400 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
```

4. Agregar la sección de tareas en el panel de detalle de usuario (en la sección de herramientas existente, agregar un bloque "Tareas"):
```typescript
{selectedUser && (
  <div className="mt-4">
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tareas</h4>
    <UserTasksPanel userId={selectedUser.id} />
  </div>
)}
```

- [ ] **Paso 8.4: Verificar TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Paso 8.5: Commit**

```bash
git add frontend/src/hooks/useWorkTasks.ts frontend/src/hooks/useUsers.ts frontend/src/pages/AdminPage.tsx
git commit -m "feat(admin): panel de tareas en detalle de usuario — ver, borrar y opción al eliminar cuenta"
```

---

## Tarea 9: Build final y verificación end-to-end

- [ ] **Paso 9.1: Build completo**

```bash
docker compose build
docker compose up -d
```

- [ ] **Paso 9.2: Verificar logs de migración**

```bash
docker compose logs backend | grep -E "migrate|ERROR|Uvicorn"
```

Resultado esperado:
```
[migrate] Columna work_tasks.prioridad agregada.
Uvicorn running on http://0.0.0.0:8000
```

- [ ] **Paso 9.3: Checklist funcional**

Verificar manualmente en el navegador:

- [ ] Admin asigna `tool_task_manage_dev` a un usuario → usuario ve dashboard completo
- [ ] Gestor (admin de intranet con tool) ve SOLO su equipo, no todos los workspaces
- [ ] Gestor agrega miembro → miembro recibe `tool_task_submit_dev` automáticamente
- [ ] Miembro con 1 equipo registra tarea → `team_id` se asigna automáticamente
- [ ] Miembro con 2 equipos ve selector de equipo en el formulario
- [ ] Tarea nueva tiene campo prioridad (alta/media/baja)
- [ ] Gestor promueve miembro → aparece badge "Co-gestor" y botón "Degradar"
- [ ] Co-gestor inicia sesión → ve el mismo dashboard que el Gestor primario
- [ ] Co-gestor agrega un nuevo miembro al equipo
- [ ] Co-gestor NO puede promover a otros miembros a co-gestor (botón no aparece para co-gestores)
- [ ] Admin en Roles y Usuarios → selecciona usuario → pestaña "Tareas" muestra sus tareas
- [ ] Admin puede borrar una tarea individual con confirmación
- [ ] Admin elimina usuario archivado → modal pregunta si borrar tareas o dejar dormidas
- [ ] Tareas con `team_id=NULL` no aparecen en ningún workspace de gestor

- [ ] **Paso 9.4: Commit final si hay ajustes menores**

```bash
git add -p  # solo archivos modificados en ajustes
git commit -m "fix(tareas): ajustes post-verificación end-to-end"
```
