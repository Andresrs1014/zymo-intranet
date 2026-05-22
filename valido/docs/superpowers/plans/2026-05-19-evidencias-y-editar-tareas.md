# Evidencias y Editar Tareas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire los componentes de adjuntos (FileUploadZone, AttachmentList, FilePreviewModal) en TaskDetailSheet, y agregar edición inline de tareas restringida al creador (`subido_por_id === currentUserId`).

**Architecture:** Toda la UI del detalle de tareas vive en `TaskDetailSheet.tsx` (un panel lateral derecho, NOT un modal). Los componentes de adjuntos ya existen y funcionan — solo hay que integrarlos aquí. El modo edición reemplaza el contenido de vista dentro del mismo panel. `TaskManagerView` pasa `currentUserId` al sheet. Sin nuevos archivos ni endpoints.

**Tech Stack:** React 18, TypeScript, TailwindCSS (tokens de `taskTheme`), React Query v5, Zustand auth store, FastAPI (endpoint PATCH existente).

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx` |
| Modificar | `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` |

---

## Task 1: Evidencias (adjuntos) en TaskDetailSheet

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx`

Los componentes `FileUploadZone`, `AttachmentList`, `FilePreviewModal` y el hook `useTaskAttachments` ya existen. El patrón de integración está en `TaskDetailModal.tsx` (usa `useTaskAttachments`, estado `previewAttachment`, y renderiza los tres componentes).

- [ ] **Step 1: Leer el archivo actual completo**

```bash
cat C:/zymo-intranet/frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx
```

- [ ] **Step 2: Agregar imports**

Junto a los imports existentes agregar:

```tsx
import { useTaskAttachments } from "@/hooks/useTaskAttachments"
import { FileUploadZone } from "./FileUploadZone"
import { AttachmentList } from "./AttachmentList"
import { FilePreviewModal } from "./FilePreviewModal"
import type { TaskAttachment } from "@/types/workTask"
```

(`useState` ya está importado — no duplicar.)

- [ ] **Step 3: Agregar estado y query de adjuntos**

Dentro del componente, después de las líneas de `estadoOptions`, agregar:

```tsx
const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null)
const { data: liveAdjuntos } = useTaskAttachments(task ? task.id : null)
const adjuntos = liveAdjuntos ?? task?.adjuntos ?? []
```

- [ ] **Step 4: Agregar sección de evidencias en el contenido**

Dentro del `<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">`, después del bloque de `descripcion_tecnica` y antes del `</div>` de cierre del content area, agregar:

```tsx
{/* Evidencias */}
<div className="border-t border-gray-200 pt-4">
  <FileUploadZone taskId={task.id} />
  <AttachmentList
    taskId={task.id}
    attachments={adjuntos}
    onPreview={setPreviewAttachment}
  />
</div>
```

- [ ] **Step 5: Envolver el return en fragment y agregar FilePreviewModal fuera del aside**

El return actual tiene `<>...</>` que envuelve backdrop + aside. Agregar `FilePreviewModal` después del `</aside>` de cierre:

```tsx
return (
  <>
    {/* Backdrop */}
    <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />

    {/* Panel */}
    <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
      {/* ... todo el contenido existente ... */}
    </aside>

    {/* Preview modal — fuera del aside para correcto z-index de Radix portal */}
    <FilePreviewModal
      attachment={previewAttachment}
      open={!!previewAttachment}
      onClose={() => setPreviewAttachment(null)}
    />
  </>
)
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx
git commit -m "feat(tareas): integrar adjuntos (evidencias) en TaskDetailSheet"
```

---

## Task 2: Edición inline de tareas en TaskDetailSheet (solo el creador)

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx`
- Modify: `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`

### Contexto

- El hook de actualización es `useUpdateWorkTask()` en `useWorkTasks.ts` — toma `{ id: number; payload: WorkTaskUpdate }` y llama `PATCH /api/herramientas/tareas/{task_id}`.
- El backend ya valida ownership: si `task.subido_por_id != current_user.id` devuelve 403.
- `WorkTaskUpdate` tiene todos los campos opcionales: `titulo`, `descripcion_tecnica`, `etiqueta`, `plataforma`, `estado`, `prioridad`, `fecha`, `hora_inicio`, `hora_cierre`.
- Los tokens de estilo disponibles en `taskTheme.ts`: `taskInput`, `taskLabel`, `taskButtonPrimary`, `taskButtonSecondary`.
- `useTaskLists()` ya está siendo llamado en el componente para `estadoOptions` — extender para obtener también etiquetas y plataformas.

### Pasos

- [ ] **Step 1: Agregar imports adicionales**

En `TaskDetailSheet.tsx`, agregar a los imports existentes:

```tsx
import { useEffect } from "react"
import { useUpdateWorkTask } from "@/hooks/useWorkTasks"
import type { WorkTaskUpdate } from "@/types/workTask"
import {
  taskInput,
  taskLabel,
  taskButtonPrimary,
  taskButtonSecondary,
} from "@/lib/taskTheme"
```

(`useTaskLists` ya está importado. `useState` ya está importado.)

- [ ] **Step 2: Actualizar `TaskDetailSheetProps` para recibir `currentUserId`**

```tsx
interface TaskDetailSheetProps {
  task: WorkTask | null
  onClose: () => void
  onStatusChange?: (taskId: number, newEstado: string) => Promise<void>
  currentUserId?: number
}
```

- [ ] **Step 3: Actualizar la firma del componente y agregar estados de edición**

```tsx
export function TaskDetailSheet({ task, onClose, onStatusChange, currentUserId }: TaskDetailSheetProps) {
  // Estados existentes
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Nuevos estados de edición
  const [isEditing, setIsEditing] = useState(false)
  const [editFields, setEditFields] = useState<WorkTaskUpdate>({})
  const [editError, setEditError] = useState<string | null>(null)

  // Adjuntos (ya agregado en Task 1)
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null)
  const { data: liveAdjuntos } = useTaskAttachments(task ? task.id : null)
  const adjuntos = liveAdjuntos ?? task?.adjuntos ?? []

  // Listas para dropdowns
  const { data: lists } = useTaskLists()
  const estadoOptions = lists?.estado ?? []
  const etiquetaOptions = lists?.etiqueta ?? []
  const plataformaOptions = lists?.plataforma ?? []

  const updateTask = useUpdateWorkTask()

  const isOwner = currentUserId != null && task?.subido_por_id === currentUserId

  // Reset edit mode cuando cambia la tarea
  useEffect(() => {
    setIsEditing(false)
    setEditError(null)
  }, [task?.id])

  if (!task) return null
