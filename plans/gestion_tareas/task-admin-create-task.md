# Plan: Permitir al admin cargar tareas en Gestión de Tareas

## Problema identificado

En `GestionTareasPage.tsx:88-92`:
- Si `canManage = true` (admin incluido) → muestra solo `TaskManagerView`
- Si `canManage = false` → muestra `TaskSubmitView` (que SÍ tiene botón "+ Nueva tarea")
- `TaskManagerView` recibe `canSubmitOwn={true}` pero **NO LO USA** (línea 24: `canSubmitOwn: _canSubmitOwn`)
- Resultado: admin puede gestionar pero **no puede crear tareas**

## Solución propuesta

Agregar `TaskForm` inline en `TaskManagerView` cuando el usuario puede crear tareas propias.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` | Usar prop `canSubmitOwn`, agregar estado `showForm`, importar `TaskForm` y `useCreateWorkTask` |

## Pasos de implementación

### 1. Agregar imports
```typescript
import { TaskForm } from "./TaskForm"
import type { WorkTaskCreate } from "@/types/workTask"
import { useCreateWorkTask } from "@/hooks/useWorkTasks"
```

### 2. Usar prop `canSubmitOwn` (quitar underscore)
Cambiar línea 24:
```typescript
// Antes
export function TaskManagerView({ canSubmitOwn: _canSubmitOwn }: ...
// Después
export function TaskManagerView({ canSubmitOwn }: { canSubmitOwn?: boolean } = {}) {
```

### 3. Agregar estado y hook
```typescript
const [showForm, setShowForm] = useState(false)
const createTask = useCreateWorkTask()

const handleSubmit = async (payload: WorkTaskCreate) => {
  await createTask.mutateAsync(payload)
  setShowForm(false)
}
```

### 4. Agregar botón en header (después de "Configurar equipo")
```typescript
{canSubmitOwn && (
  <button
    type="button"
    className={taskButtonPrimary}
    onClick={() => setShowForm((v) => !v)}
  >
    {showForm ? "Cancelar" : "+ Nueva tarea"}
  </button>
)}
```

### 5. Agregar formulario inline (antes de Filters)
```typescript
{showForm && canSubmitOwn && (
  <div className={`${taskCard} p-6`}>
    <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva tarea</h2>
    <TaskForm
      onSubmit={handleSubmit}
      onCancel={() => setShowForm(false)}
      loading={createTask.isPending}
    />
  </div>
)}
```

---

## Verificación (antes de cerrar)

- [ ] Build pasa sin errores
- [ ] Admin ve el botón "+ Nueva tarea" en TaskManagerView
- [ ] Click en botón muestra TaskForm inline
- [ ] Submit de tarea funciona (se crea y aparece en la tabla)
- [ ] No rompe funcionalidad existente de gestión de tareas

---

## Principios .cursorrules.md aplicados

- **Separación de capas**: lógica de submit en handler, no en componente UI
- **Código limpio**: función handler corta con responsabilidad única
- **Sin deuda oculta**: prop ya existía, solo se usa
- **Retrocompatible**: cambios incrementales, no afecta usuarios no-admin
