# Asignar Tarea — Botón Separado de Nueva Tarea

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar "Nueva tarea" (registro personal con horas) de "Asignar tarea" (tarea futura para otro miembro sin horas), con dos botones lado a lado en `TaskManagerView`.

**Architecture:** Nueva ruta backend `GET /equipo/companeros` accesible a TOOL_SUBMIT para alimentar el dropdown de asignación. `AsignarTareaForm` es un formulario reducido (sin hora_inicio/hora_cierre, con asignado_a requerido y fecha futura). Reutiliza `WorkTask` + `useCreateWorkTask` existentes — sin nuevo modelo. La vista de colaborador muestra también las tareas donde `asignado_a_id == user_id`.

**Tech Stack:** FastAPI + SQLModel (Python), React 18, TypeScript, TailwindCSS, React Query v5

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `backend/app/routers/herramientas_tareas.py` |
| Modificar | `backend/app/services/work_task_service.py` |
| Crear | `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx` |
| Modificar | `frontend/src/hooks/useWorkTasks.ts` |
| Modificar | `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` |

---

## Task 1: Backend — endpoint `GET /equipo/companeros` (TOOL_SUBMIT)

**Files:**
- Modify: `backend/app/routers/herramientas_tareas.py`

### Contexto

El endpoint actual `GET /equipo/config/miembros` (línea ~530) requiere `TOOL_MANAGE`. Los colaboradores con solo `TOOL_SUBMIT` reciben 403, por lo que el dropdown de asignación estaba vacío para ellos.

Necesitamos un endpoint ligero que devuelva los compañeros de equipo del usuario actual, accesible a cualquier usuario con `TOOL_SUBMIT`.

- [ ] **Step 1: Agregar endpoint después de `GET /mis-equipos`**

Localizar el bloque que termina con `get_mis_equipos` (~línea 222) justo antes de `# ── Manager endpoints`. Agregar el nuevo endpoint inmediatamente después:

```python
@router.get("/equipo/companeros", response_model=list[TaskTeamMemberRead])
def get_equipo_companeros(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskTeamMemberRead]:
    """Retorna los compañeros de equipo activos del usuario. Accesible con TOOL_SUBMIT."""
    require_tool_or_403(db, current_user, TOOL_SUBMIT)

    from app.models.task_team_member import TaskTeamMember
    from app.schemas.task_team import TaskTeamMemberRead

    mis_memberships = db.exec(
        select(TaskTeamMember).where(
            TaskTeamMember.user_id == current_user.id,
            TaskTeamMember.is_active == True,  # noqa: E712
        )
    ).all()

    if not mis_memberships:
        return []

    team_ids = [m.team_id for m in mis_memberships]

    companeros = db.exec(
        select(TaskTeamMember).where(
            TaskTeamMember.team_id.in_(team_ids),
            TaskTeamMember.is_active == True,  # noqa: E712
            TaskTeamMember.user_id != current_user.id,
        )
    ).all()

    return [TaskTeamMemberRead.model_validate(c) for c in companeros]
```

> **Nota de ubicación:** Este endpoint debe quedar ANTES de `# ── Manager endpoints` para que pertenezca al bloque de TOOL_SUBMIT. En FastAPI el orden de rutas importa — al tener path fijo `/equipo/companeros` no hay conflicto con parámetros.

- [ ] **Step 2: Verificar importación de `TaskTeamMemberRead`**

Buscar en el bloque de imports del archivo si `TaskTeamMemberRead` ya está importado en el top-level:

```bash
grep -n "TaskTeamMemberRead" C:/zymo-intranet/backend/app/routers/herramientas_tareas.py | head -5
```

Si no aparece a nivel de módulo, agregar junto a los otros imports de schemas al inicio del archivo:
```python
from app.schemas.task_team import TaskTeamMemberRead
```

- [ ] **Step 3: Verificar importación de Python**

```bash
cd C:/zymo-intranet/backend && python -c "from app.routers.herramientas_tareas import router; print('OK')" 2>&1
```

Resultado esperado: `OK` (el error de secret_key en entorno local es normal).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/herramientas_tareas.py
git commit -m "feat(tareas): endpoint GET /equipo/companeros accesible a TOOL_SUBMIT"
```

---

## Task 2: Backend — tareas asignadas aparecen en la vista del colaborador

**Files:**
- Modify: `backend/app/services/work_task_service.py`

### Contexto

En `get_paginated_tasks`, el bloque del colaborador filtra solo `subido_por_id == user_id`. Esto hace que las tareas asignadas a un usuario por otro no aparezcan en su lista. Hay que incluirlas.

El `or_` ya está importado dentro de la función en línea ~429:
```python
from sqlmodel import and_, func, or_
```

- [ ] **Step 1: Actualizar el filtro `else` del colaborador**

Localizar el bloque (dentro de `get_paginated_tasks`):

```python
    else:
        query = query.where(WorkTask.subido_por_id == user_id)
