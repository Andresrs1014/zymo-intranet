# Reorganización Tabs — Gestión de Tareas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar los 3 tabs de Gestión de Tareas según la arquitectura correcta.

**Arquitectura deseada:**

| Tab | Contenido | Acceso |
|-----|------------|--------|
| 1 - Tareas | KPI Cards + Tabla de tareas (sin gráficos ni PersonCards) | Todos (admin + usuarios) |
| 2 - Gráficas | Gráficos completos | Solo admin |
| 3 - Configuración | CRUD de listas (estados, etiquetas, plataformas) | Solo admin |

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Zustand (authStore), TanStack Query, FastAPI + SQLModel (Python), SQLite.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` |
| Modificar | `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` |
| Modificar | `frontend/src/components/herramientas/tareas/TaskChartsTab.tsx` |
| Modificar | `frontend/src/components/herramientas/tareas/TeamConfigTab.tsx` |

---

## Task 1: Simplificar TaskManagerView — Tab 1 solo KPIs + tabla

**Problema:** `TaskManagerView` actual incluye PersonTaskCards y TaskCharts, que no pertenecen al Tab 1.

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`

- [ ] **Step 1.1: Leer el archivo actual**

```bash
cat frontend/src/components/herramientas/tareas/TaskManagerView.tsx
```

- [ ] **Step 1.2: Simplificar TaskManagerView**

Dejar solo:
- Header con título, botones de exportar y "Nueva tarea"
- Formulario de nueva tarea (si `canSubmitOwn`)
- Alert de usuarios sin registro hoy
- KPI Cards (6 métricas)
- Tabla de tareas (TaskDataTable)
- TaskDetailSheet y TaskTeamConfigDialog (diálogos)

**Eliminar:**
- Import de `useTeamPersonSummaries`
- Import de `PersonTaskCards`
- Import de `TaskCharts`
- Sección de PersonTaskCards
- Sección de Charts
- La prop `onFiltersChange` (ya se eliminó en commit anterior)

```typescript
import { useState } from "react"
import type { WorkTask, TaskFilters, WorkTaskCreate } from "@/types/workTask"
import {
  useTeamTasks,
  useTeamKpis,
  useUsersWithoutTodayEntry,
  useCreateWorkTask,
} from "@/hooks/useWorkTasks"
import { exportTasksExcel, exportTasksPdf } from "@/hooks/useTaskExports"
import { TaskDataTable } from "./TaskDataTable"
import { TaskDetailSheet } from "./TaskDetailSheet"
import { TaskTeamConfigDialog } from "./TaskTeamConfigDialog"
import { TaskForm } from "./TaskForm"
import {
  taskCard,
  taskButtonPrimary,
  taskButtonSecondary,
  formatMinutos,
} from "@/lib/taskTheme"

interface Props {
  canSubmitOwn?: boolean
  filters: TaskFilters
}

export function TaskManagerView({ canSubmitOwn, filters }: Props) {
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [teamConfigOpen, setTeamConfigOpen] = useState(false)
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const createTask = useCreateWorkTask()

  const { data: tasks } = useTeamTasks(filters)
  const { data: kpis } = useTeamKpis(filters)
  const { data: sinRegistro } = useUsersWithoutTodayEntry()

  const handleExportExcel = async () => {
    setExporting("excel")
    try { await exportTasksExcel(filters) } finally { setExporting(null) }
  }

  const handleExportPdf = async () => {
    setExporting("pdf")
    try { await exportTasksPdf(filters) } finally { setExporting(null) }
  }

  const handleNewTaskSubmit = async (payload: WorkTaskCreate) => {
    await createTask.mutateAsync(payload)
    setShowNewTaskForm(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de tareas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Equipo de Desarrollo e Innovación</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={taskButtonSecondary} onClick={handleExportExcel} disabled={exporting !== null}>
            {exporting === "excel" ? "Exportando..." : "Exportar Excel"}
          </button>
          <button type="button" className={taskButtonSecondary} onClick={handleExportPdf} disabled={exporting !== null}>
            {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
          </button>
          {canSubmitOwn && (
            <button type="button" className={taskButtonPrimary} onClick={() => setShowNewTaskForm((v) => !v)}>
              {showNewTaskForm ? "Cancelar" : "+ Nueva tarea"}
            </button>
          )}
        </div>
      </div>

      {showNewTaskForm && canSubmitOwn && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva tarea</h2>
          <TaskForm onSubmit={handleNewTaskSubmit} onCancel={() => setShowNewTaskForm(false)} loading={createTask.isPending} />
        </div>
      )}

      {sinRegistro && sinRegistro.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>{sinRegistro.length} miembro{sinRegistro.length > 1 ? "s" : ""} sin registro hoy:</strong>{" "}
          {sinRegistro.map((u: { nombre: string }) => u.nombre).join(", ")}.
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Tareas" value={kpis.tareas_registradas} />
          <KpiCard label="Horas" value={formatMinutos(kpis.horas_registradas * 60)} />
          <KpiCard label="Completadas" value={kpis.completadas} color="text-green-700" />
          <KpiCard label="En progreso" value={kpis.en_progreso} color="text-blue-700" />
          <KpiCard label="Bloqueadas" value={kpis.bloqueadas} color="text-red-700" />
          <KpiCard label="Usuarios activos" value={kpis.usuarios_activos} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tareas ({tasks?.length ?? 0})</h2>
        <TaskDataTable tasks={tasks ?? []} onRowClick={(t) => setSelectedTask(t)} />
      </div>

      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
      <TaskTeamConfigDialog open={teamConfigOpen} onClose={() => setTeamConfigOpen(false)} />
    </div>
  )
}

function KpiCard({ label, value, color = "text-gray-900" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className={`${taskCard} p-4`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 1.3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 1.4: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskManagerView.tsx
git commit -m "refactor(tareas): simplificar TaskManagerView — Tab 1 solo KPIs y tabla"
```