```

- [ ] **Step 4: Agregar handlers de edición**

Después del `handleStatusChange` existente, agregar:

```tsx
const enterEditMode = () => {
  setEditFields({
    titulo: task.titulo,
    descripcion_tecnica: task.descripcion_tecnica,
    etiqueta: task.etiqueta,
    plataforma: task.plataforma,
    estado: task.estado,
    prioridad: task.prioridad,
    fecha: task.fecha,
    hora_inicio: task.hora_inicio ?? undefined,
    hora_cierre: task.hora_cierre ?? undefined,
  })
  setEditError(null)
  setIsEditing(true)
}

const cancelEdit = () => {
  setIsEditing(false)
  setEditError(null)
}

const updateField = <K extends keyof WorkTaskUpdate>(key: K, value: WorkTaskUpdate[K]) => {
  setEditFields((prev) => ({ ...prev, [key]: value }))
}

const handleSaveEdit = async () => {
  setEditError(null)
  try {
    await updateTask.mutateAsync({ id: task.id, payload: editFields })
    setIsEditing(false)
    onClose()
  } catch (err: unknown) {
    if (
      typeof err === "object" && err !== null &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 403
    ) {
      setEditError("No tienes permiso para editar esta tarea.")
    } else {
      setEditError("Error al guardar los cambios. Intenta de nuevo.")
    }
  }
}
```

- [ ] **Step 5: Actualizar el header para mostrar botón Editar y cambiar título**

Reemplazar el `<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">` del header con:

```tsx
<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
  <h2 className="text-base font-semibold text-gray-900">
    {isEditing ? "Editar tarea" : "Detalle de tarea"}
  </h2>
  <div className="flex items-center gap-2">
    {isOwner && !isEditing && (
      <button
        type="button"
        onClick={enterEditMode}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        Editar
      </button>
    )}
    <button
      type="button"
      onClick={isEditing ? cancelEdit : onClose}
      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      aria-label={isEditing ? "Cancelar edición" : "Cerrar"}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  </div>
</div>
```

- [ ] **Step 6: Reemplazar el área de contenido con condicional vista/edición**

Reemplazar el `<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">` completo con:

