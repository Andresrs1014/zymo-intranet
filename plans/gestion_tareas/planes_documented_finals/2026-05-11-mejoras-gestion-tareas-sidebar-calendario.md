# Gestión de Tareas — Sidebar Izquierdo + Fixes Calendario

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un icon rail colapsable a la izquierda con filtros y lista compacta de personas; corregir el registro de eventos del calendario (deadlock de participantes); agregar campo plataforma al formulario de agenda; y arreglar el resize del CalendarSidebar.

**Architecture:** Se añade un `TaskLeftRail` (48px fijo) + `TaskLeftPanel` (260px colapsable) al layout de `GestionTareasPage`. El estado de `filters` sube de `TaskManagerView` a `GestionTareasPage` para que el panel izquierdo y la vista del manager compartan la misma fuente. Los bugs del calendario se corrigen en `ScheduleSheet.tsx`, el modelo `TaskEvent` y su schema.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Zustand (authStore), TanStack Query, FastAPI + SQLModel (Python), SQLite.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `frontend/src/components/herramientas/tareas/TaskLeftRail.tsx` |
| Crear | `frontend/src/components/herramientas/tareas/TaskLeftPanel.tsx` |
| Crear | `frontend/src/components/herramientas/tareas/PersonCompactList.tsx` |
| Modificar | `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx` |
| Modificar | `frontend/src/components/herramientas/tareas/TaskManagerView.tsx` |
| Modificar | `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx` |
| Modificar | `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx` |
| Modificar | `frontend/src/types/workTask.ts` |
| Modificar | `backend/app/models/task_event.py` |
| Modificar | `backend/app/schemas/task_event.py` |
| Modificar | `backend/app/services/task_event_service.py` |

---

## Task 1: Fix resize del CalendarSidebar

**Problema:** `transition-all duration-300` anima el `width` en cada pixel del drag → jank visible. `document.body.clientWidth` no incluye scrollbar → cálculo levemente incorrecto.

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx`

- [ ] **Step 1.1: Reemplazar el bloque del aside y la función resize**

Abrir `frontend/src/components/herramientas/tareas/CalendarSidebar.tsx`.

Reemplazar la función `resize` (líneas 48-57):
```typescript
const resize = useCallback(
  (e: MouseEvent) => {
    if (!isDragging) return
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setSidebarWidth(newWidth)
    }
  },
  [isDragging]
)
```

Reemplazar el `<aside>` (línea 80-85) para quitar `transition-all` durante el drag:
```tsx
<aside
  className={`border-l border-border bg-background flex flex-col relative h-full ${
    !isDragging ? "transition-all duration-300 ease-in-out" : ""
  } ${isOpen ? "opacity-100" : "opacity-0 overflow-hidden border-l-0"}`}
  style={{ width: isOpen ? sidebarWidth : 0, minWidth: isOpen ? sidebarWidth : 0 }}