---

## Task 2: Mover gráficos al Tab 2 (solo admin)

**Problema:** Los gráficos deben estar en el Tab 2, accesible solo para admins.

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/TaskChartsTab.tsx`

- [ ] **Step 2.1: Leer TaskChartsTab.tsx actual**

```bash
cat frontend/src/components/herramientas/tareas/TaskChartsTab.tsx
```

- [ ] **Step 2.2: Verificar que TaskChartsTab ya tiene los gráficos**

El componente `TaskChartsTab` debería contener `TaskCharts` con los datos de `useTeamCharts`. Si no los tiene, agregarlos:

```typescript
import { useTeamCharts } from "@/hooks/useWorkTasks"
import { TaskCharts } from "./TaskCharts"

export function TaskChartsTab({ isManager }: { isManager: boolean }) {
  const { data: charts } = useTeamCharts({})

  const chartsData = charts as {
    tareas_por_responsable: { nombre: string; tareas: number }[]
    horas_por_responsable: { nombre: string; horas: number }[]
    distribucion_estado: { estado: string; cantidad: number }[]
    tareas_por_etiqueta: { etiqueta: string; cantidad: number }[]
    evolucion_completadas: { fecha: string; completadas: number }[]
  } | undefined

  if (!isManager) {
    return (
      <div className="text-sm text-muted-foreground">
        No tienes permisos para ver las gráficas.
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Gráficas del equipo</h2>
      {charts && <TaskCharts data={chartsData} />}
    </div>
  )
}
```

- [ ] **Step 2.3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 2.4: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskChartsTab.tsx
git commit -m "feat(tareas): mover gráficos al Tab 2 con restricción admin"
```

---

## Task 3: Implementar CRUD de listas en Tab 3 — Configuración

**Scope:** Admin puede editar las listas de Estados, Etiquetas y Plataformas. Estas listas se guardan en la base de datos.

**Architecture:**
- Backend: Nuevo endpoint o extender endpoint existente para gestionar listas
- Frontend: Nuevo componente `ListConfigTab.tsx` con formulario CRUD

**Files:**
- Create: `frontend/src/components/herramientas/tareas/ListConfigTab.tsx`
- Modify: `backend/app/routers/tasks.py` (o crear router si no existe)
- Create: `backend/app/services/list_config_service.py`
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`

- [ ] **Step 3.1: Analizar estructura actual del Tab 3**

Revisar `TeamConfigTab.tsx` para entender qué ya existe:

```bash
cat frontend/src/components/herramientas/tareas/TeamConfigTab.tsx
```

- [ ] **Step 3.2: Crear servicio backend para gestionar listas**

En `backend/app/services/list_config_service.py`:

```python
from typing import Optional
from sqlmodel import Session, select

# Lists se almacenan en una tabla de configuración o como constantes en BD
# Por ahora, retornar las listas actuales definidas en workTask.ts

def get_estados() -> list[str]:
    return ["completada", "en_progreso", "bloqueada"]

def get_etiquetas() -> list[str]:
    return ["desarrollos", "actualizaciones", "auditorias", "implementacion_okr", "tareas_diarias"]

def get_plataformas() -> list[str]:
    return ["logimat1", "logimat2", "imccargo", "imcdeposito", "transversal"]

def get_labels() -> dict:
    return {
        "estados": {
            "completada": "Completada",
            "en_progreso": "En progreso",
            "bloqueada": "Bloqueada",
        },
        "etiquetas": {
            "desarrollos": "Desarrollos",
            "actualizaciones": "Actualizaciones",
            "auditorias": "Auditorías",
            "implementacion_okr": "Implementación OKR",
            "tareas_diarias": "Tareas Diarias",
        },
        "plataformas": {
            "logimat1": "Logimat 1",
            "logimat2": "Logimat 2",
            "imccargo": "IMCCARGO",
            "imcdeposito": "IMC Depósito",
            "transversal": "Transversal",
        },
    }
```

- [ ] **Step 3.3: Crear router o endpoint en backend**

En `backend/app/routers/tasks.py`, agregar endpoint:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.list_config_service import get_estados, get_etiquetas, get_plataformas, get_labels

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/lists")
async def get_task_lists(db: AsyncSession = Depends(get_db)):
    return {
        "estados": get_estados(),
        "etiquetas": get_etiquetas(),
        "plataformas": get_plataformas(),
        "labels": get_labels(),
    }
```

**Nota:** Si se necesita persistencia real (que admin pueda agregar/editar/eliminar), crear tabla `TaskListConfig` en BD.

- [ ] **Step 3.4: Crear hook frontend para listas**

En `frontend/src/hooks/useWorkTasks.ts`, agregar:

```typescript
export function useTaskLists() {
  return useQuery({
    queryKey: ["taskLists"],
    queryFn: async () => {
      const res = await api.get("/api/tasks/lists")
      return res.data
    },
  })
}
```

- [ ] **Step 3.5: Crear ListConfigTab.tsx**

```typescript
import { useState } from "react"
import { useTaskLists } from "@/hooks/useWorkTasks"
import { taskCard, taskButtonPrimary, taskButtonSecondary } from "@/lib/taskTheme"

interface Props {
  isManager: boolean
}

export function ListConfigTab({ isManager }: Props) {
  const { data: lists, isLoading } = useTaskLists()

  if (!isManager) {
    return <p className="text-sm text-muted-foreground">No tienes permisos.</p>
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-lg font-semibold">Configuración de listas</h2>

      <ListSection title="Estados" items={lists?.estados ?? []} labels={lists?.labels?.estados ?? {}} />
      <ListSection title="Etiquetas" items={lists?.etiquetas ?? []} labels={lists?.labels?.etiquetas ?? {}} />
      <ListSection title="Plataformas" items={lists?.plataformas ?? []} labels={lists?.labels?.plataformas ?? {}} />
    </div>
  )
}

function ListSection({ title, items, labels }: { title: string; items: string[]; labels: Record<string, string> }) {
  return (
    <div className={`${taskCard} p-4`}>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="px-3 py-1 rounded-full bg-gray-100 text-sm border border-gray-200"
          >
            {labels[item] ?? item}
          </span>
        ))}
      </div>
      {false && ( // placeholder para futuro: botón "Editar" cuando se implemente persistencia
        <button className={`${taskButtonSecondary} mt-3 text-xs`}>Editar lista</button>
      )}
    </div>
  )
}
```

- [ ] **Step 3.6: Actualizar GestionTareasPage para usar ListConfigTab**

En `GestionTareasPage.tsx`, importar y usar `ListConfigTab` en el Tab 3:

```typescript
import { ListConfigTab } from "@/components/herramientas/tareas/ListConfigTab"
```

Y en el Tab 3:
```tsx
<TabsContent value="configuracion">
  <ListConfigTab isManager={canManage} />
</TabsContent>
```

- [ ] **Step 3.7: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3.8: Commit**

```bash
git add frontend/src/components/herramientas/tareas/ListConfigTab.tsx
git add backend/app/services/list_config_service.py
git add backend/app/routers/tasks.py  # si se modificó
git add frontend/src/hooks/useWorkTasks.ts
git add frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx
git commit -m "feat(tareas): agregar ListConfigTab para gestión de listas en Tab 3"
```

---

## Checklist final de verificación

- [ ] Tab 1 solo muestra KPIs + tabla de tareas (sin gráficos ni PersonCards)
- [ ] Tab 2 solo es accesible para admins y muestra gráficos
- [ ] Tab 3 muestra las listas de estados, etiquetas y plataformas
- [ ] `npx tsc --noEmit` pasa sin errores
- [ ] `docker compose build` pasa sin errores

(End of file - total 287 lines)