```tsx
<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
  {isEditing ? (
    /* ── Modo Edición ── */
    <div className="space-y-4">
      <div>
        <label className={taskLabel}>Título *</label>
        <input
          className={taskInput}
          value={editFields.titulo ?? ""}
          onChange={(e) => updateField("titulo", e.target.value)}
          placeholder="Título de la tarea"
          required
        />
      </div>

      <div>
        <label className={taskLabel}>Descripción técnica</label>
        <textarea
          className={`${taskInput} resize-none`}
          rows={4}
          value={editFields.descripcion_tecnica ?? ""}
          onChange={(e) => updateField("descripcion_tecnica", e.target.value)}
          placeholder="Detalle técnico..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={taskLabel}>Etiqueta</label>
          <select
            className={taskInput}
            value={editFields.etiqueta ?? ""}
            onChange={(e) => updateField("etiqueta", e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {etiquetaOptions.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Plataforma</label>
          <select
            className={taskInput}
            value={editFields.plataforma ?? ""}
            onChange={(e) => updateField("plataforma", e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {plataformaOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Estado</label>
          <select
            className={taskInput}
            value={editFields.estado ?? ""}
            onChange={(e) => updateField("estado", e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {estadoOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}{s.is_final ? " 🏁" : s.is_canceled ? " ✕" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={taskLabel}>Prioridad</label>
          <select
            className={taskInput}
            value={editFields.prioridad ?? ""}
            onChange={(e) => updateField("prioridad", e.target.value)}
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <div>
          <label className={taskLabel}>Fecha</label>
          <input
            type="date"
            className={taskInput}
            value={editFields.fecha ?? ""}
            onChange={(e) => updateField("fecha", e.target.value)}
          />
        </div>

        <div>
          <label className={taskLabel}>Hora inicio</label>
          <input
            type="time"
            className={taskInput}
            value={editFields.hora_inicio ? new Date(editFields.hora_inicio).toTimeString().slice(0, 5) : ""}
            onChange={(e) => {
              const fecha = editFields.fecha ?? task.fecha
              updateField("hora_inicio", e.target.value ? new Date(`${fecha}T${e.target.value}:00`).toISOString() : undefined)
            }}
          />
        </div>

        <div className="col-span-2">
          <label className={taskLabel}>Hora cierre</label>
          <input
            type="time"
            className={taskInput}
            value={editFields.hora_cierre ? new Date(editFields.hora_cierre).toTimeString().slice(0, 5) : ""}
            onChange={(e) => {
              const fecha = editFields.fecha ?? task.fecha
              updateField("hora_cierre", e.target.value ? new Date(`${fecha}T${e.target.value}:00`).toISOString() : undefined)
            }}
          />
        </div>
      </div>

      {editError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {editError}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className={taskButtonPrimary}
          onClick={handleSaveEdit}
          disabled={updateTask.isPending}
        >
          {updateTask.isPending ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button"
          className={taskButtonSecondary}
          onClick={cancelEdit}
        >
          Cancelar
        </button>
      </div>
    </div>
  ) : (
    /* ── Modo Vista (contenido existente sin cambios) ── */
    <>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Título</p>
        <p className="text-sm font-semibold text-gray-900">{task.titulo}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Responsable" value={task.subido_por_nombre} />
        <Field label="Fecha" value={task.fecha} />
        <Field label="Tiempo registrado" value={formatMinutos(task.tiempo_total_minutos)} />

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

      {/* Evidencias (adjuntos) — agregado en Task 1 */}
      <div className="border-t border-gray-200 pt-4">
        <FileUploadZone taskId={task.id} />
        <AttachmentList
          taskId={task.id}
          attachments={adjuntos}
          onPreview={setPreviewAttachment}
        />
      </div>
    </>
  )}
</div>
```

- [ ] **Step 7: Modificar `TaskManagerView.tsx` para pasar `currentUserId`**

Leer el archivo y agregar:

```tsx
// Agregar import (junto a los otros imports)
import { useAuthStore } from "@/store/authStore"

// Dentro del componente (junto a las otras líneas de hooks):
const currentUser = useAuthStore((s) => s.user)

// Actualizar <TaskDetailSheet ...> para pasar currentUserId:
<TaskDetailSheet
  task={selectedTask}
  onClose={() => setSelectedTask(null)}
  onStatusChange={async (taskId, newEstado) => {
    await updateManagerTask.mutateAsync({ id: taskId, payload: { estado: newEstado } })
    setSelectedTask((prev) => prev ? { ...prev, estado: newEstado } : null)
  }}
  currentUserId={currentUser?.id}
/>
```

Verificar la ruta exacta de `authStore` con:
```bash
find C:/zymo-intranet/frontend/src -name "authStore*" -o -name "useAuth*" | head -5
```
y ajustar el import si es necesario.

- [ ] **Step 8: Verificar TypeScript**

```bash
cd C:/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sin errores.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskDetailSheet.tsx frontend/src/components/herramientas/tareas/TaskManagerView.tsx
git commit -m "feat(tareas): edición inline de tarea en TaskDetailSheet (solo el creador)"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Adjuntos visibles en el panel de detalle | Task 1 — FileUploadZone + AttachmentList en TaskDetailSheet |
| Preview de archivos (PDF iframe, imagen) | Task 1 — FilePreviewModal fuera del aside |
| Adjuntos se refrescan tras subir/eliminar | Task 1 — useTaskAttachments (query en vivo, no props estáticos) |
| Botón Editar solo para el creador | Task 2 Step 5 — `isOwner` guard en el header |
| Edición inline (sin nuevo modal) | Task 2 Step 6 — `isEditing` condicional en contenido |
| Campos editables: todos los de la tarea | Task 2 Step 6 — título, desc, etiqueta, plataforma, estado, prioridad, fecha, horas |
| Error visible si 403 o fallo de red | Task 2 Step 6 — banner rojo con mensaje |
| Reset al cambiar tarea | Task 2 Step 3 — `useEffect` en `task?.id` |
| Sin alert()/confirm() | ✓ — estados visuales de error en ambas tareas |

### Notas

- `useUpdateWorkTask.onSuccess` ya invalida `queryKey: ["tareas"]` — la lista se refresca automáticamente al guardar.
- `hora_inicio`/`hora_cierre` se parsean con `new Date(isoString).toTimeString().slice(0, 5)` para extraer `HH:MM` al llenar el input, y se convierten de vuelta a ISO en el `onChange`.
- El botón "Editar" nunca aparece para usuarios que no son dueños de la tarea — la validación es doble: frontend (UI) y backend (403).