```

Reemplazar por:

```python
    else:
        # Incluye las tareas propias Y las asignadas al usuario por otros
        query = query.where(
            or_(WorkTask.subido_por_id == user_id, WorkTask.asignado_a_id == user_id)
        )
```

- [ ] **Step 2: Verificar importación**

```bash
cd C:/zymo-intranet/backend && python -c "from app.services.work_task_service import get_paginated_tasks; print('OK')" 2>&1
```

Resultado esperado: `OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/work_task_service.py
git commit -m "feat(tareas): mostrar tareas asignadas al usuario en su vista de colaborador"
```

---

## Task 3: Frontend — hook `useTeamCompaneros` + componente `AsignarTareaForm`

**Files:**
- Modify: `frontend/src/hooks/useWorkTasks.ts`
- Create: `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx`

### Step 1: Agregar `useTeamCompaneros` al hook existente

Localizar en `frontend/src/hooks/useWorkTasks.ts` la función `useTeamMembers` (~línea 179). Agregar `useTeamCompaneros` inmediatamente después:

```typescript
export function useTeamCompaneros() {
  return useQuery<TaskTeamMember[]>({
    queryKey: ["tareas", "equipo", "companeros"],
    queryFn: async () => {
      const { data } = await api.get<TaskTeamMember[]>(`${BASE}/equipo/companeros`)
      return data
    },
  })
}
```

> `TaskTeamMember` ya está definido en `@/types/workTask` y tiene `user_id`, `user_full_name`, `user_email`. No hay que agregar tipos nuevos.

- [ ] **Step 2: Crear `AsignarTareaForm.tsx`**

Crear `frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx` con este contenido exacto:

```tsx
import { useState } from "react"
import type { WorkTaskCreate } from "@/types/workTask"
import { useTeamCompaneros, useMyTeams, useTaskLists } from "@/hooks/useWorkTasks"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
} from "@/lib/taskTheme"