>
```

- [ ] **Step 1.2: Verificar manualmente**

Con el servidor de desarrollo corriendo, abrir la página de gestión de tareas, abrir el calendario y hacer drag en el borde izquierdo del sidebar. El resize debe ser fluido sin animación durante el arrastre. Al soltar, no debe haber rebote.

- [ ] **Step 1.3: Commit**

```bash
git add frontend/src/components/herramientas/tareas/CalendarSidebar.tsx
git commit -m "fix(tareas): corregir jank en resize del CalendarSidebar"
```

---

## Task 2: Fix registro de eventos de calendario — deadlock participantes

**Problema 1:** El backend exige `participant_ids` con `min_length=1`. Para usuarios sin `tool_task_manage_dev`, el backend además exige que `participant_ids == [current_user.id]`. Pero `ScheduleSheet.tsx` inicializa `selectedIds = []` y cuando `!canSelectOthers` no incluye al usuario actual → envía `[]` → backend responde 403.

**Problema 2:** El `catch` en `handleSubmit` silencia el error real del backend.

**Files:**
- Modify: `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx`

- [ ] **Step 2.1: Agregar useAuthStore al ScheduleSheet**

En `ScheduleSheet.tsx`, agregar el import del auth store en la línea 1:
```typescript
import { useAuthStore } from "@/store/authStore"
```

- [ ] **Step 2.2: Leer el ID del usuario actual dentro del componente**

Dentro de `ScheduleSheet` (después de los imports de hooks, aprox. línea 35):
```typescript
const currentUserId = useAuthStore((s) => s.user?.id)
```

- [ ] **Step 2.3: Inicializar selectedIds con el usuario actual para no-managers**

Reemplazar el state de `selectedIds` (línea 31):
```typescript
const [selectedIds, setSelectedIds] = useState<number[]>([])
```
por:
```typescript
const [selectedIds, setSelectedIds] = useState<number[]>(() =>
  !canSelectOthers && currentUserId ? [currentUserId] : []
)
```

**Nota:** `useState` con función lazy se evalúa una sola vez en el mount. Esto es correcto porque `canSelectOthers` no cambia durante la vida del componente.

- [ ] **Step 2.4: Resetear selectedIds correctamente al cerrar**

En el `useEffect` de reset (línea 47-58), reemplazar `setSelectedIds([])` por:
```typescript
setSelectedIds(!canSelectOthers && currentUserId ? [currentUserId] : [])
```

El bloque completo queda:
```typescript
useEffect(() => {
  if (!isOpen) {
    const todayStr = format(new Date(), "yyyy-MM-dd")
    setTitulo("")
    setFecha(preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : todayStr)
    setHoraInicio("09:00")
    setDuracion("60")
    setDescripcion("")
    setSelectedIds(!canSelectOthers && currentUserId ? [currentUserId] : [])
    setError(null)
  }
}, [isOpen, preselectedDate, canSelectOthers, currentUserId])
```

- [ ] **Step 2.5: Agregar validación y error handling real**

Reemplazar el bloque `handleSubmit` (líneas 66-89) completo:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!titulo.trim()) {
    setError("El título es obligatorio.")
    return
  }
  if (selectedIds.length === 0) {
    setError("Debes incluir al menos un participante.")
    return
  }
  setError(null)
  setIsSubmitting(true)
  try {
    await createEvent.mutateAsync({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      fecha,
      hora_inicio: horaInicio,
      duracion_minutos: parseInt(duracion, 10) || 60,
      participant_ids: selectedIds,
    })
    onClose()
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      ?? "Error al crear el evento. Intenta de nuevo."
    setError(msg)
    console.error("[ScheduleSheet] Error al crear evento:", err)
  } finally {
    setIsSubmitting(false)
  }
}
```

- [ ] **Step 2.6: Para no-managers, mostrar texto informativo en lugar de selector vacío**

Reemplazar el bloque de participantes cuando `!canSelectOthers` (líneas 181-184):
```tsx
{!canSelectOthers ? (
  <p className="text-sm text-muted-foreground italic">
    El evento se agendará para ti.
  </p>
) : (
  // ... tabs de equipo/todos (sin cambios)
)}
```

- [ ] **Step 2.7: Verificar manualmente**

1. Iniciar sesión como usuario sin `tool_task_manage_dev`.
2. Abrir ScheduleSheet, rellenar título y hacer click en "Agendar evento".
3. Debe crearse el evento correctamente.
4. Abrir como manager, seleccionar participantes, agendar → debe funcionar.
5. Abrir como manager sin seleccionar participantes → debe mostrar "Debes incluir al menos un participante."

- [ ] **Step 2.8: Commit**

```bash
git add frontend/src/components/herramientas/tareas/ScheduleSheet.tsx
git commit -m "fix(calendario): corregir deadlock de participantes y mejorar error handling en ScheduleSheet"
```

---

## Task 3: Agregar campo plataforma al formulario de agenda

**Scope:** plataforma es un campo opcional en el evento. Backend: agregar columna al modelo y campo al schema. Frontend: agregar select al formulario.

**Files:**
- Modify: `backend/app/models/task_event.py`
- Modify: `backend/app/schemas/task_event.py`
- Modify: `backend/app/services/task_event_service.py`
- Modify: `frontend/src/types/workTask.ts`
- Modify: `frontend/src/components/herramientas/tareas/ScheduleSheet.tsx`

- [ ] **Step 3.1: Agregar columna plataforma al modelo TaskEvent**