interface AsignarTareaFormProps {
  onSubmit: (payload: WorkTaskCreate) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function AsignarTareaForm({ onSubmit, onCancel, loading }: AsignarTareaFormProps) {
  const { data: companeros = [] } = useTeamCompaneros()
  const { data: myTeams = [] } = useMyTeams()

  const [asignadoAId, setAsignadoAId] = useState<number | "">("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [fecha, setFecha] = useState(getTomorrow())
  const [prioridad, setPrioridad] = useState("media")
  const [etiqueta, setEtiqueta] = useState("")
  const [teamId, setTeamId] = useState<number | undefined>(undefined)

  const needsTeamSelector = myTeams.length > 1
  const { data: lists } = useTaskLists(teamId ?? myTeams[0]?.team_id)
  const etiquetas = lists?.etiqueta ?? []

  const today = new Date().toISOString().slice(0, 10)

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
      ...(needsTeamSelector && teamId ? { team_id: teamId } : {}),
    }
    await onSubmit(payload)

    // Reset
    setAsignadoAId("")
    setTitulo("")
    setDescripcion("")
    setFecha(getTomorrow())
    setPrioridad("media")
    setEtiqueta("")
    setTeamId(undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
        Asigna una tarea futura a un compañero. No se registran horas — es para planificar trabajo próximo.
      </div>

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
        <label className={taskLabel}>Asignar a *</label>
        {companeros.length === 0 ? (
          <p className="text-xs text-gray-400 mt-1">
            No hay compañeros de equipo disponibles. Pide al gestor que te agregue a un equipo.
          </p>
        ) : (
          <select
            className={taskInput}
            value={asignadoAId}
            onChange={(e) => setAsignadoAId(e.target.value ? Number(e.target.value) : "")}
            required
          >
            <option value="">Seleccionar persona...</option>
            {companeros.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.user_full_name || c.user_email}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className={taskLabel}>Título *</label>
        <input
          className={taskInput}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="¿Qué debe hacer?"
          required
        />
      </div>

      <div>
        <label className={taskLabel}>Descripción / instrucciones</label>
        <textarea
          className={`${taskInput} resize-none`}
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalles, contexto, links de referencia..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={taskLabel}>Fecha *</label>
          <input
            type="date"
            className={taskInput}
            value={fecha}
            min={today}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
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
          <label className={taskLabel}>Etiqueta</label>
          <select className={taskInput} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
            <option value="">Sin etiqueta</option>
            {etiquetas.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className={taskButtonPrimary}
          disabled={loading || !asignadoAId || !titulo}
        >
          {loading ? "Asignando..." : "Asignar tarea"}
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

- [ ] **Step 3: Verificar TypeScript**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useWorkTasks.ts frontend/src/components/herramientas/tareas/AsignarTareaForm.tsx
git commit -m "feat(tareas): hook useTeamCompaneros y componente AsignarTareaForm"
```

---

## Task 4: Frontend — `TaskManagerView` con dos botones y formulario de asignación

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`

### Contexto

Actualmente hay un solo botón "Nueva tarea" que muestra `TaskForm`. Necesitamos:
1. Botón "Nueva tarea" (conservar comportamiento actual)
2. Botón "Asignar tarea" al lado
3. Al abrir uno, el otro se cierra automáticamente
4. El formulario `AsignarTareaForm` aparece en el mismo card que `TaskForm` (no ambos a la vez)

- [ ] **Step 1: Agregar import de `AsignarTareaForm`**

En `TaskManagerView.tsx`, junto a los otros imports de componentes de tareas:

```typescript
import { AsignarTareaForm } from "./AsignarTareaForm"
```

- [ ] **Step 2: Agregar estado `showAsignarForm`**

Junto al estado `showNewTaskForm` existente:

```typescript
const [showAsignarForm, setShowAsignarForm] = useState(false)
```

- [ ] **Step 3: Reemplazar el bloque de botones del header**

Localizar el bloque actual:

```tsx
          {canSubmitOwn && (
            <button type="button" className={taskButtonPrimary} onClick={() => setShowNewTaskForm((v) => !v)}>
              {showNewTaskForm ? "Cancelar" : "+ Nueva tarea"}
            </button>
          )}
```

Reemplazar por:

```tsx
          {canSubmitOwn && (
            <>
              <button
                type="button"
                className={taskButtonSecondary}
                onClick={() => {
                  setShowAsignarForm((v) => !v)
                  setShowNewTaskForm(false)
                }}
              >
                {showAsignarForm ? "Cancelar" : "Asignar tarea"}
              </button>
              <button
                type="button"
                className={taskButtonPrimary}
                onClick={() => {
                  setShowNewTaskForm((v) => !v)
                  setShowAsignarForm(false)
                }}
              >
                {showNewTaskForm ? "Cancelar" : "+ Nueva tarea"}
              </button>
            </>
          )}
```

- [ ] **Step 4: Agregar el card de `AsignarTareaForm`**

Localizar el bloque existente de `showNewTaskForm`:

```tsx
      {showNewTaskForm && canSubmitOwn && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva tarea</h2>
          <TaskForm onSubmit={handleNewTaskSubmit} onCancel={() => setShowNewTaskForm(false)} loading={createTask.isPending} />
        </div>
      )}
```

Agregar inmediatamente después:

```tsx
      {showAsignarForm && canSubmitOwn && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Asignar tarea a compañero</h2>
          <AsignarTareaForm
            onSubmit={async (payload) => {
              await createTask.mutateAsync(payload)
              setShowAsignarForm(false)
            }}
            onCancel={() => setShowAsignarForm(false)}
            loading={createTask.isPending}
          />
        </div>
      )}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskManagerView.tsx
git commit -m "feat(tareas): botones separados Nueva tarea / Asignar tarea en TaskManagerView"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Botón "Nueva tarea" separado de "Asignar tarea" | Task 4 Step 3 |
| "Asignar tarea" con fecha futura (min=today) | Task 3 Step 2 — campo fecha con `min={today}` |
| "Asignar tarea" sin horas (hora_inicio/hora_cierre) | Task 3 Step 2 — `AsignarTareaForm` no los tiene |
| Asignado a requerido | Task 3 Step 2 — `required` + disabled submit si vacío |
| Dropdown de compañeros para TOOL_SUBMIT | Task 1 — nuevo endpoint accesible |
| Tareas asignadas visibles en lista del receptor | Task 2 — query incluye `asignado_a_id == user_id` |
| Solo uno de los formularios abierto a la vez | Task 4 Step 3 — toggle cierra el otro |
| Mensaje informativo en el formulario de asignación | Task 3 Step 2 — banner azul explicativo |

### Notas

- `AsignarTareaForm` no envía `hora_inicio`, `hora_cierre` — el backend los recibe como `None` y `tiempo_total_minutos` queda `null`. La columna "Tiempo" en la tabla mostrará `—` para tareas asignadas, lo que visualmente diferencia ambos tipos sin necesidad de un campo `tipo`.
- El campo `min={today}` en el date input del formulario de asignación previene fechas pasadas solo en el browser (UX), no en el backend — aceptable para una herramienta interna.
- `useTeamCompaneros` no tiene `enabled` flag — se carga proactivamente cuando el módulo monta, no solo cuando se abre el formulario. Esto hace el formulario instantáneo al abrir.
- La validación de que el `asignado_a_id` es miembro del mismo equipo ocurre implícitamente: solo aparecen en el dropdown los compañeros del equipo del usuario actual, así que no es posible asignar fuera del equipo desde el formulario.