En `backend/app/models/task_event.py`, agregar la columna después de `descripcion`:
```python
from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import date, datetime, timezone


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    scope: str = Field(max_length=100, index=True, nullable=False)
    team_id: Optional[int] = Field(default=None)
    titulo: str = Field(max_length=250, nullable=False)
    descripcion: Optional[str] = Field(default=None)
    plataforma: Optional[str] = Field(default=None, max_length=50)   # ← NUEVO
    fecha: date = Field(index=True, nullable=False)
    hora_inicio: str = Field(max_length=5, nullable=False)
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

**Nota de migración:** SQLModel con SQLite agrega columnas automáticamente al arrancar el contenedor si se usa `SQLModel.metadata.create_all`. Verificar en `database.py` que el engine crea la tabla con `create_all`. Si la tabla ya existe en producción, ejecutar manualmente: `ALTER TABLE task_events ADD COLUMN plataforma TEXT;`

- [ ] **Step 3.2: Agregar plataforma al schema TaskEventCreate y TaskEventRead**

En `backend/app/schemas/task_event.py`:
```python
class TaskEventCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    plataforma: Optional[str] = None          # ← NUEVO
    fecha: str
    hora_inicio: str
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


class TaskEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descripcion: Optional[str] = None
    plataforma: Optional[str] = None          # ← NUEVO
    fecha: str
    hora_inicio: str
    duracion_minutos: int
    creado_por_id: int
    creado_por_nombre: str
    participants: list[TaskEventParticipantRead] = []
```

- [ ] **Step 3.3: Usar plataforma en task_event_service.py**

En `backend/app/services/task_event_service.py`, dentro de `create_event`, al construir el objeto `TaskEvent`:
```python
event = TaskEvent(
    scope=SCOPE_DEV,
    titulo=payload.titulo,
    descripcion=payload.descripcion,
    plataforma=payload.plataforma,            # ← NUEVO
    fecha=date.fromisoformat(payload.fecha),
    hora_inicio=payload.hora_inicio,
    duracion_minutos=payload.duracion_minutos,
    creado_por_id=creator.id,
    creado_por_nombre=creator.full_name,
)
```

- [ ] **Step 3.4: Agregar plataforma a TaskEventCreate en el frontend**

En `frontend/src/types/workTask.ts`, actualizar `TaskEventCreate`:
```typescript
export interface TaskEventCreate {
  titulo: string
  descripcion?: string
  plataforma?: string          // ← NUEVO
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  participant_ids: number[]
}
```

Y actualizar `TaskEvent` para incluirla en la respuesta:
```typescript
export interface TaskEvent {
  id: number
  titulo: string
  descripcion?: string
  plataforma?: string          // ← NUEVO
  fecha: string
  hora_inicio: string
  duracion_minutos: number
  creado_por_id: number
  creado_por_nombre: string
  participants: TaskEventParticipant[]
}
```

- [ ] **Step 3.5: Agregar el select de plataforma en ScheduleSheet**

En `ScheduleSheet.tsx`, agregar el import de la constante:
```typescript
import { PLATAFORMAS, PLATAFORMA_LABELS } from "@/lib/taskTheme"
```

Agregar el state del campo plataforma (junto a los otros useState):
```typescript
const [plataforma, setPlataforma] = useState<string>("")
```

Resetear en el `useEffect` de cierre (dentro del `if (!isOpen)` block):
```typescript
setPlataforma("")
```

Incluir en el `mutateAsync` payload:
```typescript
await createEvent.mutateAsync({
  titulo: titulo.trim(),
  descripcion: descripcion.trim() || undefined,
  plataforma: plataforma || undefined,
  fecha,
  hora_inicio: horaInicio,
  duracion_minutos: parseInt(duracion, 10) || 60,
  participant_ids: selectedIds,
})
```

Agregar el campo en el formulario JSX, después del campo Descripción y antes de Participantes:
```tsx
{/* Plataforma */}
<div className="space-y-1.5">
  <Label htmlFor="sch-plataforma">Plataforma (opcional)</Label>
  <select
    id="sch-plataforma"
    value={plataforma}
    onChange={(e) => setPlataforma(e.target.value)}
    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  >
    <option value="">Todas las plataformas</option>
    {PLATAFORMAS.map((p) => (
      <option key={p} value={p}>{PLATAFORMA_LABELS[p] ?? p}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3.6: Verificar que PLATAFORMA_LABELS y PLATAFORMAS están exportados en taskTheme.ts**

```bash
grep -n "PLATAFORMA_LABELS\|PLATAFORMAS" /c/zymo-intranet/frontend/src/lib/taskTheme.ts
```

Si no están exportados, verificar en `@/types/workTask.ts`:
```typescript
export const PLATAFORMAS = ["logimat1", "logimat2", "imccargo", "imcdeposito", "transversal"] as const
```

Ajustar el import en ScheduleSheet según donde estén definidas.

- [ ] **Step 3.7: Verificar manualmente**

1. Abrir el formulario de agendar evento.
2. Verificar que aparece el select de plataforma con las 5 opciones.
3. Crear un evento con plataforma seleccionada.
4. Verificar en la lista de eventos del CalendarSidebar que el evento aparece.

- [ ] **Step 3.8: Commit**

```bash
git add backend/app/models/task_event.py \
        backend/app/schemas/task_event.py \
        backend/app/services/task_event_service.py \
        frontend/src/types/workTask.ts \
        frontend/src/components/herramientas/tareas/ScheduleSheet.tsx
git commit -m "feat(calendario): agregar campo plataforma al evento de agenda"
```

---

## Task 4: PersonCompactList — lista compacta de personas para el panel izquierdo

**Files:**
- Create: `frontend/src/components/herramientas/tareas/PersonCompactList.tsx`

- [ ] **Step 4.1: Crear PersonCompactList.tsx**

Crear el archivo `frontend/src/components/herramientas/tareas/PersonCompactList.tsx`:

```typescript
import type { PersonTaskSummary } from "@/types/workTask"

interface Props {
  summaries: PersonTaskSummary[]
  selectedPersonId?: number
  onSelect: (userId: number) => void
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function PersonCompactList({ summaries, selectedPersonId, onSelect }: Props) {
  if (summaries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Sin miembros.
      </p>
    )
  }

  return (
    <div className="space-y-0.5">
      {summaries.map((person) => {
        const isSelected = selectedPersonId === person.user_id
        const avatarColor = getAvatarColor(person.nombre)
        const initials = getInitials(person.nombre)

        return (
          <button
            key={person.user_id}
            type="button"
            onClick={() => onSelect(person.user_id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
              isSelected
                ? "bg-gray-900 text-white"
                : "hover:bg-gray-100 text-gray-700"
            }`}
          >
            {/* Avatar */}
            <span
              className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                isSelected ? "bg-white/20 text-white" : avatarColor
              }`}
            >
              {initials}
            </span>

            {/* Nombre + tareas */}
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium truncate leading-tight">
                {person.nombre.split(" ")[0]}
              </span>
            </span>

            {/* Tareas count */}
            <span className={`shrink-0 text-[10px] font-semibold ${
              isSelected ? "text-white/70" : "text-gray-400"
            }`}>
              {person.tareas_totales}
            </span>

            {/* Sin registro hoy */}
            {!person.registro_hoy && (
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-400"
                title="Sin registro hoy"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4.2: Commit**

```bash
git add frontend/src/components/herramientas/tareas/PersonCompactList.tsx
git commit -m "feat(tareas): crear PersonCompactList para el panel lateral izquierdo"
```

---

## Task 5: TaskLeftRail — barra de iconos de 48px

**Files:**
- Create: `frontend/src/components/herramientas/tareas/TaskLeftRail.tsx`

- [ ] **Step 5.1: Crear TaskLeftRail.tsx**

Crear `frontend/src/components/herramientas/tareas/TaskLeftRail.tsx`:

```typescript
import { SlidersHorizontal, Users } from "lucide-react"

interface Props {
  isPanelOpen: boolean
  onToggle: () => void
  hasActiveFilters: boolean
  hasSelectedPerson: boolean
}

export function TaskLeftRail({
  isPanelOpen,
  onToggle,
  hasActiveFilters,
  hasSelectedPerson,
}: Props) {
  const hasAnyActive = hasActiveFilters || hasSelectedPerson

  return (
    <div className="flex flex-col items-center gap-1 w-12 shrink-0 border-r border-border bg-background py-3">
      <button
        type="button"
        onClick={onToggle}
        title={isPanelOpen ? "Cerrar panel" : "Abrir filtros y equipo"}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          isPanelOpen
            ? "bg-gray-900 text-white"
            : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {/* Indicador de filtros activos */}
        {hasAnyActive && !isPanelOpen && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
        )}
      </button>

      <button
        type="button"
        onClick={onToggle}
        title={isPanelOpen ? "Cerrar panel" : "Ver equipo"}
        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
          isPanelOpen
            ? "bg-gray-900 text-white"
            : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        }`}
      >
        <Users className="w-4 h-4" />
      </button>
    </div>
  )
}
```

**Nota de diseño:** Ambos botones del rail hacen toggle del mismo panel (que contiene filtros + personas). Un solo panel unificado es más predecible que dos paneles independientes.

- [ ] **Step 5.2: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskLeftRail.tsx
git commit -m "feat(tareas): crear TaskLeftRail — barra de iconos 48px del panel izquierdo"
```

---

## Task 6: TaskLeftPanel — panel colapsable 260px

**Files:**
- Create: `frontend/src/components/herramientas/tareas/TaskLeftPanel.tsx`

- [ ] **Step 6.1: Crear TaskLeftPanel.tsx**

Crear `frontend/src/components/herramientas/tareas/TaskLeftPanel.tsx`:

```typescript
import { X } from "lucide-react"
import type { TaskFilters, PersonTaskSummary } from "@/types/workTask"
import { ESTADOS, ETIQUETAS, PLATAFORMAS } from "@/types/workTask"
import { ESTADO_LABELS, ETIQUETA_LABELS, PLATAFORMA_LABELS } from "@/lib/taskTheme"
import { PersonCompactList } from "./PersonCompactList"

interface Props {
  isOpen: boolean
  filters: TaskFilters
  onFiltersChange: (f: TaskFilters) => void
  persons: PersonTaskSummary[]
  onClose: () => void
}

export function TaskLeftPanel({
  isOpen,
  filters,
  onFiltersChange,
  persons,
  onClose,
}: Props) {
  const set = (patch: Partial<TaskFilters>) =>
    onFiltersChange({ ...filters, ...patch })

  const clear = () =>
    onFiltersChange({
      fecha_desde: undefined,
      fecha_hasta: undefined,
      responsable_id: undefined,
      estado: undefined,
      etiqueta: undefined,
      plataforma: undefined,
      q: undefined,
      sin_registro_hoy: undefined,
    })

  const handleSelectPerson = (userId: number) => {
    set({ responsable_id: filters.responsable_id === userId ? undefined : userId })
  }

  const activeFilterCount = [
    filters.fecha_desde,
    filters.fecha_hasta,
    filters.estado,
    filters.etiqueta,
    filters.plataforma,
    filters.q,
    filters.sin_registro_hoy,
  ].filter(Boolean).length

  return (
    <div
      className={`flex flex-col border-r border-border bg-gray-50/60 overflow-hidden transition-all duration-200 ease-in-out shrink-0`}
      style={{ width: isOpen ? 260 : 0 }}
    >
      {/* Contenido del panel — siempre montado para no perder el estado */}
      <div className="flex flex-col h-full w-[260px]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Filtros y equipo
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {/* ── Búsqueda ─────────────────────── */}
          <input
            type="text"
            placeholder="Buscar tarea..."
            value={filters.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />

          {/* ── Fecha ────────────────────────── */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Fecha
            </p>
            <div className="space-y-1.5">
              <input
                type="date"
                value={filters.fecha_desde ?? ""}
                onChange={(e) => set({ fecha_desde: e.target.value || undefined })}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              <input
                type="date"
                value={filters.fecha_hasta ?? ""}
                onChange={(e) => set({ fecha_hasta: e.target.value || undefined })}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
          </section>

          {/* ── Estado ───────────────────────── */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set({ estado: filters.estado === s ? undefined : s })}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    filters.estado === s
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {ESTADO_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </section>

          {/* ── Etiqueta ─────────────────────── */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Etiqueta
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ETIQUETAS.map((et) => (
                <button
                  key={et}
                  type="button"
                  onClick={() => set({ etiqueta: filters.etiqueta === et ? undefined : et })}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    filters.etiqueta === et
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {ETIQUETA_LABELS[et] ?? et}
                </button>
              ))}
            </div>
          </section>

          {/* ── Plataforma ───────────────────── */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Plataforma
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLATAFORMAS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    set({ plataforma: filters.plataforma === p ? undefined : p })
                  }
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    filters.plataforma === p
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {PLATAFORMA_LABELS[p] ?? p}
                </button>
              ))}
            </div>
          </section>

          {/* ── Sin registro hoy ─────────────── */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.sin_registro_hoy ?? false}
              onChange={(e) => set({ sin_registro_hoy: e.target.checked || undefined })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
            />
            <span className="text-xs text-gray-600">Sin registro hoy</span>
          </label>

          {/* ── Limpiar ──────────────────────── */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clear}
              className="w-full text-xs text-gray-400 hover:text-gray-700 transition-colors text-center py-1"
            >
              Limpiar {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""}
            </button>
          )}

          {/* ── Equipo ───────────────────────── */}
          {persons.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Equipo
              </p>
              <PersonCompactList
                summaries={persons}
                selectedPersonId={filters.responsable_id}
                onSelect={handleSelectPerson}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Verificar exports en taskTheme.ts y workTask.ts**

Confirmar que `ESTADO_LABELS`, `ETIQUETA_LABELS`, `PLATAFORMA_LABELS` están exportados desde `@/lib/taskTheme`:
```bash
grep -n "LABELS\|export const" /c/zymo-intranet/frontend/src/lib/taskTheme.ts | head -20
```

Confirmar que `ESTADOS`, `ETIQUETAS`, `PLATAFORMAS` están exportados desde `@/types/workTask`:
```bash
grep -n "^export const" /c/zymo-intranet/frontend/src/types/workTask.ts
```

Si alguno no está exportado, agregar `export` al frente de la constante correspondiente.

- [ ] **Step 6.3: Commit**

```bash
git add frontend/src/components/herramientas/tareas/TaskLeftPanel.tsx
git commit -m "feat(tareas): crear TaskLeftPanel con filtros compactos y lista de equipo"
```

---

## Task 7: Actualizar GestionTareasPage y TaskManagerView — nuevo layout

**Cambios clave:**
- `filters` sube de `TaskManagerView` a `GestionTareasPage`
- `GestionTareasPage` incorpora el rail izquierdo + panel
- `TaskManagerView` recibe `filters` como prop (ya no los gestiona internamente)
- `TaskManagerView` elimina el render de `TaskFiltersBar` y `PersonTaskCards`

**Files:**
- Modify: `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`
- Modify: `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`

- [ ] **Step 7.1: Actualizar TaskManagerView para recibir filters como prop**

Reemplazar el archivo completo `frontend/src/components/herramientas/tareas/TaskManagerView.tsx`:

```typescript
import { useState } from "react"
import type { WorkTask, TaskFilters, WorkTaskCreate } from "@/types/workTask"
import {
  useTeamTasks,
  useTeamKpis,
  useTeamCharts,
  useUsersWithoutTodayEntry,
  useCreateWorkTask,
} from "@/hooks/useWorkTasks"
import { exportTasksExcel, exportTasksPdf } from "@/hooks/useTaskExports"
import { TaskCharts } from "./TaskCharts"
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
  onFiltersChange: (f: TaskFilters) => void
}

export function TaskManagerView({ canSubmitOwn, filters, onFiltersChange }: Props) {
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null)
  const [teamConfigOpen, setTeamConfigOpen] = useState(false)
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const createTask = useCreateWorkTask()

  const { data: tasks } = useTeamTasks(filters)
  const { data: kpis } = useTeamKpis(filters)
  const { data: charts } = useTeamCharts(filters)
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

  const chartsData = charts as {
    tareas_por_responsable: { nombre: string; tareas: number }[]
    horas_por_responsable: { nombre: string; horas: number }[]
    distribucion_estado: { estado: string; cantidad: number }[]
    tareas_por_etiqueta: { etiqueta: string; cantidad: number }[]
    evolucion_completadas: { fecha: string; completadas: number }[]
  } | undefined

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de tareas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Equipo de Desarrollo e Innovación</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={taskButtonSecondary}
            onClick={handleExportExcel}
            disabled={exporting !== null}
          >
            {exporting === "excel" ? "Exportando..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            className={taskButtonSecondary}
            onClick={handleExportPdf}
            disabled={exporting !== null}
          >
            {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
          </button>
          <button
            type="button"
            className={taskButtonPrimary}
            onClick={() => setTeamConfigOpen(true)}
          >
            Configurar equipo
          </button>
          {canSubmitOwn && (
            <button
              type="button"
              className={taskButtonPrimary}
              onClick={() => setShowNewTaskForm((v) => !v)}
            >
              {showNewTaskForm ? "Cancelar" : "+ Nueva tarea"}
            </button>
          )}
        </div>
      </div>

      {showNewTaskForm && canSubmitOwn && (
        <div className={`${taskCard} p-6`}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva tarea</h2>
          <TaskForm
            onSubmit={handleNewTaskSubmit}
            onCancel={() => setShowNewTaskForm(false)}
            loading={createTask.isPending}
          />
        </div>
      )}

      {/* Alert: users without today entry */}
      {sinRegistro && sinRegistro.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <strong>{sinRegistro.length} miembro{sinRegistro.length > 1 ? "s" : ""} sin registro hoy:</strong>{" "}
          {sinRegistro.map((u) => u.nombre).join(", ")}.
        </div>
      )}

      {/* KPI Cards */}
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

      {/* Charts */}
      {charts && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Gráficas</h2>
          <TaskCharts data={chartsData} />
        </div>
      )}

      {/* Data table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Tareas ({tasks?.length ?? 0})
        </h2>
        <TaskDataTable
          tasks={tasks ?? []}
          onRowClick={(t) => setSelectedTask(t)}
        />
      </div>

      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />
      <TaskTeamConfigDialog open={teamConfigOpen} onClose={() => setTeamConfigOpen(false)} />
    </div>
  )
}

function KpiCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className={`${taskCard} p-4`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 7.2: Actualizar GestionTareasPage con el nuevo layout**

Reemplazar el archivo completo `frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx`:

```typescript
import { useState, useEffect } from "react"
import { Navigate } from "react-router-dom"
import { Plus, PanelRightClose, PanelRightOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAuthStore } from "@/store/authStore"
import { canManageDevTasks, canSubmitDevTasks } from "@/lib/permissions"
import { PageLayout } from "@/components/layout/PageLayout"
import { CalendarSidebar } from "@/components/herramientas/tareas/CalendarSidebar"
import { ScheduleSheet } from "@/components/herramientas/tareas/ScheduleSheet"
import { TaskManagerView } from "@/components/herramientas/tareas/TaskManagerView"
import { TaskSubmitView } from "@/components/herramientas/tareas/TaskSubmitView"
import { TaskChartsTab } from "@/components/herramientas/tareas/TaskChartsTab"
import { TeamConfigTab } from "@/components/herramientas/tareas/TeamConfigTab"
import { TaskLeftRail } from "@/components/herramientas/tareas/TaskLeftRail"
import { TaskLeftPanel } from "@/components/herramientas/tareas/TaskLeftPanel"
import { useTeamPersonSummaries } from "@/hooks/useWorkTasks"
import type { TaskFilters } from "@/types/workTask"

const LEFT_PANEL_KEY = "task-left-panel-open"

export function GestionTareasPage() {
  const user = useAuthStore((s) => s.user)
  const userTools: string[] = user?.user_tools ?? []
  const canManage = canManageDevTasks(userTools, user?.role)
  const canSubmit = canSubmitDevTasks(userTools, user?.is_team_member)

  const [filters, setFilters] = useState<TaskFilters>({})
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(
    () => localStorage.getItem(LEFT_PANEL_KEY) === "true"
  )
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  const { data: persons = [] } = useTeamPersonSummaries(filters)

  // Persistir preferencia del panel izquierdo
  useEffect(() => {
    localStorage.setItem(LEFT_PANEL_KEY, String(isLeftPanelOpen))
  }, [isLeftPanelOpen])

  if (!canManage && !canSubmit) {
    return <Navigate to="/dashboard" replace />
  }

  const pageTitle = canManage ? "Gestión de Tareas" : "Registro de Tareas"

  const hasActiveFilters = !!(
    filters.fecha_desde ||
    filters.fecha_hasta ||
    filters.estado ||
    filters.etiqueta ||
    filters.plataforma ||
    filters.q ||
    filters.sin_registro_hoy
  )

  return (
    <PageLayout
      title={pageTitle}
      mainClassName="flex flex-1 min-h-0 overflow-hidden p-0"
    >
      <div className="flex flex-1 min-h-0 overflow-hidden w-full">

        {/* Rail izquierdo de iconos (solo managers) */}
        {canManage && (
          <TaskLeftRail
            isPanelOpen={isLeftPanelOpen}
            onToggle={() => setIsLeftPanelOpen((v) => !v)}
            hasActiveFilters={hasActiveFilters}
            hasSelectedPerson={!!filters.responsable_id}
          />
        )}

        {/* Panel izquierdo colapsable (solo managers) */}
        {canManage && (
          <TaskLeftPanel
            isOpen={isLeftPanelOpen}
            filters={filters}
            onFiltersChange={setFilters}
            persons={persons}
            onClose={() => setIsLeftPanelOpen(false)}
          />
        )}

        {/* Contenido principal */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {/* Sub-header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 bg-primary rounded-full" />
              <span className="text-base font-semibold">
                {canManage ? "Equipo de Desarrollo e Innovación" : "Mis tareas"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsScheduleOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Agendar
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSidebarOpen((v) => !v)}
                className={isSidebarOpen ? "bg-muted" : ""}
                title={isSidebarOpen ? "Ocultar agenda" : "Mostrar agenda"}
              >
                {isSidebarOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 py-4">
            <Tabs defaultValue="tareas" className="space-y-4">
              <TabsList>
                <TabsTrigger value="tareas">
                  {canManage ? "Tareas del equipo" : "Mis tareas"}
                </TabsTrigger>
                <TabsTrigger value="graficas">Gráficas</TabsTrigger>
                {canManage && (
                  <TabsTrigger value="configuracion">Configuración</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="tareas">
                {canManage ? (
                  <TaskManagerView
                    canSubmitOwn={true}
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                ) : (
                  <TaskSubmitView />
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
          </div>
        </main>

        {/* Sidebar calendario (derecha) */}
        <CalendarSidebar
          isOpen={isSidebarOpen}
          onDateSelect={(date) => {
            setScheduleDate(date)
            setIsScheduleOpen(true)
          }}
          onEventClick={() => {}}
          onNewEvent={(date) => {
            setScheduleDate(date)
            setIsScheduleOpen(true)
          }}
        />
      </div>

      {/* Schedule sheet */}
      <ScheduleSheet
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        preselectedDate={scheduleDate}
        canSelectOthers={canManage}
      />
    </PageLayout>
  )
}
```

- [ ] **Step 7.3: Verificar que useTeamPersonSummaries está exportado en useWorkTasks.ts**

```bash
grep -n "export function useTeamPersonSummaries" /c/zymo-intranet/frontend/src/hooks/useWorkTasks.ts
```

Debe encontrar una coincidencia. Si no existe con ese nombre exacto, buscar el nombre real:
```bash
grep -n "Summaries\|summaries\|personas" /c/zymo-intranet/frontend/src/hooks/useWorkTasks.ts
```

Actualizar el import en GestionTareasPage con el nombre correcto.

- [ ] **Step 7.4: Verificar TypeScript compile**

```bash
cd /c/zymo-intranet/frontend && npx tsc --noEmit 2>&1 | head -40
```

Resolver cualquier error de tipos antes de continuar.

- [ ] **Step 7.5: Verificar manualmente el flujo completo**

1. Abrir la página como manager.
2. Verificar que el rail de iconos aparece a la izquierda (48px, cerrado por defecto).
3. Hacer click en el icono de filtros → el panel se abre suavemente.
4. Aplicar un filtro de estado → la tabla se actualiza.
5. Hacer click en una persona → la tabla filtra por esa persona, el ícono Users muestra el punto azul.
6. Cerrar el panel con la X → el panel colapsa, el punto azul permanece en el rail.
7. Verificar que el CalendarSidebar sigue funcionando.
8. Abrir como usuario sin rol manager → no aparece el rail izquierdo.

- [ ] **Step 7.6: Commit**

```bash
git add frontend/src/pages/herramientas/tareas/GestionTareasPage.tsx \
        frontend/src/components/herramientas/tareas/TaskManagerView.tsx
git commit -m "feat(tareas): integrar sidebar izquierdo con icon rail + panel colapsable de filtros y equipo"
```

---

## Checklist final de verificación

- [ ] El resize del CalendarSidebar es fluido sin jank durante el drag
- [ ] Un usuario sin rol manager puede crear eventos en el calendario (auto-incluye su propio ID)
- [ ] Un manager puede crear eventos con múltiples participantes
- [ ] El formulario de agenda muestra el campo Plataforma
- [ ] Los eventos se guardan correctamente y aparecen en el sidebar del calendario
- [ ] El rail izquierdo aparece solo para managers
- [ ] El panel izquierdo recuerda si estaba abierto o cerrado (localStorage)
- [ ] El punto azul en el rail aparece cuando hay filtros activos o persona seleccionada
- [ ] Los chips de estado/etiqueta/plataforma del panel funcionan como toggle
- [ ] `npx tsc --noEmit` pasa sin errores
- [ ] `docker compose build frontend` pasa sin errores
